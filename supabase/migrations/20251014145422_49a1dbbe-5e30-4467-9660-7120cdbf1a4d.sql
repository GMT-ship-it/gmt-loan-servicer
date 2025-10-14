-- Add remaining RLS policies for loans
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'loans' and policyname = 'Borrowers can view their own loans') then
    create policy "Borrowers can view their own loans"
      on public.loans for select
      using (
        public.has_role(auth.uid(), 'borrower')
        and borrower_id in (
          select b.id from public.borrowers b
          join public.user_roles ur on ur.user_id = auth.uid()
          where b.organization_id = ur.organization_id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'loans' and policyname = 'Admins and analysts can manage loans') then
    create policy "Admins and analysts can manage loans"
      on public.loans for all
      using (
        public.is_admin_or_analyst(auth.uid())
        and organization_id = public.user_organization_id(auth.uid())
      );
  end if;

  -- Loan documents policies
  if not exists (select 1 from pg_policies where tablename = 'loan_documents' and policyname = 'Users can view documents for accessible loans') then
    create policy "Users can view documents for accessible loans"
      on public.loan_documents for select
      using (
        loan_id in (
          select id from public.loans
          where (
            (public.has_role(auth.uid(), 'borrower') and borrower_id in (
              select b.id from public.borrowers b
              join public.user_roles ur on ur.user_id = auth.uid()
              where b.organization_id = ur.organization_id
            ))
            or public.is_admin_or_analyst(auth.uid())
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'loan_documents' and policyname = 'Admins and analysts can manage documents') then
    create policy "Admins and analysts can manage documents"
      on public.loan_documents for all
      using (
        public.is_admin_or_analyst(auth.uid())
        and organization_id = public.user_organization_id(auth.uid())
      );
  end if;

  -- Journal entries policies
  if not exists (select 1 from pg_policies where tablename = 'journal_entries' and policyname = 'Admins and analysts can view journal entries') then
    create policy "Admins and analysts can view journal entries"
      on public.journal_entries for select
      using (
        public.is_admin_or_analyst(auth.uid())
        and organization_id = public.user_organization_id(auth.uid())
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'journal_entries' and policyname = 'Admins can manage journal entries') then
    create policy "Admins can manage journal entries"
      on public.journal_entries for all
      using (
        public.has_role(auth.uid(), 'admin')
        and organization_id = public.user_organization_id(auth.uid())
      );
  end if;

  -- Payment methods policies
  if not exists (select 1 from pg_policies where tablename = 'payment_methods' and policyname = 'Borrowers can manage their payment methods') then
    create policy "Borrowers can manage their payment methods"
      on public.payment_methods for all
      using (
        borrower_id in (
          select b.id from public.borrowers b
          join public.user_roles ur on ur.user_id = auth.uid()
          where b.organization_id = ur.organization_id
            and public.has_role(auth.uid(), 'borrower')
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'payment_methods' and policyname = 'Admins can view payment methods') then
    create policy "Admins can view payment methods"
      on public.payment_methods for select
      using (public.is_admin_or_analyst(auth.uid()));
  end if;

  -- Payments policies
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'Borrowers can view their payments') then
    create policy "Borrowers can view their payments"
      on public.payments for select
      using (
        borrower_id in (
          select b.id from public.borrowers b
          join public.user_roles ur on ur.user_id = auth.uid()
          where b.organization_id = ur.organization_id
            and public.has_role(auth.uid(), 'borrower')
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'Admins and analysts can manage payments') then
    create policy "Admins and analysts can manage payments"
      on public.payments for all
      using (
        loan_id in (
          select id from public.loans
          where organization_id = public.user_organization_id(auth.uid())
        )
        and public.is_admin_or_analyst(auth.uid())
      );
  end if;

  -- Escrow accounts policies
  if not exists (select 1 from pg_policies where tablename = 'escrow_accounts' and policyname = 'Borrowers can view their escrow accounts') then
    create policy "Borrowers can view their escrow accounts"
      on public.escrow_accounts for select
      using (
        loan_id in (
          select id from public.loans
          where borrower_id in (
            select b.id from public.borrowers b
            join public.user_roles ur on ur.user_id = auth.uid()
            where b.organization_id = ur.organization_id
              and public.has_role(auth.uid(), 'borrower')
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'escrow_accounts' and policyname = 'Admins and analysts can manage escrow accounts') then
    create policy "Admins and analysts can manage escrow accounts"
      on public.escrow_accounts for all
      using (
        loan_id in (
          select id from public.loans
          where organization_id = public.user_organization_id(auth.uid())
        )
        and public.is_admin_or_analyst(auth.uid())
      );
  end if;

  -- Escrow transactions policies
  if not exists (select 1 from pg_policies where tablename = 'escrow_transactions' and policyname = 'Borrowers can view their escrow transactions') then
    create policy "Borrowers can view their escrow transactions"
      on public.escrow_transactions for select
      using (
        escrow_id in (
          select ea.id from public.escrow_accounts ea
          join public.loans l on l.id = ea.loan_id
          where l.borrower_id in (
            select b.id from public.borrowers b
            join public.user_roles ur on ur.user_id = auth.uid()
            where b.organization_id = ur.organization_id
              and public.has_role(auth.uid(), 'borrower')
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'escrow_transactions' and policyname = 'Admins and analysts can manage escrow transactions') then
    create policy "Admins and analysts can manage escrow transactions"
      on public.escrow_transactions for all
      using (
        escrow_id in (
          select ea.id from public.escrow_accounts ea
          join public.loans l on l.id = ea.loan_id
          where l.organization_id = public.user_organization_id(auth.uid())
        )
        and public.is_admin_or_analyst(auth.uid())
      );
  end if;

  -- Statements policies
  if not exists (select 1 from pg_policies where tablename = 'statements' and policyname = 'Borrowers can view their statements') then
    create policy "Borrowers can view their statements"
      on public.statements for select
      using (
        loan_id in (
          select id from public.loans
          where borrower_id in (
            select b.id from public.borrowers b
            join public.user_roles ur on ur.user_id = auth.uid()
            where b.organization_id = ur.organization_id
              and public.has_role(auth.uid(), 'borrower')
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'statements' and policyname = 'Admins and analysts can manage statements') then
    create policy "Admins and analysts can manage statements"
      on public.statements for all
      using (
        loan_id in (
          select id from public.loans
          where organization_id = public.user_organization_id(auth.uid())
        )
        and public.is_admin_or_analyst(auth.uid())
      );
  end if;

  -- Audit logs policies
  if not exists (select 1 from pg_policies where tablename = 'audit_logs' and policyname = 'Admins can view audit logs') then
    create policy "Admins can view audit logs"
      on public.audit_logs for select
      using (public.has_role(auth.uid(), 'admin'));
  end if;
end$$;

-- Create storage bucket for loan documents
insert into storage.buckets (id, name, public)
values ('loan-documents', 'loan-documents', false)
on conflict (id) do nothing;

-- Storage policies for loan documents
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins can upload documents') then
    create policy "Admins can upload documents"
      on storage.objects for insert
      with check (
        bucket_id = 'loan-documents'
        and public.is_admin_or_analyst(auth.uid())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins can view all documents') then
    create policy "Admins can view all documents"
      on storage.objects for select
      using (
        bucket_id = 'loan-documents'
        and public.is_admin_or_analyst(auth.uid())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Borrowers can view their documents') then
    create policy "Borrowers can view their documents"
      on storage.objects for select
      using (
        bucket_id = 'loan-documents'
        and (storage.foldername(name))[1] in (
          select l.id::text from public.loans l
          where l.borrower_id in (
            select b.id from public.borrowers b
            join public.user_roles ur on ur.user_id = auth.uid()
            where b.organization_id = ur.organization_id
              and public.has_role(auth.uid(), 'borrower')
          )
        )
      );
  end if;
end$$;

-- Create updated_at trigger function if not exists
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Add updated_at triggers
drop trigger if exists set_updated_at on public.organizations;
create trigger set_updated_at before update on public.organizations
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.borrowers;
create trigger set_updated_at before update on public.borrowers
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.loans;
create trigger set_updated_at before update on public.loans
  for each row execute function public.handle_updated_at();