-- Update RLS policy to allow public inserts for borrower_applications
-- Drop the existing policy that requires authentication
DROP POLICY IF EXISTS "applicant_can_insert_own" ON public.borrower_applications;

-- Create new policy that allows anyone to insert (public application form)
CREATE POLICY "anyone_can_submit_application"
ON public.borrower_applications
FOR INSERT
TO public
WITH CHECK (true);