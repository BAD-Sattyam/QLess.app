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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cafes: {
        Row: {
          accepting_orders: boolean
          address: string
          approved: boolean
          avg_prep_minutes: number
          close_time: string
          cover_url: string | null
          created_at: string
          cuisine: string | null
          demo_mode: boolean
          id: string
          is_active: boolean
          lead_time_minutes: number
          logo_url: string | null
          max_orders_per_slot: number
          name: string
          open_time: string
          slug: string
          tagline: string | null
        }
        Insert: {
          accepting_orders?: boolean
          address: string
          approved?: boolean
          avg_prep_minutes?: number
          close_time?: string
          cover_url?: string | null
          created_at?: string
          cuisine?: string | null
          demo_mode?: boolean
          id?: string
          is_active?: boolean
          lead_time_minutes?: number
          logo_url?: string | null
          max_orders_per_slot?: number
          name: string
          open_time?: string
          slug: string
          tagline?: string | null
        }
        Update: {
          accepting_orders?: boolean
          address?: string
          approved?: boolean
          avg_prep_minutes?: number
          close_time?: string
          cover_url?: string | null
          created_at?: string
          cuisine?: string | null
          demo_mode?: boolean
          id?: string
          is_active?: boolean
          lead_time_minutes?: number
          logo_url?: string | null
          max_orders_per_slot?: number
          name?: string
          open_time?: string
          slug?: string
          tagline?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          cafe_id: string
          category: string
          created_at: string
          customizations: Json
          description: string | null
          id: string
          is_active: boolean
          is_available: boolean
          name: string
          price_paise: number
          sort_order: number
        }
        Insert: {
          cafe_id: string
          category?: string
          created_at?: string
          customizations?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          name: string
          price_paise: number
          sort_order?: number
        }
        Update: {
          cafe_id?: string
          category?: string
          created_at?: string
          customizations?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          name?: string
          price_paise?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_memberships: {
        Row: {
          cafe_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cafe_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cafe_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_memberships_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total_paise: number
          menu_item_id: string | null
          name: string
          options: Json
          order_id: string
          quantity: number
          unit_price_paise: number
        }
        Insert: {
          id?: string
          line_total_paise: number
          menu_item_id?: string | null
          name: string
          options?: Json
          order_id: string
          quantity: number
          unit_price_paise: number
        }
        Update: {
          id?: string
          line_total_paise?: number
          menu_item_id?: string | null
          name?: string
          options?: Json
          order_id?: string
          quantity?: number
          unit_price_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cafe_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          client_hash: string | null
          collected_at: string | null
          created_at: string
          customer_name: string
          id: string
          notes: string | null
          payment_ref: string | null
          pickup_at: string
          pickup_code: string
          preparing_at: string | null
          ready_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_paise: number
          tracking_token: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          cafe_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_hash?: string | null
          collected_at?: string | null
          created_at?: string
          customer_name: string
          id?: string
          notes?: string | null
          payment_ref?: string | null
          pickup_at: string
          pickup_code: string
          preparing_at?: string | null
          ready_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_paise?: number
          tracking_token: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          cafe_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_hash?: string | null
          collected_at?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          notes?: string | null
          payment_ref?: string | null
          pickup_at?: string
          pickup_code?: string
          preparing_at?: string | null
          ready_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_paise?: number
          tracking_token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount_paise: number
          cafe_id: string
          captured_at: string | null
          checkout_cancelled_at: string | null
          client_hash: string | null
          created_at: string
          customer_name: string
          expires_at: string
          id: string
          is_test: boolean
          item_snapshot: Json
          items: Json
          notes: string | null
          order_id: string | null
          pickup_at: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount_paise: number
          cafe_id: string
          captured_at?: string | null
          checkout_cancelled_at?: string | null
          client_hash?: string | null
          created_at?: string
          customer_name: string
          expires_at?: string
          id?: string
          is_test?: boolean
          item_snapshot?: Json
          items: Json
          notes?: string | null
          order_id?: string | null
          pickup_at: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount_paise?: number
          cafe_id?: string
          captured_at?: string | null
          checkout_cancelled_at?: string | null
          client_hash?: string | null
          created_at?: string
          customer_name?: string
          expires_at?: string
          id?: string
          is_test?: boolean
          item_snapshot?: Json
          items?: Json
          notes?: string | null
          order_id?: string | null
          pickup_at?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_merchant: {
        Args: { p_cafe_id: string; p_email: string }
        Returns: undefined
      }
      admin_exists: { Args: never; Returns: boolean }
      admin_list_merchants: {
        Args: never
        Returns: {
          cafe_id: string
          cafe_name: string
          created_at: string
          email: string
          id: string
          user_id: string
        }[]
      }
      admin_remove_merchant: { Args: { p_id: string }; Returns: undefined }
      claim_first_admin: { Args: never; Returns: boolean }
      create_payment_attempt: {
        Args: {
          p_cafe_id: string
          p_client_hash: string
          p_customer_name: string
          p_items: Json
          p_notes: string
          p_pickup_at: string
          p_user_id?: string
        }
        Returns: {
          amount_paise: number
          attempt_id: string
        }[]
      }
      create_test_payment_attempt: {
        Args: {
          p_cafe_id: string
          p_client_hash: string
          p_customer_name: string
          p_items: Json
          p_notes: string
          p_pickup_at: string
          p_user_id?: string
        }
        Returns: {
          amount_paise: number
          attempt_id: string
        }[]
      }
      expire_payment_attempts: { Args: never; Returns: undefined }
      finalize_test_payment: {
        Args: {
          p_amount: number
          p_attempt_id: string
          p_captured_at: string
          p_currency: string
          p_payment_id: string
          p_razorpay_order_id: string
        }
        Returns: Json
      }
      get_available_slots: {
        Args: { p_cafe_id: string }
        Returns: {
          remaining: number
          slot: string
        }[]
      }
      get_order_by_token: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_cafe_member: { Args: { _cafe_id: string }; Returns: boolean }
      place_order: {
        Args: {
          p_cafe_id: string
          p_client_hash: string
          p_customer_name: string
          p_items: Json
          p_notes: string
          p_pickup_at: string
          p_user_id?: string
        }
        Returns: {
          pickup_code: string
          tracking_token: string
        }[]
      }
      set_cafe_accepting: {
        Args: { p_accepting: boolean; p_cafe_id: string }
        Returns: undefined
      }
      set_item_availability: {
        Args: { p_available: boolean; p_item_id: string }
        Returns: undefined
      }
      update_order_status: {
        Args: {
          p_order_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin"
      order_status:
        | "pending"
        | "accepted"
        | "preparing"
        | "ready"
        | "collected"
        | "cancelled"
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
  public: {
    Enums: {
      app_role: ["admin"],
      order_status: [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "collected",
        "cancelled",
      ],
    },
  },
} as const
