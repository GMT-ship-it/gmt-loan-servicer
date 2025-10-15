export type Role = "admin" | "analyst" | "borrower";

export type Borrower = {
  id: string;
  legal_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type Loan = {
  id: string;
  loan_number: string;
  borrower_id: string;
  organization_id: string;
  principal: number;
  interest_rate: number;
  rate_type: "fixed" | "variable";
  compounding_basis: string;
  payment_frequency: "monthly" | "biweekly" | "weekly";
  amortization_type: "amortizing" | "interest_only";
  term_months: number;
  first_payment_date: string;
  status: "active" | "paid_off" | "defaulted" | "charged_off";
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  loan_id: string;
  borrower_id: string;
  amount: number;
  status: "pending" | "succeeded" | "failed";
  provider?: string | null;
  provider_payment_id?: string | null;
  breakdown?: Record<string, any> | null;
  received_at?: string | null;
  created_at: string;
};

export type LoanDocument = {
  id: string;
  loan_id?: string | null;
  organization_id: string;
  doc_type: string;
  file_path: string;
  parsed_json?: Record<string, any> | null;
  uploaded_by?: string | null;
  created_at: string;
};
