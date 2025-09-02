-- Enum for simple status flow
do $$
begin
  if not exists (select 1 from pg_type where typname='decision_status') then
    create type decision_status as enum ('submitted','under_review','approved','rejected');
  end if;
end$$;

-- Draw requests table
create table if not exists public.draw_requests (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  status decision_status not null default 'submitted',
  decision_notes text,
  required_docs_ok boolean not null default false,
  created_by uuid references auth.users(id),
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Enable RLS
alter table public.draw_requests enable row level security;

-- Lenders: full access
drop policy if exists "draws_lender_all" on public.draw_requests;
create policy "draws_lender_all" on public.draw_requests
for all using (public.is_lender(auth.uid()))
with check (public.is_lender(auth.uid()));

-- Borrowers: can insert and view only their own facility's draw requests
drop policy if exists "draws_borrower_insert_read" on public.draw_requests;
create policy "draws_borrower_insert_read" on public.draw_requests
for select using (
  public.is_borrower(auth.uid()) and exists (
    select 1 from public.facilities f
    where f.id = draw_requests.facility_id
      and f.customer_id = public.user_customer_id(auth.uid())
  )
)
, for insert with check (
  public.is_borrower(auth.uid()) and exists (
    select 1 from public.facilities f
    where f.id = draw_requests.facility_id
      and f.customer_id = public.user_customer_id(auth.uid())
  )
);

-- Verification queries
select to_regclass('public.draw_requests') as draw_requests_table;

select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and relname = 'draw_requests';