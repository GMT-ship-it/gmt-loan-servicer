-- 1) Link draws to ledger entries (idempotency + traceability)
alter table public.transactions
add column if not exists draw_request_id uuid references public.draw_requests(id);

-- prevent duplicate ledger posts for the same draw
create unique index if not exists ux_txn_draw_request
  on public.transactions(draw_request_id)
  where draw_request_id is not null;

-- 2) Trigger function: when a draw is approved, post an 'advance' once
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
begin
  -- Only act when status transitions to APPROVED (and wasn't approved before)
  if not (tg_op = 'UPDATE' and new.status = 'approved' and coalesce(old.status, 'submitted') <> 'approved') then
    return new;
  end if;

  -- Validate facility status & min_advance
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

  -- Idempotency: if a transaction already exists for this draw, do nothing
  select exists(
    select 1 from public.transactions t where t.draw_request_id = new.id
  ) into v_exists;

  if v_exists then
    return new;
  end if;

  -- Who to attribute as creator of the ledger entry
  v_created_by := coalesce(new.decided_by, auth.uid());

  -- Post the advance
  insert into public.transactions (
    facility_id, type, amount, effective_at, memo, created_by, draw_request_id
  ) values (
    new.facility_id, 'advance', new.amount, now(),
    'Draw funded via approval ' || new.id, v_created_by, new.id
  );

  return new;
end;
$$;

-- 3) Attach trigger to draw_requests (fires on updates)
drop trigger if exists trg_fund_draw_on_approve on public.draw_requests;
create trigger trg_fund_draw_on_approve
after update on public.draw_requests
for each row
execute procedure public.fund_draw_on_approve();