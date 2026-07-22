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
      message_threads: {
        Row: {
          created_at: string
          id: string
          tenancy_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenancy_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: true
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: true
            referencedRelation: "tenancy_balances"
            referencedColumns: ["tenancy_id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
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
          sms_phone: string | null
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
          sms_phone?: string | null
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
          sms_phone?: string | null
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
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_properties: number | null
          max_units: number | null
          name: string
          price_kes_monthly: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_properties?: number | null
          max_units?: number | null
          name: string
          price_kes_monthly: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_properties?: number | null
          max_units?: number | null
          name?: string
          price_kes_monthly?: number
        }
        Relationships: []
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
      property_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          description: string
          expense_date?: string
          id?: string
          property_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          checkout_request_id: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          landlord_id: string
          method: string
          paid_at: string | null
          provider_reference: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          landlord_id: string
          method: string
          paid_at?: string | null
          provider_reference?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          landlord_id?: string
          method?: string
          paid_at?: string | null
          provider_reference?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          landlord_id: string
          plan_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          landlord_id: string
          plan_id: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          landlord_id?: string
          plan_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_invoices: {
        Row: {
          control_unit_invoice_number: string | null
          created_at: string
          error: string | null
          id: string
          kra_invoice_number: string | null
          landlord_id: string
          payment_id: string
          qr_code_url: string | null
          retry_count: number
          status: string
          submitted_at: string | null
          tenancy_id: string
          updated_at: string
        }
        Insert: {
          control_unit_invoice_number?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kra_invoice_number?: string | null
          landlord_id: string
          payment_id: string
          qr_code_url?: string | null
          retry_count?: number
          status?: string
          submitted_at?: string | null
          tenancy_id: string
          updated_at?: string
        }
        Update: {
          control_unit_invoice_number?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kra_invoice_number?: string | null
          landlord_id?: string
          payment_id?: string
          qr_code_url?: string | null
          retry_count?: number
          status?: string
          submitted_at?: string | null
          tenancy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_invoices_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancy_balances"
            referencedColumns: ["tenancy_id"]
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
      disconnect_landlord_etims: { Args: never; Returns: undefined }
      disconnect_landlord_mpesa: { Args: never; Returns: undefined }
      end_tenancy: {
        Args: {
          note?: string
          target_end_date: string
          target_tenancy_id: string
        }
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
      fetch_pending_tax_invoices: {
        Args: never
        Returns: {
          amount: number
          id: string
          landlord_id: string
          paid_at: string
          payment_id: string
          payment_reference: string
          retry_count: number
        }[]
      }
      get_landlord_etims_credentials: {
        Args: { target_landlord_id: string }
        Returns: {
          cu_serial: string
          cu_type: string
          environment: string
          kra_pin: string
        }[]
      }
      get_landlord_mpesa_credentials: {
        Args: { target_landlord_id: string }
        Returns: {
          consumer_key: string
          consumer_secret: string
          environment: string
          passkey: string
          shortcode: string
        }[]
      }
      landlord_etims_connection_status: {
        Args: never
        Returns: {
          connected: boolean
          cu_type: string
          environment: string
          kra_pin: string
          verified_at: string
        }[]
      }
      landlord_mpesa_connection_status: {
        Args: never
        Returns: {
          connected: boolean
          environment: string
          masked_shortcode: string
          verified_at: string
        }[]
      }
      landlord_subscription_status: {
        Args: never
        Returns: {
          current_period_end: string
          max_properties: number
          plan_name: string
          price_kes_monthly: number
          properties_used: number
          status: string
          trial_ends_at: string
        }[]
      }
      mark_landlord_etims_verified: {
        Args: { target_landlord_id: string }
        Returns: undefined
      }
      mark_landlord_mpesa_verified: {
        Args: { target_landlord_id: string }
        Returns: undefined
      }
      record_manual_payment: {
        Args: {
          payment_amount: number
          payment_date: string
          payment_note?: string
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
      record_subscription_payment_failure: {
        Args: { target_payment_id: string }
        Returns: undefined
      }
      record_subscription_payment_success: {
        Args: {
          target_paid_at: string
          target_payment_id: string
          target_provider_reference: string
        }
        Returns: undefined
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
      reserve_subscription_payment: {
        Args: {
          target_amount: number
          target_idempotency_key: string
          target_method: string
        }
        Returns: {
          amount: number
          checkout_request_id: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          landlord_id: string
          method: string
          paid_at: string | null
          provider_reference: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscription_payments"
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
      send_message: {
        Args: { message_body: string; target_tenancy_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_landlord_etims_credentials: {
        Args: {
          target_cu_serial: string
          target_cu_type?: string
          target_environment?: string
          target_kra_pin: string
        }
        Returns: {
          cu_type: string
          environment: string
          kra_pin: string
          verified_at: string
        }[]
      }
      set_landlord_mpesa_credentials: {
        Args: {
          target_consumer_key: string
          target_consumer_secret: string
          target_environment?: string
          target_passkey: string
          target_shortcode: string
        }
        Returns: {
          environment: string
          shortcode: string
          verified_at: string
        }[]
      }
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

