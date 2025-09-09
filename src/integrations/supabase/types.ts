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
          created_at: string
          id: string
          legal_name: string
          region: string | null
          sector: Database["public"]["Enums"]["industry_sector"] | null
          tax_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          legal_name: string
          region?: string | null
          sector?: Database["public"]["Enums"]["industry_sector"] | null
          tax_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          legal_name?: string
          region?: string | null
          sector?: Database["public"]["Enums"]["industry_sector"] | null
          tax_id?: string | null
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
      profiles: {
        Row: {
          created_at: string
          customer_id: string | null
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      evaluate_covenants: {
        Args: { p_facility: string }
        Returns: undefined
      }
      facility_accrued_interest: {
        Args: { p_as_of?: string; p_facility: string }
        Returns: number
      }
      facility_available_to_draw: {
        Args: { p_facility: string }
        Returns: number
      }
      facility_bbc_age_days: {
        Args: { p_facility: string }
        Returns: number
      }
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
      get_facility_principal: {
        Args: { p_facility_id?: string }
        Returns: {
          facility_id: string
          principal_outstanding: number
        }[]
      }
      get_portfolio_aggregates: {
        Args: Record<PropertyKey, never>
        Returns: {
          credit_limit: number
          facilities: number
          principal_outstanding: number
          region: string
          sector: Database["public"]["Enums"]["industry_sector"]
        }[]
      }
      is_borrower: {
        Args: { uid: string }
        Returns: boolean
      }
      is_lender: {
        Args: { uid: string }
        Returns: boolean
      }
      lender_exposure_snapshot: {
        Args: Record<PropertyKey, never>
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
      portfolio_policy_breaches: {
        Args: Record<PropertyKey, never>
        Returns: {
          code: string
          customer_name: string
          facility_id: string
          message: string
          severity: string
        }[]
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
      recalc_bbc_header: {
        Args: { p_report: string }
        Returns: undefined
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
      user_customer_id: {
        Args: { uid: string }
        Returns: string
      }
      utilization_timeseries: {
        Args: { p_days?: number; p_facility: string }
        Returns: {
          credit_limit: number
          d: string
          principal: number
          utilization_pct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "lender_admin"
        | "lender_analyst"
        | "borrower_admin"
        | "borrower_user"
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
      app_role: [
        "lender_admin",
        "lender_analyst",
        "borrower_admin",
        "borrower_user",
      ],
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
