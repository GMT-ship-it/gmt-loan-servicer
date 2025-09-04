-- Step 7D.1: Update recalc_bbc_header to use secure get_facility_principal function
create or replace function public.recalc_bbc_header(p_report uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fac uuid;
  v_gross numeric(16,2);
  v_inel numeric(16,2);
  v_reserves numeric(16,2);
  v_rate numeric(7,4);
  v_principal numeric(16,2);
  v_credit_limit numeric(16,2);
begin
  -- get facility id + keep advance_rate from header
  select r.facility_id, r.advance_rate into v_fac, v_rate
  from public.borrowing_base_reports r
  where r.id = p_report;

  -- sum line items
  select
    coalesce(sum(amount),0),
    coalesce(sum(case when ineligible then amount else 0 end),0),
    0::numeric
  into v_gross, v_inel, v_reserves
  from public.borrowing_base_items
  where report_id = p_report;

  -- principal (via secure function) & credit limit
  select (select principal_outstanding
          from public.get_facility_principal(v_fac) limit 1),
         f.credit_limit
  into v_principal, v_credit_limit
  from public.facilities f
  where f.id = v_fac;

  update public.borrowing_base_reports
  set gross_collateral = v_gross,
      ineligibles = v_inel,
      reserves = v_reserves,
      borrowing_base = greatest(0, v_gross - v_inel - v_reserves),
      availability = greatest(
        0,
        least(
          v_credit_limit - v_principal,
          greatest(0, v_gross - v_inel - v_reserves) - v_principal
        )
      )
  where id = p_report;
end;
$$;

-- Step 7D.2: Add BBC freshness check helper function
create or replace function public.facility_has_recent_approved_bbc(
  p_facility uuid,
  p_days int default 45
) returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.borrowing_base_reports r
    where r.facility_id = p_facility
      and r.status = 'approved'
      and r.period_end >= (current_date - make_interval(days => p_days))
  );
$$;

-- Step 7D.3: Update approval trigger to enforce Docs OK + BBC freshness
create or replace function public.fund_draw_on_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_advance numeric(14,2);
  v_status public.facility_status;
  v_exists boolean;
  v_created_by uuid;
  v_available numeric(14,2);
  v_bbc_ok boolean;
begin
  -- Only on transition to APPROVED
  if not (tg_op = 'UPDATE' and new.status = 'approved' and coalesce(old.status, 'submitted') <> 'approved') then
    return new;
  end if;

  -- 1) Documents must be OK
  if not new.required_docs_ok then
    raise exception 'Cannot approve: required documents are not marked OK for this draw.';
  end if;

  -- 2) Facility basics
  select f.min_advance, f.status
    into v_min_advance, v_status
  from public.facilities f
  where f.id = new.facility_id;

  if v_status <> 'active' then
    raise exception 'Facility % is not active; cannot fund approved draw', new.facility_id;
  end if;

  if new.amount < coalesce(v_min_advance, 0) then
    raise exception 'Approved draw % is below facility minimum advance %', new.amount, v_min_advance;
  end if;

  -- 3) Credit limit availability
  select public.facility_available_to_draw(new.facility_id) into v_available;
  if new.amount > coalesce(v_available, 0) then
    raise exception 'Approved amount % exceeds available to draw % for facility %', new.amount, v_available, new.facility_id;
  end if;

  -- 4) BBC freshness (45 days by default)
  select public.facility_has_recent_approved_bbc(new.facility_id, 45) into v_bbc_ok;
  if not v_bbc_ok then
    raise exception 'Cannot approve: no approved BBC found within the last 45 days for this facility.';
  end if;

  -- 5) Idempotency
  select exists(select 1 from public.transactions t where t.draw_request_id = new.id) into v_exists;
  if v_exists then
    return new;
  end if;

  -- 6) Post the advance
  v_created_by := coalesce(new.decided_by, auth.uid());
  insert into public.transactions (facility_id, type, amount, effective_at, memo, created_by, draw_request_id)
  values (new.facility_id, 'advance', new.amount, now(), 'Draw funded via approval ' || new.id, v_created_by, new.id);

  return new;
end;
$$;

-- Recreate the trigger
drop trigger if exists trg_fund_draw_on_approve on public.draw_requests;
create trigger trg_fund_draw_on_approve
after update on public.draw_requests
for each row
execute procedure public.fund_draw_on_approve();