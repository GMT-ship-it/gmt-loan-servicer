-- Lenders can update/delete (borrowers cannot)
drop policy if exists "draws_lender_update_delete" on public.draw_requests;
create policy "draws_lender_update_delete" on public.draw_requests
for update using (public.is_lender(auth.uid())) with check (public.is_lender(auth.uid()));

create policy "draws_lender_delete" on public.draw_requests
for delete using (public.is_lender(auth.uid()));

-- Auto-stamp created_by using a trigger (prevents spoofing)
create or replace function public.stamp_draw_created_by()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_draw_created_by on public.draw_requests;
create trigger trg_stamp_draw_created_by
before insert on public.draw_requests
for each row execute procedure public.stamp_draw_created_by();