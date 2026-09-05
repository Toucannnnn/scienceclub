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
    PostgrestVersion: "14.5"
  }
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
      availability_slots: {
        Row: {
          capacity: number
          created_at: string
          ends_at: string
          id: string
          location_id: string
          max_capacity: number
          notes: string | null
          starts_at: string
          status: string
          subject_id: string | null
          tutor_id: string
          tutor_reminder_sent_at: string | null
          updated_at: string
          reserved_count: number | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          ends_at: string
          id?: string
          location_id: string
          max_capacity?: number
          notes?: string | null
          starts_at: string
          status?: string
          subject_id?: string | null
          tutor_id: string
          tutor_reminder_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          ends_at?: string
          id?: string
          location_id?: string
          max_capacity?: number
          notes?: string | null
          starts_at?: string
          status?: string
          subject_id?: string | null
          tutor_id?: string
          tutor_reminder_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          body_html: string
          created_at: string
          id: string
          last_error: string | null
          link: string | null
          reservation_id: string | null
          sent_at: string | null
          slot_id: string | null
          status: string
          subject: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          body_html: string
          created_at?: string
          id?: string
          last_error?: string | null
          link?: string | null
          reservation_id?: string | null
          sent_at?: string | null
          slot_id?: string | null
          status?: string
          subject: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          body_html?: string
          created_at?: string
          id?: string
          last_error?: string | null
          link?: string | null
          reservation_id?: string | null
          sent_at?: string | null
          slot_id?: string | null
          status?: string
          subject?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          building: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          building?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          building?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          reservation_id: string | null
          slot_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          reservation_id?: string | null
          slot_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          reservation_id?: string | null
          slot_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contact_note: string | null
          created_at: string
          email: string
          full_name: string
          grade_or_year: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contact_note?: string | null
          created_at?: string
          email: string
          full_name: string
          grade_or_year?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contact_note?: string | null
          created_at?: string
          email?: string
          full_name?: string
          grade_or_year?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      requested_roles: {
        Row: {
          requested_at: string
          role_code: string
          user_id: string
        }
        Insert: {
          requested_at?: string
          role_code: string
          user_id: string
        }
        Update: {
          requested_at?: string
          role_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requested_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "requested_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          booked_at: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          guest_cancel_token: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          reminder_sent_at: string | null
          slot_id: string
          status: string
          tutee_id: string | null
        }
        Insert: {
          booked_at?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          guest_cancel_token?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          reminder_sent_at?: string | null
          slot_id: string
          status?: string
          tutee_id?: string | null
        }
        Update: {
          booked_at?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          guest_cancel_token?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          reminder_sent_at?: string | null
          slot_id?: string
          status?: string
          tutee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tutee_id_fkey"
            columns: ["tutee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          room: string | null
          subject_id: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          room?: string | null
          subject_id: string
          weekdays: number[]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          room?: string | null
          subject_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "teachers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_courses: {
        Row: {
          course_id: string
          decided_at: string | null
          decided_by: string | null
          requested_at: string
          status: string
          tutor_id: string
        }
        Insert: {
          course_id: string
          decided_at?: string | null
          decided_by?: string | null
          requested_at?: string
          status?: string
          tutor_id: string
        }
        Update: {
          course_id?: string
          decided_at?: string | null
          decided_by?: string | null
          requested_at?: string
          status?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_courses_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_courses_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role_code: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role_code: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_reservation: {
        Args: { p_reservation_id: string }
        Returns: {
          booked_at: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          guest_cancel_token: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          reminder_sent_at: string | null
          slot_id: string
          status: string
          tutee_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_reservation_as_guest: {
        Args: { p_reservation_id: string; p_token: string }
        Returns: {
          booked_at: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          guest_cancel_token: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          reminder_sent_at: string | null
          slot_id: string
          status: string
          tutee_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_slot: {
        Args: { p_slot_id: string }
        Returns: {
          capacity: number
          created_at: string
          ends_at: string
          id: string
          location_id: string
          max_capacity: number
          notes: string | null
          starts_at: string
          status: string
          subject_id: string | null
          tutor_id: string
          tutor_reminder_sent_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "availability_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_tutor_course: {
        Args: { p_approve: boolean; p_course_id: string; p_tutor_id: string }
        Returns: {
          course_id: string
          decided_at: string | null
          decided_by: string | null
          requested_at: string
          status: string
          tutor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tutor_courses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_due_reminders: { Args: never; Returns: number }
      get_guest_reservation: {
        Args: { p_reservation_id: string; p_token: string }
        Returns: {
          ends_at: string
          guest_name: string
          id: string
          location_name: string
          starts_at: string
          status: string
          subject_name: string
          tutor_name: string
        }[]
      }
      get_pending_tutor_courses: {
        Args: never
        Returns: {
          course_id: string
          course_name: string
          requested_at: string
          subject_name: string
          tutor_email: string
          tutor_id: string
          tutor_name: string
        }[]
      }
      get_public_open_slot: {
        Args: { p_slot_id: string }
        Returns: {
          capacity: number
          ends_at: string
          id: string
          location_name: string
          max_capacity: number
          notes: string
          reserved_count: number
          starts_at: string
          subject_name: string
          tutor_id: string
          tutor_name: string
        }[]
      }
      get_public_open_slots: {
        Args: never
        Returns: {
          capacity: number
          ends_at: string
          id: string
          location_name: string
          max_capacity: number
          notes: string
          reserved_count: number
          starts_at: string
          subject_name: string
          tutor_id: string
          tutor_name: string
        }[]
      }
      get_slot_attendees: {
        Args: { p_slot_id: string }
        Returns: {
          booked_at: string
          display_name: string
          guest_email: string
          is_guest: boolean
          reservation_id: string
          status: string
        }[]
      }
      get_slot_context: {
        Args: { p_slot_id: string; p_tutee_id: string }
        Returns: Database["public"]["CompositeTypes"]["slot_notification_context"]
        SetofOptions: {
          from: "*"
          to: "slot_notification_context"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_active_restriction: { Args: { p_user: string }; Returns: boolean }
      has_role: { Args: { p_role: string }; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          reservation_id: string | null
          slot_id: string | null
          title: string
          type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notify_guest_email: {
        Args: {
          p_email: string
          p_email_html: string
          p_link: string
          p_reservation_id?: string
          p_slot_id?: string
          p_subject: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          p_body: string
          p_email_html: string
          p_email_subject: string
          p_link: string
          p_reservation_id?: string
          p_slot_id?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      request_tutor_courses: {
        Args: { p_course_ids: string[] }
        Returns: number
      }
      reserve_slot: {
        Args: { p_slot_id: string }
        Returns: {
          booked_at: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          guest_cancel_token: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          reminder_sent_at: string | null
          slot_id: string
          status: string
          tutee_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_slot_as_guest: {
        Args: { p_email: string; p_name: string; p_slot_id: string }
        Returns: {
          booked_at: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          guest_cancel_token: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          reminder_sent_at: string | null
          slot_id: string
          status: string
          tutee_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserved_count: {
        Args: { "": Database["public"]["Tables"]["availability_slots"]["Row"] }
        Returns: {
          error: true
        } & "the function public.reserved_count with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      set_slot_capacity: {
        Args: { p_new_capacity: number; p_slot_id: string }
        Returns: {
          capacity: number
          created_at: string
          ends_at: string
          id: string
          location_id: string
          max_capacity: number
          notes: string | null
          starts_at: string
          status: string
          subject_id: string | null
          tutor_id: string
          tutor_reminder_sent_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "availability_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_tutor_course: {
        Args: { p_course_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      slot_notification_context: {
        tutor_id: string | null
        tutor_name: string | null
        tutee_name: string | null
        subject_name: string | null
        location_name: string | null
        starts_at: string | null
        ends_at: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
