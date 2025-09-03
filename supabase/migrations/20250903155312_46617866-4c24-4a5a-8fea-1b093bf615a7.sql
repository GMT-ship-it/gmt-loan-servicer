-- 1) Helper: compute available_to_draw from current ledger
create or replace function public.facility_available_to_draw(p_facility uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  with principal as (
    select
      coalesce(sum(case when t.type in ('advance','fee','letter_of_credit','dof','adjustment') then t.amount else 0 end),0)
      - coalesce(sum(case when t.type = 'payment' then t.amount else 0 end),0) as principal_outstanding
    from public.transactions t
    where t.facility_id = p_facility
  )
  select greatest(
    0,
    f.credit_limit - coalesce((select principal_outstanding from principal), 0)
  )
  from public.facilities f
  where f.id = p_facility
$$;

-- 2) Recreate approval trigger to enforce availability
create or replace function public.fund_draw_on_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_advance numeric(14,2);
  v_status facility_status;
  v_exists boolean;
  v_created_by uuid;
  v_available numeric(14,2);
begin
  -- Only when transitioning to APPROVED
  if not (tg_op = 'UPDATE' and new.status = 'approved' and coalesce(old.status, 'submitted') <> 'approved') then
    return new;
  end if;

  -- Validate facility basics
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

  -- NEW: Credit-limit availability guard
  select public.facility_available_to_draw(new.facility_id) into v_available;
  if new.amount > coalesce(v_available, 0) then
    raise exception 'Approved amount % exceeds available to draw % for facility %', new.amount, v_available, new.facility_id;
  end if;

  -- Idempotency: skip if already posted
  select exists(select 1 from public.transactions t where t.draw_request_id = new.id) into v_exists;
  if v_exists then
    return new;
  end if;

  -- Post the advance
  v_created_by := coalesce(new.decided_by, auth.uid());
  insert into public.transactions (facility_id, type, amount, effective_at, memo, created_by, draw_request_id)
  values (new.facility_id, 'advance', new.amount, now(), 'Draw funded via approval ' || new.id, v_created_by, new.id);

  return new;
end;
$$;

-- Reattach trigger (safe if already present)
drop trigger if exists trg_fund_draw_on_approve on public.draw_requests;
create trigger trg_fund_draw_on_approve
after update on public.draw_requests
for each row
execute procedure public.fund_draw_on_approve();