export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      maintenance_requests: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          photo_paths: string[]
          priority: string
          status: string
          tenancy_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          photo_paths?: string[]
          priority?: string
          status?: string
          tenancy_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          photo_paths?: string[]
          priority?: string
          status?: string
          tenancy_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancy_balances"
            referencedColumns: ["tenancy_id"]
          },
        ]
      }
      maintenance_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: number
          maintenance_request_id: string
          note: string | null
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: never
          maintenance_request_id: string
          note?: string | null
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: never
          maintenance_request_id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_status_history_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          id: string
          profile_id: string
          read_at: string | null
          sms_status: string
          tenancy_id: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key: string
          id?: string
          profile_id: string
          read_at?: string | null
          sms_status?: string
          tenancy_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          profile_id?: string
          read_at?: string | null
          sms_status?: string
          tenancy_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancy_balances"
            referencedColumns: ["tenancy_id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          checkout_request_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          landlord_id: string
          merchant_request_id: string | null
          requested_amount: number
          requested_by: string
          requested_phone: string
          result_code: number | null
          result_description: string | null
          status: string
          tenancy_id: string
          updated_at: string
        }
        Insert: {
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          landlord_id: string
          merchant_request_id?: string | null
          requested_amount: number
          requested_by: string
          requested_phone: string
          result_code?: number | null
          result_description?: string | null
          status?: string
          tenancy_id: string
          updated_at?: string
        }
        Update: {
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          landlord_id?: string
          merchant_request_id?: string | null
          requested_amount?: number
          requested_by?: string
          requested_phone?: string
          result_code?: number | null
          result_description?: string | null
          status?: string
          tenancy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancy_balances"
            referencedColumns: ["tenancy_id"]
          },
        ]
      }
      payment_reconciliations: {
        Row: {
          created_at: string
          id: number
          note: string | null
          payment_id: string
          previous_tenancy_id: string | null
          resolved_by: string
          tenancy_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          note?: string | null
          payment_id: string
          previous_tenancy_id?: string | null
          resolved_by: string
          tenancy_id: string
        }
        Update: {
          created_at?: string
          id?: never
          note?: string | null
          payment_id?: string
          previous_tenancy_id?: string | null
          resolved_by?: string
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliations_previous_tenancy_id_fkey"
            columns: ["previous_tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliations_previous_tenancy_id_fkey"
            columns: ["previous_tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancy_balances"
            referencedColumns: ["tenancy_id"]
          },
          {
            foreignKeyName: "payment_reconciliations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliations_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliations_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancy_balances"
            referencedColumns: ["tenancy_id"]
          },
        ]
      }
      payments: {
        Row: {
          account_reference: string | null
          amount: number
          checkout_request_id: string | null
          created_at: string
          id: string
          landlord_id: string
          method: string
          paid_at: string
          payment_attempt_id: string | null
          provider: string
          provider_transaction_id: string
          reconciliation_status: string
          sender_phone: string | null
          status: string
          tenancy_id: string | null
          updated_at: string
        }
        Insert: {
          account_reference?: string | null
          amount: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          landlord_id: string
          method: string
          paid_at: string
          payment_attempt_id?: string | null
          provider?: string
          provider_transaction_id: string
          reconciliation_status: string
          sender_phone?: string | null
          status?: string
          tenancy_id?: string | null
          updated_at?: string
        }
        Update: {
          account_reference?: string | null
          amount?: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          method?: string
          paid_at?: string
          payment_attempt_id?: string | null
          provider?: string
          provider_transaction_id?: string
          reconciliation_status?: string
          sender_phone?: string | null
          status?: string
          tenancy_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_attempt_id_fkey"
            columns: ["payment_attempt_id"]
            isOneToOne: true
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancy_balances"
            referencedColumns: ["tenancy_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          county: string | null
          created_at: string
          id: string
          landlord_id: string
          name: string
          updated_at: string
        }
        Insert: {
          address: string
          county?: string | null
          created_at?: string
          id?: string
          landlord_id: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string
          county?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancies: {
        Row: {
          billing_day: number
          created_at: string
          end_date: string | null
          id: string
          payment_reference: string
          rent_amount: number
          start_date: string
          status: string
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          billing_day?: number
          created_at?: string
          end_date?: string | null
          id?: string
          payment_reference?: string
          rent_amount: number
          start_date: string
          status?: string
          tenant_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          billing_day?: number
          created_at?: string
          end_date?: string | null
          id?: string
          payment_reference?: string
          rent_amount?: number
          start_date?: string
          status?: string
          tenant_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          billing_day: number
          created_at: string
          end_date: string | null
          expires_at: string
          id: string
          landlord_id: string
          phone: string
          rent_amount: number
          start_date: string
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          billing_day?: number
          created_at?: string
          end_date?: string | null
          expires_at?: string
          id?: string
          landlord_id: string
          phone: string
          rent_amount: number
          start_date: string
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          billing_day?: number
          created_at?: string
          end_date?: string | null
          expires_at?: string
          id?: string
          landlord_id?: string
          phone?: string
          rent_amount?: number
          start_date?: string
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invitations_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tenancy_balances: {
        Row: {
          balance: number | null
          tenancy_id: string | null
          tenant_id: string | null
          total_due: number | null
          total_paid: number | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_tenant_invitation: {
        Args: { target_invitation_id: string }
        Returns: {
          billing_day: number
          created_at: string
          end_date: string | null
          id: string
          payment_reference: string
          rent_amount: number
          start_date: string
          status: string
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenancies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_tenant_invitation: {
        Args: { target_invitation_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          billing_day: number
          created_at: string
          end_date: string | null
          expires_at: string
          id: string
          landlord_id: string
          phone: string
          rent_amount: number
          start_date: string
          status: string
          unit_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenant_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_tenant_invitation: {
        Args: {
          target_unit_id: string
          tenancy_billing_day: number
          tenancy_end_date?: string
          tenancy_rent: number
          tenancy_start_date: string
          tenant_phone: string
        }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          billing_day: number
          created_at: string
          end_date: string | null
          expires_at: string
          id: string
          landlord_id: string
          phone: string
          rent_amount: number
          start_date: string
          status: string
          unit_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenant_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_mpesa_stk_callback: {
        Args: {
          callback_amount: number
          callback_checkout_request_id: string
          callback_paid_at: string
          callback_payload: Json
          callback_phone: string
          callback_receipt: string
          callback_result_code: number
          callback_result_description: string
        }
        Returns: string
      }
      register_as_landlord: {
        Args: never
        Returns: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_unmatched_payment: {
        Args: {
          resolution_note?: string
          target_payment_id: string
          target_tenancy_id: string
        }
        Returns: {
          account_reference: string | null
          amount: number
          checkout_request_id: string | null
          created_at: string
          id: string
          landlord_id: string
          method: string
          paid_at: string
          payment_attempt_id: string | null
          provider: string
          provider_transaction_id: string
          reconciliation_status: string
          sender_phone: string | null
          status: string
          tenancy_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_rent_reminders: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

