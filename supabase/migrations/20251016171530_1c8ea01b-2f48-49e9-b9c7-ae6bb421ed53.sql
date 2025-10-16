-- Document request workflow tables

-- Document templates based on loan type and size
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  required_for_loan_types text[] DEFAULT ARRAY['working_capital', 'equipment_loan', 'equipment_lease']::text[],
  required_for_amount_min numeric DEFAULT 0,
  required_for_amount_max numeric DEFAULT NULL,
  is_mandatory boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Document requests for specific applications
CREATE TABLE IF NOT EXISTS public.document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  document_template_id uuid REFERENCES public.document_templates(id) ON DELETE CASCADE,
  custom_document_name text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'approved', 'rejected')),
  requested_by uuid REFERENCES auth.users(id),
  requested_at timestamptz DEFAULT now(),
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewer_notes text,
  due_date date,
  created_at timestamptz DEFAULT now()
);

-- Uploaded documents linked to requests
CREATE TABLE IF NOT EXISTS public.application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_request_id uuid NOT NULL REFERENCES public.document_requests(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  original_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_templates
CREATE POLICY "Lenders can manage document templates"
  ON public.document_templates FOR ALL
  USING (is_lender(auth.uid()))
  WITH CHECK (is_lender(auth.uid()));

CREATE POLICY "Borrowers can view document templates"
  ON public.document_templates FOR SELECT
  USING (is_borrower(auth.uid()));

-- RLS Policies for document_requests
CREATE POLICY "Lenders can manage document requests"
  ON public.document_requests FOR ALL
  USING (is_lender(auth.uid()))
  WITH CHECK (is_lender(auth.uid()));

CREATE POLICY "Borrowers can view their document requests"
  ON public.document_requests FOR SELECT
  USING (
    is_borrower(auth.uid()) AND 
    customer_id = user_customer_id(auth.uid())
  );

CREATE POLICY "Borrowers can update their document request status"
  ON public.document_requests FOR UPDATE
  USING (
    is_borrower(auth.uid()) AND 
    customer_id = user_customer_id(auth.uid())
  );

-- RLS Policies for application_documents
CREATE POLICY "Lenders can view all application documents"
  ON public.application_documents FOR SELECT
  USING (is_lender(auth.uid()));

CREATE POLICY "Borrowers can manage their documents"
  ON public.application_documents FOR ALL
  USING (
    is_borrower(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.document_requests dr
      WHERE dr.id = application_documents.document_request_id
        AND dr.customer_id = user_customer_id(auth.uid())
    )
  )
  WITH CHECK (
    is_borrower(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.document_requests dr
      WHERE dr.id = application_documents.document_request_id
        AND dr.customer_id = user_customer_id(auth.uid())
    )
  );

-- Insert default document templates
INSERT INTO public.document_templates (name, description, required_for_loan_types, required_for_amount_min, is_mandatory) VALUES
  ('Business Financial Statements', 'Last 3 years of business financial statements', ARRAY['working_capital', 'equipment_loan', 'equipment_lease']::text[], 0, true),
  ('Business Tax Returns', 'Last 3 years of business tax returns', ARRAY['working_capital', 'equipment_loan', 'equipment_lease']::text[], 0, true),
  ('Personal Financial Statement', 'Personal financial statement of guarantors', ARRAY['working_capital', 'equipment_loan', 'equipment_lease']::text[], 100000, true),
  ('Personal Tax Returns', 'Last 2 years of personal tax returns of guarantors', ARRAY['working_capital', 'equipment_loan', 'equipment_lease']::text[], 250000, true),
  ('Accounts Receivable Aging', 'Current A/R aging report (for working capital)', ARRAY['working_capital']::text[], 0, true),
  ('Accounts Payable Aging', 'Current A/P aging report (for working capital)', ARRAY['working_capital']::text[], 0, true),
  ('Inventory Report', 'Current inventory listing with values', ARRAY['working_capital']::text[], 100000, true),
  ('Equipment Appraisal', 'Independent appraisal of equipment', ARRAY['equipment_loan', 'equipment_lease']::text[], 250000, true),
  ('Equipment Invoice/Quote', 'Invoice or quote for equipment being financed', ARRAY['equipment_loan', 'equipment_lease']::text[], 0, true),
  ('Business Plan', 'Current business plan or expansion plan', ARRAY['working_capital']::text[], 500000, false),
  ('Bank Statements', 'Last 6 months of business bank statements', ARRAY['working_capital', 'equipment_loan', 'equipment_lease']::text[], 0, true),
  ('Articles of Incorporation', 'Certificate of incorporation and bylaws', ARRAY['working_capital', 'equipment_loan', 'equipment_lease']::text[], 0, true);

-- Create storage bucket for application documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for application documents (with unique names)
CREATE POLICY "Lenders view application-documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents' AND
    is_lender(auth.uid())
  );

CREATE POLICY "Borrowers upload application-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-documents' AND
    is_borrower(auth.uid()) AND
    (storage.foldername(name))[1] = user_customer_id(auth.uid())::text
  );

CREATE POLICY "Borrowers view application-documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents' AND
    is_borrower(auth.uid()) AND
    (storage.foldername(name))[1] = user_customer_id(auth.uid())::text
  );

CREATE POLICY "Borrowers delete application-documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'application-documents' AND
    is_borrower(auth.uid()) AND
    (storage.foldername(name))[1] = user_customer_id(auth.uid())::text
  );