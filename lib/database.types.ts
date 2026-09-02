export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      members: {
        Row: {
          id: string
          user_id: string
          member_code: string
          membership_id: string | null
          name: string
          full_name: string
          email: string
          phone: string | null
          branch: string
          branch_id: string | null
          package_name: string
          package_type: string
          package_id: string | null
          status: string
          membership_status: string
          total_sessions: number
          sessions_used: number
          sessions_left: number
          remaining_sessions: number | null
          payment_status: string
          last_paid_at: string | null
          last_paid_amount: number | null
          total_paid: number
          join_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          member_code?: string
          membership_id?: string | null
          name: string
          full_name: string
          email: string
          phone?: string | null
          branch?: string
          branch_id?: string | null
          package_name?: string
          package_type?: string
          package_id?: string | null
          status?: string
          membership_status?: string
          total_sessions?: number
          sessions_used?: number
          sessions_left?: number
          payment_status?: string
          last_paid_at?: string | null
          last_paid_amount?: number | null
          total_paid?: number
          join_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: string
          member_id: string | null
          full_name: string
          phone: string | null
          avatar_url: string | null
          membership_id: string | null
          branch: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: string
          member_id?: string | null
          full_name: string
          phone?: string | null
          avatar_url?: string | null
          membership_id?: string | null
          branch?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          member_id: string
          package_name: string | null
          stage: string | null
          amount: number
          status: string
          payment_type: string | null
          payment_date: string | null
          created_at: string
          paid_at: string | null
          created_by: string | null
          sessions_purchased: number
          credit_applied_at: string | null
        }
        Insert: {
          id?: string
          member_id: string
          package_name?: string | null
          stage?: string | null
          amount?: number
          status?: string
          payment_type?: string | null
          payment_date?: string | null
          created_at?: string
          paid_at?: string | null
          created_by?: string | null
          sessions_purchased?: number
          credit_applied_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>
        Relationships: []
      }
      session_logs: {
        Row: {
          id: string
          member_id: string
          staff_user_id: string | null
          trained_at: string
          notes: string | null
          sessions_left_after: number
          created_at: string
        }
        Insert: {
          id?: string
          member_id: string
          staff_user_id?: string | null
          trained_at?: string
          notes?: string | null
          sessions_left_after: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["session_logs"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      staff_mark_payment_paid: {
        Args: { p_payment_id: string }
        Returns: Json
      }
      staff_qr_checkin: {
        Args: { p_member_code: string; p_notes?: string | null }
        Returns: Json
      }
      staff_record_payment: {
        Args: {
          p_amount: number
          p_member_id: string
          p_package_name: string
          p_payment_type?: string | null
          p_sessions_purchased: number
          p_stage: string
          p_status?: string
        }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
