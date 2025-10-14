-- Helper function to get principal outstanding as of a specific date
create or replace function public.principal_outstanding_asof(p_loan_id uuid, p_asof date)
returns numeric
language sql
stable
set search_path = public
as $$
  with base as (
    select l.principal::numeric as starting_principal
    from loans l where l.id = p_loan_id
  ),
  paid as (
    select coalesce(sum((p.breakdown->>'principal')::numeric), 0) as principal_paid
    from payments p
    where p.loan_id = p_loan_id
      and p.status = 'succeeded'
      and p.received_at::date <= p_asof
  )
  select greatest((b.starting_principal - p.principal_paid), 0)
  from base b cross join paid p;
$$;

-- Create storage bucket for statements (private)
insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

-- RLS policies for statements bucket
create policy "Lenders can manage statement files"
on storage.objects for all
using (
  bucket_id = 'statements' 
  and is_lender(auth.uid())
)
with check (
  bucket_id = 'statements' 
  and is_lender(auth.uid())
);

create policy "Borrowers can view their statement files"
on storage.objects for select
using (
  bucket_id = 'statements' 
  and is_borrower(auth.uid())
  and (storage.foldername(name))[1] in (
    select l.id::text
    from loans l
    where l.borrower_id in (
      select b.id from borrowers b
      join user_roles ur on ur.user_id = auth.uid()
      where b.organization_id = ur.organization_id
        and has_role(auth.uid(), 'borrower'::app_role)
    )
  )
);