-- Drop existing enum if needed and recreate
drop type if exists public.app_role cascade;
create type public.app_role as enum ('admin', 'analyst', 'borrower');

-- Create organizations table
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create user_roles table (for security)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- Create borrowers table
create table if not exists public.borrowers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  legal_name text not null,
  email text not null,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Create loans table
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  borrower_id uuid references public.borrowers(id) on delete cascade not null,
  loan_number text not null unique,
  principal numeric(18,2) not null,
  interest_rate numeric(8,6) not null,
  rate_type text check (rate_type in ('fixed', 'variable')) not null default 'fixed',
  index_name text,
  margin numeric(8,6),
  compounding_basis text check (compounding_basis in ('30/360', 'ACT/365')) not null default 'ACT/365',
  term_months integer not null,
  first_payment_date date not null,
  payment_frequency text check (payment_frequency in ('monthly', 'quarterly', 'annual')) not null default 'monthly',
  amortization_type text check (amortization_type in ('interest_only', 'amortizing', 'balloon')) not null default 'amortizing',
  interest_only_months integer default 0,
  balloon_date date,
  balloon_amount numeric(18,2),
  grace_days integer default 0,
  late_fee_type text check (late_fee_type in ('flat', 'percentage')),
  late_fee_amount numeric(18,2),
  origination_fee numeric(18,2),
  servicing_fee numeric(18,2),
  prepayment_penalty_rule jsonb,
  escrow_rules jsonb,
  covenants jsonb,
  status text check (status in ('active', 'paid_off', 'defaulted', 'closed')) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Create loan_documents table
create table if not exists public.loan_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  loan_id uuid references public.loans(id) on delete cascade,
  doc_type text not null,
  file_path text not null,
  parsed_json jsonb,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Create journal_entries table (double-entry ledger)
create table if not exists public.journal_entries (
  id bigserial primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  loan_id uuid references public.loans(id) on delete cascade,
  entry_date date not null,
  account_code text not null,
  amount numeric(18,2) not null,
  memo text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Create payment_methods table
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid references public.borrowers(id) on delete cascade not null,
  provider text not null,
  provider_ref text not null,
  last4 text,
  brand text,
  status text check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now()
);

-- Create payments table  
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references public.loans(id) on delete cascade not null,
  borrower_id uuid references public.borrowers(id) on delete cascade not null,
  provider text,
  provider_payment_id text,
  amount numeric(18,2) not null,
  status text check (status in ('pending', 'succeeded', 'failed', 'canceled')) default 'pending',
  breakdown jsonb,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

-- Create escrow_accounts table
create table if not exists public.escrow_accounts (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references public.loans(id) on delete cascade not null,
  balance numeric(18,2) default 0,
  created_at timestamptz not null default now()
);

-- Create escrow_transactions table
create table if not exists public.escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid references public.escrow_accounts(id) on delete cascade not null,
  tx_date date not null,
  amount numeric(18,2) not null,
  kind text check (kind in ('deposit', 'disbursement', 'adjustment')) not null,
  memo text,
  created_at timestamptz not null default now()
);

-- Create statements table
create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references public.loans(id) on delete cascade not null,
  period_start date not null,
  period_end date not null,
  pdf_path text not null,
  created_at timestamptz not null default now()
);

-- Create audit_logs table
create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS on all tables
alter table public.organizations enable row level security;
alter table public.user_roles enable row level security;
alter table public.borrowers enable row level security;
alter table public.loans enable row level security;
alter table public.loan_documents enable row level security;
alter table public.journal_entries enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;
alter table public.escrow_accounts enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.statements enable row level security;
alter table public.audit_logs enable row level security;

-- Create security definer functions
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create or replace function public.user_organization_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.user_roles
  where user_id = _user_id
  limit 1
$$;

create or replace function public.is_admin_or_analyst(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role in ('admin', 'analyst')
  )
$$;

-- RLS Policies
do $$
begin
  -- Organizations policies
  if not exists (select 1 from pg_policies where tablename = 'organizations' and policyname = 'Users can view their organization') then
    create policy "Users can view their organization"
      on public.organizations for select
      using (id = public.user_organization_id(auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'organizations' and policyname = 'Admins can manage organizations') then
    create policy "Admins can manage organizations"
      on public.organizations for all
      using (public.has_role(auth.uid(), 'admin'));
  end if;

  -- User roles policies
  if not exists (select 1 from pg_policies where tablename = 'user_roles' and policyname = 'Users can view roles in their org') then
    create policy "Users can view roles in their org"
      on public.user_roles for select
      using (organization_id = public.user_organization_id(auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'user_roles' and policyname = 'Admins can manage roles') then
    create policy "Admins can manage roles"
      on public.user_roles for all
      using (public.has_role(auth.uid(), 'admin'));
  end if;

  -- Borrowers policies
  if not exists (select 1 from pg_policies where tablename = 'borrowers' and policyname = 'Borrowers can view their own record') then
    create policy "Borrowers can view their own record"
      on public.borrowers for select
      using (
        public.has_role(auth.uid(), 'borrower') 
        and id in (
          select borrower_id from public.loans 
          where borrower_id = borrowers.id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'borrowers' and policyname = 'Admins and analysts can manage borrowers') then
    create policy "Admins and analysts can manage borrowers"
      on public.borrowers for all
      using (
        public.is_admin_or_analyst(auth.uid())
        and organization_id = public.user_organization_id(auth.uid())
      );
  end if;
end$$;