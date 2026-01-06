export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      adjustments: {
        Row: {
          adj_date: string
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          journal_entry_id: number | null
          kind: string
          loan_id: string | null
          memo: string | null
        }
        Insert: {
          adj_date: string
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          journal_entry_id?: number | null
          kind: string
          loan_id?: string | null
          memo?: string | null
        }
        Update: {
          adj_date?: string
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          journal_entry_id?: number | null
          kind?: string
          loan_id?: string | null
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "adjustments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "adjustments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "adjustments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      application_documents: {
        Row: {
          document_request_id: string
          file_path: string
          id: string
          mime_type: string | null
          original_name: string | null
          size_bytes: number | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          document_request_id: string
          file_path: string
          id?: string
          mime_type?: string | null
          original_name?: string | null
          size_bytes?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          document_request_id?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          original_name?: string | null
          size_bytes?: number | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_document_request_id_fkey"
            columns: ["document_request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      assessed_fees: {
        Row: {
          amount: number
          assessed_date: string
          created_at: string | null
          due_date: string
          id: string
          installment_no: number
          journal_entry_id: number | null
          loan_id: string | null
          status: string | null
          waiver_journal_entry_id: number | null
        }
        Insert: {
          amount: number
          assessed_date: string
          created_at?: string | null
          due_date: string
          id?: string
          installment_no: number
          journal_entry_id?: number | null
          loan_id?: string | null
          status?: string | null
          waiver_journal_entry_id?: number | null
        }
        Update: {
          amount?: number
          assessed_date?: string
          created_at?: string | null
          due_date?: string
          id?: string
          installment_no?: number
          journal_entry_id?: number | null
          loan_id?: string | null
          status?: string | null
          waiver_journal_entry_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessed_fees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "assessed_fees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "assessed_fees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessed_fees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "assessed_fees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          new_values: Json | null
          old_values: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      borrower_applications: {
        Row: {
          business_address: string | null
          company_name: string
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string
          id: string
          industry: string | null
          phone: string | null
          purpose: string | null
          requested_amount: number
          title: string | null
        }
        Insert: {
          business_address?: string | null
          company_name: string
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          industry?: string | null
          phone?: string | null
          purpose?: string | null
          requested_amount: number
          title?: string | null
        }
        Update: {
          business_address?: string | null
          company_name?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          industry?: string | null
          phone?: string | null
          purpose?: string | null
          requested_amount?: number
          title?: string | null
        }
        Relationships: []
      }
      borrowers: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          legal_name: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          legal_name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          legal_name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrowers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      borrowing_base_items: {
        Row: {
          amount: number
          created_at: string
          haircut_rate: number
          id: string
          ineligible: boolean
          item_type: Database["public"]["Enums"]["bbc_item_type"]
          note: string | null
          ref: string | null
          report_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          haircut_rate?: number
          id?: string
          ineligible?: boolean
          item_type?: Database["public"]["Enums"]["bbc_item_type"]
          note?: string | null
          ref?: string | null
          report_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          haircut_rate?: number
          id?: string
          ineligible?: boolean
          item_type?: Database["public"]["Enums"]["bbc_item_type"]
          note?: string | null
          ref?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrowing_base_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "borrowing_base_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      borrowing_base_reports: {
        Row: {
          advance_rate: number
          availability: number
          borrowing_base: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          facility_id: string
          gross_collateral: number
          id: string
          ineligibles: number
          period_end: string
          reserves: number
          status: Database["public"]["Enums"]["bbc_status"]
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          advance_rate?: number
          availability?: number
          borrowing_base?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          facility_id: string
          gross_collateral?: number
          id?: string
          ineligibles?: number
          period_end: string
          reserves?: number
          status?: Database["public"]["Enums"]["bbc_status"]
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          advance_rate?: number
          availability?: number
          borrowing_base?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          facility_id?: string
          gross_collateral?: number
          id?: string
          ineligibles?: number
          period_end?: string
          reserves?: number
          status?: Database["public"]["Enums"]["bbc_status"]
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrowing_base_reports_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      covenant_breaches: {
        Row: {
          acknowledged_by: string | null
          cleared_by: string | null
          closed_at: string | null
          covenant_id: string | null
          created_at: string
          facility_id: string
          id: string
          kind: string
          notes: string | null
          observed_value: number
          opened_at: string
          status: string
          threshold_value: number
          waived_by: string | null
        }
        Insert: {
          acknowledged_by?: string | null
          cleared_by?: string | null
          closed_at?: string | null
          covenant_id?: string | null
          created_at?: string
          facility_id: string
          id?: string
          kind: string
          notes?: string | null
          observed_value: number
          opened_at?: string
          status?: string
          threshold_value: number
          waived_by?: string | null
        }
        Update: {
          acknowledged_by?: string | null
          cleared_by?: string | null
          closed_at?: string | null
          covenant_id?: string | null
          created_at?: string
          facility_id?: string
          id?: string
          kind?: string
          notes?: string | null
          observed_value?: number
          opened_at?: string
          status?: string
          threshold_value?: number
          waived_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          application_status: string | null
          created_at: string
          financing_purpose: string | null
          id: string
          legal_name: string
          region: string | null
          requested_amount: number | null
          sector: Database["public"]["Enums"]["industry_sector"] | null
          tax_id: string | null
        }
        Insert: {
          address?: string | null
          application_status?: string | null
          created_at?: string
          financing_purpose?: string | null
          id?: string
          legal_name: string
          region?: string | null
          requested_amount?: number | null
          sector?: Database["public"]["Enums"]["industry_sector"] | null
          tax_id?: string | null
        }
        Update: {
          address?: string | null
          application_status?: string | null
          created_at?: string
          financing_purpose?: string | null
          id?: string
          legal_name?: string
          region?: string | null
          requested_amount?: number | null
          sector?: Database["public"]["Enums"]["industry_sector"] | null
          tax_id?: string | null
        }
        Relationships: []
      }
      document_requests: {
        Row: {
          created_at: string | null
          custom_document_name: string | null
          customer_id: string
          document_template_id: string | null
          due_date: string | null
          id: string
          requested_at: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string | null
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_document_name?: string | null
          customer_id: string
          document_template_id?: string | null
          due_date?: string | null
          id?: string
          requested_at?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_document_name?: string | null
          customer_id?: string
          document_template_id?: string | null
          due_date?: string | null
          id?: string
          requested_at?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_document_template_id_fkey"
            columns: ["document_template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_mandatory: boolean | null
          name: string
          required_for_amount_max: number | null
          required_for_amount_min: number | null
          required_for_loan_types: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          name: string
          required_for_amount_max?: number | null
          required_for_amount_min?: number | null
          required_for_loan_types?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          name?: string
          required_for_amount_max?: number | null
          required_for_amount_min?: number | null
          required_for_loan_types?: string[] | null
        }
        Relationships: []
      }
      draw_documents: {
        Row: {
          draw_request_id: string
          id: string
          mime_type: string | null
          original_name: string | null
          path: string
          size_bytes: number | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          draw_request_id: string
          id?: string
          mime_type?: string | null
          original_name?: string | null
          path: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          draw_request_id?: string
          id?: string
          mime_type?: string | null
          original_name?: string | null
          path?: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draw_documents_draw_request_id_fkey"
            columns: ["draw_request_id"]
            isOneToOne: false
            referencedRelation: "draw_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_requests: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          facility_id: string
          id: string
          required_docs_ok: boolean
          status: Database["public"]["Enums"]["decision_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          facility_id: string
          id?: string
          required_docs_ok?: boolean
          status?: Database["public"]["Enums"]["decision_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          facility_id?: string
          id?: string
          required_docs_ok?: boolean
          status?: Database["public"]["Enums"]["decision_status"]
        }
        Relationships: [
          {
            foreignKeyName: "draw_requests_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_accounts: {
        Row: {
          balance: number | null
          created_at: string
          id: string
          loan_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string
          id?: string
          loan_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string
          id?: string
          loan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      escrow_settings: {
        Row: {
          cushion_months: number | null
          loan_id: string
          proj_ins_annual: number | null
          proj_tax_annual: number | null
          updated_at: string | null
        }
        Insert: {
          cushion_months?: number | null
          loan_id: string
          proj_ins_annual?: number | null
          proj_tax_annual?: number | null
          updated_at?: string | null
        }
        Update: {
          cushion_months?: number | null
          loan_id?: string
          proj_ins_annual?: number | null
          proj_tax_annual?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_settings_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_settings_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_settings_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_settings_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_settings_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount: number
          created_at: string
          escrow_id: string
          id: string
          kind: string
          memo: string | null
          tx_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          escrow_id: string
          id?: string
          kind: string
          memo?: string | null
          tx_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          escrow_id?: string
          id?: string
          kind?: string
          memo?: string | null
          tx_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrow_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrow_summary"
            referencedColumns: ["escrow_id"]
          },
        ]
      }
      facilities: {
        Row: {
          apr: number
          created_at: string
          created_by: string | null
          credit_limit: number
          customer_id: string
          id: string
          min_advance: number
          status: Database["public"]["Enums"]["facility_status"]
          type: Database["public"]["Enums"]["facility_type"]
        }
        Insert: {
          apr?: number
          created_at?: string
          created_by?: string | null
          credit_limit: number
          customer_id: string
          id?: string
          min_advance?: number
          status?: Database["public"]["Enums"]["facility_status"]
          type?: Database["public"]["Enums"]["facility_type"]
        }
        Update: {
          apr?: number
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          customer_id?: string
          id?: string
          min_advance?: number
          status?: Database["public"]["Enums"]["facility_status"]
          type?: Database["public"]["Enums"]["facility_type"]
        }
        Relationships: [
          {
            foreignKeyName: "facilities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_covenants: {
        Row: {
          bbc_valid_days: number
          created_at: string
          facility_id: string
          id: string
          is_active: boolean | null
          kind: string | null
          max_utilization_pct: number
          require_monthly_bbc: boolean
          require_monthly_statement: boolean
          threshold: number | null
          updated_at: string
        }
        Insert: {
          bbc_valid_days?: number
          created_at?: string
          facility_id: string
          id?: string
          is_active?: boolean | null
          kind?: string | null
          max_utilization_pct?: number
          require_monthly_bbc?: boolean
          require_monthly_statement?: boolean
          threshold?: number | null
          updated_at?: string
        }
        Update: {
          bbc_valid_days?: number
          created_at?: string
          facility_id?: string
          id?: string
          is_active?: boolean | null
          kind?: string | null
          max_utilization_pct?: number
          require_monthly_bbc?: boolean
          require_monthly_statement?: boolean
          threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_covenants_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_counterparties: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_entities: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_instrument_daily_positions: {
        Row: {
          accrued_interest_balance: number
          as_of_date: string
          created_at: string
          id: string
          instrument_id: string
          interest_accrued_today: number
          principal_outstanding: number
        }
        Insert: {
          accrued_interest_balance?: number
          as_of_date: string
          created_at?: string
          id?: string
          instrument_id: string
          interest_accrued_today?: number
          principal_outstanding?: number
        }
        Update: {
          accrued_interest_balance?: number
          as_of_date?: string
          created_at?: string
          id?: string
          instrument_id?: string
          interest_accrued_today?: number
          principal_outstanding?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_instrument_daily_positions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "fin_instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_instruments: {
        Row: {
          counterparty_id: string
          created_at: string
          day_count_basis: string
          entity_id: string
          id: string
          instrument_type: string
          interest_method: string
          maturity_date: string | null
          name: string
          principal_initial: number
          rate_apr: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          counterparty_id: string
          created_at?: string
          day_count_basis?: string
          entity_id: string
          id?: string
          instrument_type: string
          interest_method?: string
          maturity_date?: string | null
          name: string
          principal_initial: number
          rate_apr: number
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          counterparty_id?: string
          created_at?: string
          day_count_basis?: string
          entity_id?: string
          id?: string
          instrument_type?: string
          interest_method?: string
          maturity_date?: string | null
          name?: string
          principal_initial?: number
          rate_apr?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_instruments_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "fin_counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_instruments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "fin_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_interest_accrual_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          run_date: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          run_date: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          run_date?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      fin_transaction_lines: {
        Row: {
          account_id: string
          counterparty_id: string | null
          created_at: string
          credit: number | null
          debit: number | null
          id: string
          instrument_id: string | null
          transaction_id: string
        }
        Insert: {
          account_id: string
          counterparty_id?: string | null
          created_at?: string
          credit?: number | null
          debit?: number | null
          id?: string
          instrument_id?: string | null
          transaction_id: string
        }
        Update: {
          account_id?: string
          counterparty_id?: string | null
          created_at?: string
          credit?: number | null
          debit?: number | null
          id?: string
          instrument_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_transaction_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transaction_lines_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "fin_counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transaction_lines_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "fin_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transaction_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "fin_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          entity_id: string
          external_ref: string | null
          id: string
          memo: string | null
          source: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          entity_id: string
          external_ref?: string | null
          id?: string
          memo?: string | null
          source?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          entity_id?: string
          external_ref?: string | null
          id?: string
          memo?: string | null
          source?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_transactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "fin_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          account_code: string
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          id: number
          loan_id: string | null
          memo: string | null
          organization_id: string
        }
        Insert: {
          account_code: string
          amount: number
          created_at?: string
          created_by?: string | null
          entry_date: string
          id?: number
          loan_id?: string | null
          memo?: string | null
          organization_id: string
        }
        Update: {
          account_code?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: number
          loan_id?: string | null
          memo?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_path: string
          id: string
          loan_id: string | null
          organization_id: string
          parsed_json: Json | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_path: string
          id?: string
          loan_id?: string | null
          organization_id: string
          parsed_json?: Json | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_path?: string
          id?: string
          loan_id?: string | null
          organization_id?: string
          parsed_json?: Json | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_documents_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_documents_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_documents_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_documents_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_documents_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_schedules: {
        Row: {
          amount_due: number
          created_at: string | null
          due_date: string
          escrow_portion: number | null
          id: string
          installment_no: number
          interest_portion: number
          loan_id: string | null
          principal_portion: number
        }
        Insert: {
          amount_due: number
          created_at?: string | null
          due_date: string
          escrow_portion?: number | null
          id?: string
          installment_no: number
          interest_portion?: number
          loan_id?: string | null
          principal_portion?: number
        }
        Update: {
          amount_due?: number
          created_at?: string | null
          due_date?: string
          escrow_portion?: number | null
          id?: string
          installment_no?: number
          interest_portion?: number
          loan_id?: string | null
          principal_portion?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_schedules_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_schedules_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_schedules_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_schedules_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "loan_schedules_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loans: {
        Row: {
          amortization_type: string
          balloon_amount: number | null
          balloon_date: string | null
          borrower_id: string
          compounding_basis: string
          covenants: Json | null
          created_at: string
          deleted_at: string | null
          escrow_cushion_required: number | null
          escrow_monthly_required: number | null
          escrow_rules: Json | null
          first_payment_date: string
          grace_days: number | null
          id: string
          index_name: string | null
          interest_only_months: number | null
          interest_rate: number
          last_accrual_date: string | null
          late_fee_amount: number | null
          late_fee_type: string | null
          loan_number: string
          margin: number | null
          non_accrual: boolean | null
          organization_id: string
          origination_fee: number | null
          payment_frequency: string
          prepayment_penalty_rule: Json | null
          principal: number
          rate_type: string
          servicing_fee: number | null
          status: string
          term_months: number
          updated_at: string
        }
        Insert: {
          amortization_type?: string
          balloon_amount?: number | null
          balloon_date?: string | null
          borrower_id: string
          compounding_basis?: string
          covenants?: Json | null
          created_at?: string
          deleted_at?: string | null
          escrow_cushion_required?: number | null
          escrow_monthly_required?: number | null
          escrow_rules?: Json | null
          first_payment_date: string
          grace_days?: number | null
          id?: string
          index_name?: string | null
          interest_only_months?: number | null
          interest_rate: number
          last_accrual_date?: string | null
          late_fee_amount?: number | null
          late_fee_type?: string | null
          loan_number: string
          margin?: number | null
          non_accrual?: boolean | null
          organization_id: string
          origination_fee?: number | null
          payment_frequency?: string
          prepayment_penalty_rule?: Json | null
          principal: number
          rate_type?: string
          servicing_fee?: number | null
          status?: string
          term_months: number
          updated_at?: string
        }
        Update: {
          amortization_type?: string
          balloon_amount?: number | null
          balloon_date?: string | null
          borrower_id?: string
          compounding_basis?: string
          covenants?: Json | null
          created_at?: string
          deleted_at?: string | null
          escrow_cushion_required?: number | null
          escrow_monthly_required?: number | null
          escrow_rules?: Json | null
          first_payment_date?: string
          grace_days?: number | null
          id?: string
          index_name?: string | null
          interest_only_months?: number | null
          interest_rate?: number
          last_accrual_date?: string | null
          late_fee_amount?: number | null
          late_fee_type?: string | null
          loan_number?: string
          margin?: number | null
          non_accrual?: boolean | null
          organization_id?: string
          origination_fee?: number | null
          payment_frequency?: string
          prepayment_penalty_rule?: Json | null
          principal?: number
          rate_type?: string
          servicing_fee?: number | null
          status?: string
          term_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["borrower_id"]
          },
          {
            foreignKeyName: "loans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          borrower_id: string
          brand: string | null
          created_at: string
          id: string
          last4: string | null
          provider: string
          provider_ref: string
          status: string | null
        }
        Insert: {
          borrower_id: string
          brand?: string | null
          created_at?: string
          id?: string
          last4?: string | null
          provider: string
          provider_ref: string
          status?: string | null
        }
        Update: {
          borrower_id?: string
          brand?: string | null
          created_at?: string
          id?: string
          last4?: string | null
          provider?: string
          provider_ref?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["borrower_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          borrower_id: string
          breakdown: Json | null
          created_at: string
          id: string
          loan_id: string
          provider: string | null
          provider_payment_id: string | null
          received_at: string | null
          status: string | null
        }
        Insert: {
          amount: number
          borrower_id: string
          breakdown?: Json | null
          created_at?: string
          id?: string
          loan_id: string
          provider?: string | null
          provider_payment_id?: string | null
          received_at?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          borrower_id?: string
          breakdown?: Json | null
          created_at?: string
          id?: string
          loan_id?: string
          provider?: string | null
          provider_payment_id?: string | null
          received_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["borrower_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      pmd_assets: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          name: string
          project_id: string
          sale_value_assumption: number
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          name: string
          project_id: string
          sale_value_assumption?: number
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sale_value_assumption?: number
        }
        Relationships: [
          {
            foreignKeyName: "pmd_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pmd_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pmd_capital_events: {
        Row: {
          amount: number
          created_at: string
          event_date: string
          event_type: string
          id: string
          interest_flag: boolean
          interest_rate_override: number | null
          memo: string | null
          project_id: string
          provider_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          event_date: string
          event_type: string
          id?: string
          interest_flag?: boolean
          interest_rate_override?: number | null
          memo?: string | null
          project_id: string
          provider_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          interest_flag?: boolean
          interest_rate_override?: number | null
          memo?: string | null
          project_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pmd_capital_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pmd_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pmd_capital_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "pmd_capital_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      pmd_capital_providers: {
        Row: {
          created_at: string
          default_interest_rate: number
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          default_interest_rate?: number
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          default_interest_rate?: number
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      pmd_projects: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          customer_id: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          title?: string | null
        }
        Relationships: []
      }
      statements: {
        Row: {
          created_at: string
          id: string
          loan_id: string
          pdf_path: string
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          loan_id: string
          pdf_path: string
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          id?: string
          loan_id?: string
          pdf_path?: string
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "statements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "statements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "statements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "statements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          draw_request_id: string | null
          effective_at: string
          facility_id: string
          id: string
          memo: string | null
          type: Database["public"]["Enums"]["txn_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          draw_request_id?: string | null
          effective_at: string
          facility_id: string
          id?: string
          memo?: string | null
          type: Database["public"]["Enums"]["txn_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          draw_request_id?: string | null
          effective_at?: string
          facility_id?: string
          id?: string
          memo?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_draw_request_id_fkey"
            columns: ["draw_request_id"]
            isOneToOne: false
            referencedRelation: "draw_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      escrow_summary: {
        Row: {
          deposits_total: number | null
          disbursements_total: number | null
          escrow_balance: number | null
          escrow_id: string | null
          loan_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "escrow_accounts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loan_balances_snapshot: {
        Row: {
          escrow_payable: number | null
          fee_receivable: number | null
          interest_receivable: number | null
          loan_id: string | null
          principal_outstanding: number | null
          unapplied_cash: number | null
        }
        Insert: {
          escrow_payable?: never
          fee_receivable?: never
          interest_receivable?: never
          loan_id?: string | null
          principal_outstanding?: never
          unapplied_cash?: never
        }
        Update: {
          escrow_payable?: never
          fee_receivable?: never
          interest_receivable?: never
          loan_id?: string | null
          principal_outstanding?: never
          unapplied_cash?: never
        }
        Relationships: []
      }
      loan_delinquency_summary: {
        Row: {
          bucket: string | null
          days_past_due: number | null
          loan_id: string | null
          next_due_date: string | null
          past_due_amount: number | null
          scheduled_through_yday: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      loan_recent_payments: {
        Row: {
          amount: number | null
          fees: number | null
          interest: number | null
          loan_id: string | null
          paid_date: string | null
          payment_id: string | null
          principal: number | null
        }
        Insert: {
          amount?: number | null
          fees?: never
          interest?: never
          loan_id?: string | null
          paid_date?: never
          payment_id?: string | null
          principal?: never
        }
        Update: {
          amount?: number | null
          fees?: never
          interest?: never
          loan_id?: string | null
          paid_date?: never
          payment_id?: string | null
          principal?: never
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      portfolio_dashboard: {
        Row: {
          accrued_interest: number | null
          borrower_id: string | null
          bucket: string | null
          days_past_due: number | null
          loan_id: string | null
          loan_number: string | null
          maturity_date: string | null
          next_due_date: string | null
          origination_date: string | null
          past_due_amount: number | null
          principal_outstanding: number | null
          rate: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["borrower_id"]
          },
        ]
      }
      v_borrower_activity: {
        Row: {
          borrower_id: string | null
          entry_date: string | null
          escrow_deposited: number | null
          escrow_disbursed: number | null
          fees_paid: number | null
          full_name: string | null
          interest_paid: number | null
          loan_id: string | null
          loan_number: string | null
          principal_paid: number | null
        }
        Relationships: []
      }
      v_gl_entries: {
        Row: {
          account_code: string | null
          credit: number | null
          debit: number | null
          entry_date: string | null
          journal_id: number | null
          loan_id: string | null
          loan_number: string | null
          memo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "journal_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      v_payment_register: {
        Row: {
          amount_total: number | null
          fees: number | null
          interest: number | null
          loan_id: string | null
          loan_number: string | null
          payment_id: string | null
          principal: number | null
          received_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_balances_snapshot"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loan_delinquency_summary"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "portfolio_dashboard"
            referencedColumns: ["loan_id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_borrower_activity"
            referencedColumns: ["loan_id"]
          },
        ]
      }
    }
    Functions: {
      accrue_interest_for_loan: {
        Args: { p_asof: string; p_days: number; p_loan_id: string }
        Returns: undefined
      }
      accrued_interest: { Args: { p_loan_id: string }; Returns: number }
      apply_payment_waterfall: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      assess_late_fees_asof: { Args: { p_asof: string }; Returns: undefined }
      borrower_activity_between: {
        Args: { p_end: string; p_start: string }
        Returns: {
          borrower_id: string | null
          entry_date: string | null
          escrow_deposited: number | null
          escrow_disbursed: number | null
          fees_paid: number | null
          full_name: string | null
          interest_paid: number | null
          loan_id: string | null
          loan_number: string | null
          principal_paid: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "v_borrower_activity"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      borrower_due_summary: {
        Args: { p_asof: string; p_loan_id: string }
        Returns: Json
      }
      charge_off_loan: {
        Args: { p_co_date: string; p_loan_id: string; p_memo?: string }
        Returns: undefined
      }
      check_rls_status: {
        Args: never
        Returns: {
          policy_count: number
          rls_enabled: boolean
          rls_forced: boolean
          schema_name: string
          table_name: string
        }[]
      }
      escrow_post_transaction: {
        Args: {
          p_amount: number
          p_loan_id: string
          p_memo?: string
          p_tx_date: string
        }
        Returns: undefined
      }
      escrow_shortage_surplus: { Args: { p_loan_id: string }; Returns: Json }
      evaluate_covenants: { Args: { p_facility: string }; Returns: undefined }
      facility_accrued_interest: {
        Args: { p_as_of?: string; p_facility: string }
        Returns: number
      }
      facility_available_to_draw: {
        Args: { p_facility: string }
        Returns: number
      }
      facility_bbc_age_days: { Args: { p_facility: string }; Returns: number }
      facility_has_recent_approved_bbc: {
        Args: { p_days?: number; p_facility: string }
        Returns: boolean
      }
      facility_policy_breaches: {
        Args: { p_facility: string }
        Returns: {
          code: string
          message: string
          severity: string
        }[]
      }
      facility_utilization_pct: {
        Args: { p_facility: string }
        Returns: number
      }
      generate_monthly_schedule: {
        Args: { p_loan_id: string }
        Returns: undefined
      }
      get_facility_principal: {
        Args: { p_facility_id?: string }
        Returns: {
          facility_id: string
          principal_outstanding: number
        }[]
      }
      get_portfolio_aggregates: {
        Args: never
        Returns: {
          credit_limit: number
          facilities: number
          principal_outstanding: number
          region: string
          sector: Database["public"]["Enums"]["industry_sector"]
        }[]
      }
      gl_entries_between: {
        Args: { p_end: string; p_start: string }
        Returns: {
          account_code: string | null
          credit: number | null
          debit: number | null
          entry_date: string | null
          journal_id: number | null
          loan_id: string | null
          loan_number: string | null
          memo: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "v_gl_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      installment_unpaid: {
        Args: { p_asof: string; p_installment_no: number; p_loan_id: string }
        Returns: boolean
      }
      is_admin_or_analyst: { Args: { _user_id: string }; Returns: boolean }
      is_borrower: { Args: { uid: string }; Returns: boolean }
      is_lender: { Args: { uid: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      late_fee_amount_for_installment: {
        Args: { p_installment_no: number; p_loan_id: string }
        Returns: number
      }
      lender_exposure_snapshot: {
        Args: never
        Returns: {
          available_to_draw: number
          bbc_approved_within_45d: boolean
          credit_limit: number
          customer_name: string
          facility_id: string
          last_bbc_date: string
          last_draw_decided_at: string
          principal_outstanding: number
          utilization_pct: number
        }[]
      }
      notify_borrower_users: {
        Args: {
          p_body: string
          p_facility: string
          p_link: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      payment_register_between: {
        Args: { p_end: string; p_start: string }
        Returns: {
          amount_total: number | null
          fees: number | null
          interest: number | null
          loan_id: string | null
          loan_number: string | null
          payment_id: string | null
          principal: number | null
          received_date: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "v_payment_register"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      payoff_quote: {
        Args: { p_asof: string; p_loan_id: string }
        Returns: number
      }
      portfolio_policy_breaches: {
        Args: never
        Returns: {
          code: string
          customer_name: string
          facility_id: string
          message: string
          severity: string
        }[]
      }
      post_adjustment: {
        Args: {
          p_adj_date: string
          p_amount: number
          p_kind: string
          p_loan_id: string
          p_memo?: string
        }
        Returns: undefined
      }
      post_interest_all_active: {
        Args: { p_as_of?: string }
        Returns: {
          facility_id: string
          posted: number
        }[]
      }
      post_interest_for_facility: {
        Args: { p_as_of?: string; p_facility: string }
        Returns: number
      }
      principal_as_of: {
        Args: { p_as_of: string; p_facility: string }
        Returns: number
      }
      principal_outstanding: { Args: { p_loan_id: string }; Returns: number }
      principal_outstanding_asof: {
        Args: { p_asof: string; p_loan_id: string }
        Returns: number
      }
      recalc_bbc_header: { Args: { p_report: string }; Returns: undefined }
      recalc_escrow_requirements: { Args: { p_loan_id: string }; Returns: Json }
      run_daily_interest_accrual: { Args: never; Returns: undefined }
      scheduled_vs_paid: {
        Args: { p_asof: string; p_loan_id: string }
        Returns: {
          total_paid: number
          total_scheduled: number
        }[]
      }
      statement_header: {
        Args: { p_end: string; p_facility: string; p_start: string }
        Returns: {
          accrued_interest_eom: number
          closing_principal: number
          interest_posted: number
          opening_principal: number
        }[]
      }
      statement_txns: {
        Args: { p_end: string; p_facility: string; p_start: string }
        Returns: {
          amount: number
          effective_at: string
          id: string
          memo: string
          type: Database["public"]["Enums"]["txn_type"]
        }[]
      }
      sync_assessed_fees_paid: { Args: never; Returns: undefined }
      user_customer_id: { Args: { uid: string }; Returns: string }
      user_organization_id: { Args: { _user_id: string }; Returns: string }
      utilization_timeseries: {
        Args: { p_days?: number; p_facility: string }
        Returns: {
          credit_limit: number
          d: string
          principal: number
          utilization_pct: number
        }[]
      }
      waive_late_fee: {
        Args: { p_fee_id: string; p_memo?: string; p_waiver_date: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "analyst" | "borrower" | "owner"
      bbc_item_type: "accounts_receivable" | "inventory" | "cash" | "other"
      bbc_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
      decision_status: "submitted" | "under_review" | "approved" | "rejected"
      facility_status: "active" | "paused" | "closed"
      facility_type: "revolving" | "single_loan"
      industry_sector:
        | "manufacturing"
        | "wholesale"
        | "retail"
        | "services"
        | "construction"
        | "energy"
        | "other"
        | "technology"
        | "healthcare"
        | "real_estate"
      txn_type:
        | "advance"
        | "payment"
        | "interest"
        | "fee"
        | "letter_of_credit"
        | "dof"
        | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "analyst", "borrower", "owner"],
      bbc_item_type: ["accounts_receivable", "inventory", "cash", "other"],
      bbc_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
      ],
      decision_status: ["submitted", "under_review", "approved", "rejected"],
      facility_status: ["active", "paused", "closed"],
      facility_type: ["revolving", "single_loan"],
      industry_sector: [
        "manufacturing",
        "wholesale",
        "retail",
        "services",
        "construction",
        "energy",
        "other",
        "technology",
        "healthcare",
        "real_estate",
      ],
      txn_type: [
        "advance",
        "payment",
        "interest",
        "fee",
        "letter_of_credit",
        "dof",
        "adjustment",
      ],
    },
  },
} as const
