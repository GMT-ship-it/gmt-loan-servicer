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
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          legal_name: string
          tax_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          legal_name: string
          tax_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          legal_name?: string
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
      facility_accrued_interest: {
        Args: { p_as_of?: string; p_facility: string }
        Returns: number
      }
      facility_available_to_draw: {
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
      is_borrower: {
        Args: { uid: string }
        Returns: boolean
      }
      is_lender: {
        Args: { uid: string }
        Returns: boolean
      }
      recalc_bbc_header: {
        Args: { p_report: string }
        Returns: undefined
      }
      user_customer_id: {
        Args: { uid: string }
        Returns: string
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
