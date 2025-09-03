-- 1) PRIVATE bucket for all customer documents (PDFs, images, xlsx, etc.)
-- Safe to re-run; it will no-op if the bucket exists.
insert into storage.buckets (id, name, public) values ('summitline-docs', 'summitline-docs', false)
on conflict (id) do nothing;

-- 2) Document metadata table: one row per uploaded file, linked to a draw request
create table if not exists public.draw_documents (
  id uuid primary key default gen_random_uuid(),
  draw_request_id uuid not null references public.draw_requests(id) on delete cascade,
  path text not null unique,   -- storage object key (e.g., draws/<draw_id>/<filename>.pdf)
  original_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

alter table public.draw_documents enable row level security;

-- Lenders can see/manage all document metadata
drop policy if exists "draw_docs_lender_all" on public.draw_documents;
create policy "draw_docs_lender_all" on public.draw_documents
for all using (public.is_lender(auth.uid()))
with check (public.is_lender(auth.uid()));

-- Borrowers: can insert and read only docs tied to their own facility's draw requests
drop policy if exists "draw_docs_borrower_insert" on public.draw_documents;
create policy "draw_docs_borrower_insert" on public.draw_documents
for insert with check (
  public.is_borrower(auth.uid()) and exists (
    select 1
    from public.draw_requests dr
    join public.facilities f on f.id = dr.facility_id
    where dr.id = draw_documents.draw_request_id
      and f.customer_id = public.user_customer_id(auth.uid())
  )
);

drop policy if exists "draw_docs_borrower_read" on public.draw_documents;
create policy "draw_docs_borrower_read" on public.draw_documents
for select using (
  public.is_borrower(auth.uid()) and exists (
    select 1
    from public.draw_requests dr
    join public.facilities f on f.id = dr.facility_id
    where dr.id = draw_documents.draw_request_id
      and f.customer_id = public.user_customer_id(auth.uid())
  )
);

-- Optional: stamp uploader automatically (prevents spoofing uploaded_by)
create or replace function public.stamp_draw_doc_uploader()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_draw_doc_uploader on public.draw_documents;
create trigger trg_stamp_draw_doc_uploader
before insert on public.draw_documents
for each row execute procedure public.stamp_draw_doc_uploader();

-- 3) STORAGE access policies (bucket: summitline-docs)
-- NOTE: These govern the actual file bytes in storage.objects.

-- Lenders: full read/write in this private bucket
drop policy if exists "storage_lender_read" on storage.objects;
create policy "storage_lender_read" on storage.objects
for select using (
  bucket_id = 'summitline-docs' and public.is_lender(auth.uid())
);

drop policy if exists "storage_lender_write" on storage.objects;
create policy "storage_lender_write" on storage.objects
for insert with check (bucket_id = 'summitline-docs' and public.is_lender(auth.uid()));

drop policy if exists "storage_lender_delete" on storage.objects;
create policy "storage_lender_delete" on storage.objects
for delete using (
  bucket_id = 'summitline-docs' and public.is_lender(auth.uid())
);

-- Borrowers: allow upload & read, but only for objects referenced in draw_documents
-- (We link access to metadata row by matching storage.objects.name to draw_documents.path)

drop policy if exists "storage_borrower_read" on storage.objects;
create policy "storage_borrower_read" on storage.objects
for select using (
  bucket_id = 'summitline-docs' and public.is_borrower(auth.uid()) and exists (
    select 1
    from public.draw_documents dd
    join public.draw_requests dr on dr.id = dd.draw_request_id
    join public.facilities f on f.id = dr.facility_id
    where dd.path = storage.objects.name
      and f.customer_id = public.user_customer_id(auth.uid())
  )
);

drop policy if exists "storage_borrower_insert" on storage.objects;
create policy "storage_borrower_insert" on storage.objects
for insert with check (
  bucket_id = 'summitline-docs' and public.is_borrower(auth.uid()) and exists (
    select 1
    from public.draw_documents dd
    join public.draw_requests dr on dr.id = dd.draw_request_id
    join public.facilities f on f.id = dr.facility_id
    where dd.path = storage.objects.name
      and f.customer_id = public.user_customer_id(auth.uid())
  )
);