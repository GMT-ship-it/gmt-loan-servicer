-- Fix remaining function security warning
CREATE OR REPLACE FUNCTION public.stamp_draw_created_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$function$;