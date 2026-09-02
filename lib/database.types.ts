export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          name: string;
          email: string;
          package_type: string;
          total_sessions: number;
          sessions_used: number;
          remaining_sessions: number;
          membership_status: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          role: string;
          full_name: string;
          avatar_url: string | null;
          membership_id: string | null;
          branch: string;
        };
      };
      payments: {
        Row: {
          id: string;
          member_id: string;
          amount: number;
          payment_type: string;
          status: string;
          payment_date: string;
        };
      };
      session_bookings: {
        Row: {
          id: string;
          member_id: string;
          session_type: string;
          session_date: string;
          coach_name: string;
          status: string;
        };
      };
      activity_log: {
        Row: {
          id: string;
          member_id: string;
          title: string;
          description: string;
          activity_date: string;
        };
      };
      points: {
        Row: {
          member_id: string;
          total_points: number;
          lifetime_points: number;
          tier: string;
        };
      };
    };
  };
}
