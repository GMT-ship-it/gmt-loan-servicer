-- Enable RLS on escrow_settings table
alter table public.escrow_settings enable row level security;

-- RLS policies for escrow_settings
create policy "escrow_settings_lender_all"
  on public.escrow_settings
  for all
  using (is_lender(auth.uid()))
  with check (is_lender(auth.uid()));

create policy "escrow_settings_borrower_read"
  on public.escrow_settings
  for select
  using (
    is_borrower(auth.uid()) and
    exists (
      select 1 from loans l
      where l.id = escrow_settings.loan_id
        and l.borrower_id in (
          select b.id from borrowers b
          join user_roles ur on ur.user_id = auth.uid()
          where b.organization_id = ur.organization_id
        )
    )
  );