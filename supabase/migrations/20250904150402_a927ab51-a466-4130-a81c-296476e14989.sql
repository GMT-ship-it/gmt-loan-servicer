-- Post accrued (unposted) interest for a single facility through p_as_of (default: today).
-- Returns the amount posted (rounded to cents). 0 if none posted.
create or replace function public.post_interest_for_facility(
  p_facility uuid,
  p_as_of date default current_date
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(16,2);
begin
  -- compute accrued interest as of the date (uses 365 basis per your fn)
  select round(coalesce(public.facility_accrued_interest(p_facility, p_as_of), 0)::numeric, 2)
  into v_amount;

  if v_amount is null or v_amount <= 0 then
    return 0;
  end if;

  -- insert one interest transaction; created_by is nullable for system posts
  insert into public.transactions (facility_id, type, amount, effective_at, memo, created_by)
  values (
    p_facility,
    'interest',
    v_amount,
    -- effective at now; if you prefer end-of-day, use (p_as_of + time '23:59:00')
    now(),
    'Interest posted through ' || p_as_of::text,
    null
  );

  return v_amount;
end;
$$;

-- Convenience wrapper: post interest for ALL active facilities, return a summary table.
create or replace function public.post_interest_all_active(
  p_as_of date default current_date
) returns table (facility_id uuid, posted numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_posted numeric(16,2);
begin
  for r in
    select id as facility_id
    from public.facilities
    where status = 'active'
  loop
    v_posted := public.post_interest_for_facility(r.facility_id, p_as_of);
    return next (r.facility_id, v_posted);
  end loop;

  return;
end;
$$;