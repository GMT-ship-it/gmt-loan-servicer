-- Enable Row Level Security on facility_principal table
ALTER TABLE public.facility_principal ENABLE ROW LEVEL SECURITY;

-- Create policy for lenders to access all facility principal data
CREATE POLICY "facility_principal_lender_all" 
ON public.facility_principal 
FOR ALL 
TO authenticated 
USING (is_lender(auth.uid()))
WITH CHECK (is_lender(auth.uid()));

-- Create policy for borrowers to access only their customer's facility principal data
CREATE POLICY "facility_principal_borrower_read_own" 
ON public.facility_principal 
FOR SELECT 
TO authenticated 
USING (
  is_borrower(auth.uid()) AND 
  EXISTS (
    SELECT 1 
    FROM facilities f 
    WHERE f.id = facility_principal.facility_id 
    AND f.customer_id = user_customer_id(auth.uid())
  )
);