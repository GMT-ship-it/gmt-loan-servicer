-- Fix the last function missing search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  insert into public.profiles (id, role, full_name, is_active)
  values (new.id, 'borrower_user', new.raw_user_meta_data->>'full_name', true)
  on conflict (id) do nothing;
  return new;
end;
$function$;