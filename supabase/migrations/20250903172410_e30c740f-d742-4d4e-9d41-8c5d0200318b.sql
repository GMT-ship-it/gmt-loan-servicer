-- --- Enums ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname='bbc_status') then
    create type bbc_status as enum ('draft','submitted','under_review','approved','rejected');
  end if;
end$$;

-- --- BBC Reports (header) -----------------------------------------
create table if not exists public.borrowing_base_reports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  period_end date not null,                          -- as-of date
  status bbc_status not null default 'draft',
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_notes text,

  -- calculated / provided totals (denormalized for quick dashboards)
  gross_collateral numeric(16,2) not null default 0, -- e.g., AR total before ineligibles/haircuts
  ineligibles numeric(16,2) not null default 0,
  reserves numeric(16,2) not null default 0,
  advance_rate numeric(7,4) not null default 0.8000, -- 80% default
  borrowing_base numeric(16,2) not null default 0,   -- gross - ineligibles - reserves
  availability numeric(16,2) not null default 0,     -- min(credit_limit - principal, borrowing_base - principal)
  created_at timestamptz not null default now()
);

create index if not exists idx_bbc_facility_period on public.borrowing_base_reports(facility_id, period_end desc);
alter table public.borrowing_base_reports enable row level security;

-- Lenders: full access
drop policy if exists "bbc_reports_lender_all" on public.borrowing_base_reports;
create policy "bbc_reports_lender_all" on public.borrowing_base_reports
for all using (public.is_lender(auth.uid())) with check (public.is_lender(auth.uid()));

-- Borrowers: can insert/read only for their own facility
drop policy if exists "bbc_reports_borrower_insert" on public.borrowing_base_reports;
create policy "bbc_reports_borrower_insert" on public.borrowing_base_reports
for insert with check (
  public.is_borrower(auth.uid())
  and exists (
    select 1 from public.facilities f
    where f.id = borrowing_base_reports.facility_id
      and f.customer_id = public.user_customer_id(auth.uid())
  )
);

drop policy if exists "bbc_reports_borrower_read" on public.borrowing_base_reports;
create policy "bbc_reports_borrower_read" on public.borrowing_base_reports
for select using (
  public.is_borrower(auth.uid())
  and exists (
    select 1 from public.facilities f
    where f.id = borrowing_base_reports.facility_id
      and f.customer_id = public.user_customer_id(auth.uid())
  )
);

drop policy if exists "bbc_reports_borrower_update_own_drafts" on public.borrowing_base_reports;
create policy "bbc_reports_borrower_update_own_drafts" on public.borrowing_base_reports
for update using (
  public.is_borrower(auth.uid())
  and status in ('draft','submitted')  -- borrowers can tweak until lender locks it
  and exists (
    select 1 from public.facilities f
    where f.id = borrowing_base_reports.facility_id
      and f.customer_id = public.user_customer_id(auth.uid())
  )
);

-- --- BBC Line Items -----------------------------------------------
-- Flexible detail rows (e.g., AR by invoice/customer, inventory by SKU); keep type+tags open-ended
do $$
begin
  if not exists (select 1 from pg_type where typname='bbc_item_type') then
    create type bbc_item_type as enum ('accounts_receivable','inventory','cash','other');
  end if;
end$$;

create table if not exists public.borrowing_base_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.borrowing_base_reports(id) on delete cascade,
  item_type bbc_item_type not null default 'accounts_receivable',
  ref text,                       -- invoice #, customer name, sku, etc.
  note text,
  amount numeric(16,2) not null,  -- positive amount (gross value)
  ineligible boolean not null default false,
  haircut_rate numeric(7,4) not null default 0.0000, -- e.g., 0.20 = 20% haircut
  created_at timestamptz not null default now()
);

create index if not exists idx_bbc_items_report on public.borrowing_base_items(report_id);
alter table public.borrowing_base_items enable row level security;

-- Lenders: full access
drop policy if exists "bbc_items_lender_all" on public.borrowing_base_items;
create policy "bbc_items_lender_all" on public.borrowing_base_items
for all using (public.is_lender(auth.uid())) with check (public.is_lender(auth.uid()));

-- Borrowers: can manage items only for BBCs they own (their facility)
drop policy if exists "bbc_items_borrower_crud" on public.borrowing_base_items;
create policy "bbc_items_borrower_crud" on public.borrowing_base_items
for all using (
  public.is_borrower(auth.uid())
  and exists (
    select 1
    from public.borrowing_base_reports r
    join public.facilities f on f.id = r.facility_id
    where r.id = borrowing_base_items.report_id
      and f.customer_id = public.user_customer_id(auth.uid())
      and r.status in ('draft','submitted') -- editable until lender locks
  )
) with check (
  public.is_borrower(auth.uid())
  and exists (
    select 1
    from public.borrowing_base_reports r
    join public.facilities f on f.id = r.facility_id
    where r.id = borrowing_base_items.report_id
      and f.customer_id = public.user_customer_id(auth.uid())
      and r.status in ('draft','submitted')
  )
);

-- --- Helper function to recompute header totals -------------------
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
  -- get facility id + snapshot current APR/advance_rate (keep rate from header)
  select r.facility_id, r.advance_rate into v_fac, v_rate
  from public.borrowing_base_reports r
  where r.id = p_report;

  -- sum line items
  select
    coalesce(sum(amount),0),
    coalesce(sum(case when ineligible then amount else 0 end),0),
    0::numeric   -- placeholder reserves (you can add a reserves table/logic later)
  into v_gross, v_inel, v_reserves
  from public.borrowing_base_items
  where report_id = p_report;

  -- principal & credit limit
  select fp.principal_outstanding, f.credit_limit
  into v_principal, v_credit_limit
  from public.facility_principal fp
  join public.facilities f on f.id = fp.facility_id
  where fp.facility_id = v_fac;

  -- compute borrowing base & availability
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

-- Optional: trigger to auto-recalc on items change
drop trigger if exists trg_bbc_items_recalc on public.borrowing_base_items;
create trigger trg_bbc_items_recalc
after insert or update or delete on public.borrowing_base_items
for each row execute function public.recalc_bbc_header(
  case when tg_op in ('INSERT','UPDATE') then new.report_id else old.report_id end
);