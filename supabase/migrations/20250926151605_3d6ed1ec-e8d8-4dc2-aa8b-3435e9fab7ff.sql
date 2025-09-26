-- Fix the get_facility_principal function to calculate principal directly from transactions
CREATE OR REPLACE FUNCTION public.get_facility_principal(p_facility_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(facility_id uuid, principal_outstanding numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH facility_principals AS (
    SELECT 
      t.facility_id,
      COALESCE(SUM(
        CASE 
          WHEN t.type IN ('advance','fee','letter_of_credit','dof','adjustment','interest') THEN t.amount
          WHEN t.type = 'payment' THEN -t.amount
          ELSE 0
        END
      ), 0) AS principal_outstanding
    FROM public.transactions t
    WHERE (p_facility_id IS NULL OR t.facility_id = p_facility_id)
    GROUP BY t.facility_id
  )
  SELECT 
    fp.facility_id,
    fp.principal_outstanding
  FROM facility_principals fp
  JOIN facilities f ON f.id = fp.facility_id
  WHERE (
    -- Lenders can see all
    is_lender(auth.uid()) OR 
    -- Borrowers can only see their own facilities
    (is_borrower(auth.uid()) AND f.customer_id = user_customer_id(auth.uid()))
  );
$function$;