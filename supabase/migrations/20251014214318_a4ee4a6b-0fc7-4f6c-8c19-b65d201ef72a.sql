-- Fix the handle_new_user trigger to not reference the non-existent role column
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert into profiles without role column
  INSERT INTO public.profiles (id, full_name, is_active)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;