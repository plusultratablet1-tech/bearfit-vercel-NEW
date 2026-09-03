export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: unknown[] }

export type Database = {
  public: {
    Tables: {
      members: Table<{ id:string; user_id:string; member_code:string; membership_id:string|null; name:string; full_name:string; email:string; phone:string|null; branch:string; branch_id:string|null; package_name:string; package_type:string; package_id:string|null; status:string; membership_status:string; total_sessions:number; sessions_used:number; sessions_left:number; remaining_sessions:number|null; payment_status:string; last_paid_at:string|null; last_paid_amount:number|null; total_paid:number; join_date:string; created_at:string; updated_at:string }>
      profiles: Table<{ id:string; role:string; member_id:string|null; full_name:string; phone:string|null; avatar_url:string|null; membership_id:string|null; branch:string; created_at:string; updated_at:string }>
      payments: Table<{ id:string; member_id:string; package_name:string|null; stage:string|null; amount:number; status:string; payment_type:string|null; payment_date:string|null; created_at:string; paid_at:string|null; created_by:string|null; sessions_purchased:number; credit_applied_at:string|null; package_definition_id:string|null; member_package_id:string|null; package_stage_id:string|null }>
      session_logs: Table<{ id:string; member_id:string; staff_user_id:string|null; trained_at:string; notes:string|null; sessions_left_after:number; created_at:string; booking_id:string|null; member_package_id:string|null }>
      package_definitions: Table<{ id:string; code:string; name:string; service_category:string; included_sessions:number; validity_days:number|null; shareable:boolean; billing_mode:string; active:boolean; created_at:string; updated_at:string }>
      package_payment_stages: Table<{ id:string; package_id:string; stage_order:number; stage_key:string; label:string; trigger_type:string; trigger_sessions_left:number|null; blocks_new_bookings_when_due:boolean; active:boolean }>
      member_package_cycles: Table<{ id:string; member_id:string; package_id:string; status:string; sessions_total:number; sessions_used:number; sessions_left:number; starts_at:string|null; expires_at:string|null; renewed_from_id:string|null; created_at:string; updated_at:string }>
      member_package_stage_payments: Table<{ id:string; member_package_id:string; stage_id:string; payment_id:string|null; status:string; due_at:string; paid_at:string|null }>
      availability_rules: Table<{ id:string; coach_user_id:string; branch:string; session_type:string; weekday:number; local_start_time:string; local_end_time:string; slot_duration_minutes:number; capacity:number; valid_from:string; valid_until:string|null; active:boolean; created_by:string; created_at:string; updated_at:string }>
      schedule_slots: Table<{ id:string; availability_rule_id:string|null; coach_user_id:string|null; branch:string; session_type:string; start_at:string; end_at:string; capacity:number; status:string; created_by:string; created_at:string; updated_at:string }>
      bookings: Table<{ id:string; member_id:string; slot_id:string|null; request_kind:string; status:string; requested_coach_user_id:string|null; assigned_coach_user_id:string|null; branch:string; session_type:string; requested_start_at:string; requested_duration_minutes:number; start_at:string|null; end_at:string|null; member_package_id:string|null; cancelled_at:string|null; cancel_reason:string|null; no_show_charged:boolean; created_by:string; created_at:string; updated_at:string }>
      bearforce_point_events: Table<{ id:string; member_id:string; event_type:string; points:number; season_key:string; source_type:string; source_id:string; occurred_at:string; metadata:Json; created_at:string }>
      bearforce_redemptions: Table<{ id:string; member_id:string; season_key:string; reward_label:string; points_spent:number; status:string; created_by:string; created_at:string; reversed_by:string|null; reversed_at:string|null }>
    }
    Views: Record<string, never>
    Functions: {
      member_coach_directory: { Args:never; Returns:{id:string;full_name:string;branch:string}[] }
      member_bearforce_summary: { Args:never; Returns:Json }
      staff_redeem_bearforce_points: { Args:{p_member_id:string;p_points:number;p_reward_label:string}; Returns:Json }
      staff_reverse_bearforce_redemption: { Args:{p_redemption_id:string}; Returns:Json }
      member_package_eligibility: { Args:{p_service_category:string}; Returns:Json }
      member_request_slot: { Args:{p_slot_id:string}; Returns:Json }
      member_request_custom_session: { Args:{p_session_type:string;p_requested_start_at:string;p_requested_coach_user_id?:string|null;p_duration_minutes?:number}; Returns:Json }
      member_cancel_booking: { Args:{p_booking_id:string;p_reason?:string|null}; Returns:Json }
      staff_create_availability_rule: { Args:Record<string,unknown>; Returns:string }
      staff_generate_slots: { Args:{p_rule_id:string;p_through:string}; Returns:number }
      staff_create_one_off_slot: { Args:Record<string,unknown>; Returns:string }
      staff_cancel_slot: { Args:{p_slot_id:string}; Returns:void }
      staff_confirm_booking: { Args:Record<string,unknown>; Returns:Json }
      staff_reject_booking: { Args:Record<string,unknown>; Returns:Json }
      staff_create_assignment: { Args:Record<string,unknown>; Returns:Json }
      staff_reassign_booking: { Args:Record<string,unknown>; Returns:Json }
      staff_cancel_booking: { Args:Record<string,unknown>; Returns:Json }
      staff_mark_no_show: { Args:Record<string,unknown>; Returns:Json }
      staff_checkin_context: { Args:{p_member_code:string}; Returns:Json }
      staff_qr_checkin: { Args:{p_member_code:string;p_notes?:string|null;p_booking_id?:string|null;p_member_package_id?:string|null}; Returns:Json }
      staff_package_attention_queue: { Args:never; Returns:unknown[] }
      staff_record_package_payment: { Args:Record<string,unknown>; Returns:Json }
      staff_mark_package_payment_paid: { Args:{p_payment_id:string}; Returns:Json }
      staff_record_payment: { Args:Record<string,unknown>; Returns:Json }
      staff_mark_payment_paid: { Args:{p_payment_id:string}; Returns:Json }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
