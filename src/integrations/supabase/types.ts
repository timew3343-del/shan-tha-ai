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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_credit_logs: {
        Row: {
          created_at: string
          credits_earned: number
          id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_earned?: number
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_earned?: number
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      api_balance_tracking: {
        Row: {
          api_name: string
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          last_updated: string
          low_balance_threshold: number
        }
        Insert: {
          api_name: string
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          last_updated?: string
          low_balance_threshold?: number
        }
        Update: {
          api_name?: string
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          last_updated?: string
          low_balance_threshold?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          admin_notes: string | null
          created_at: string
          credits_awarded: number | null
          fb_link: string | null
          id: string
          link: string
          platform: string
          status: string
          tiktok_link: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          credits_awarded?: number | null
          fb_link?: string | null
          id?: string
          link: string
          platform: string
          status?: string
          tiktok_link?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          credits_awarded?: number | null
          fb_link?: string | null
          id?: string
          link?: string
          platform?: string
          status?: string
          tiktok_link?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      collaborator_invites: {
        Row: {
          added_by: string
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          added_by: string
          created_at?: string
          email: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          added_by?: string
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      credit_audit_log: {
        Row: {
          amount: number
          created_at: string
          credit_type: string
          description: string | null
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_type: string
          description?: string | null
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_type?: string
          description?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transfers: {
        Row: {
          amount: number
          created_at: string
          id: string
          receiver_balance_after: number
          receiver_id: string
          sender_balance_after: number
          sender_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          receiver_balance_after: number
          receiver_id: string
          sender_balance_after: number
          sender_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          receiver_balance_after?: number
          receiver_id?: string
          sender_balance_after?: number
          sender_id?: string
        }
        Relationships: []
      }
      daily_content_videos: {
        Row: {
          api_cost_credits: number | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          facebook_caption: string | null
          generated_date: string
          hashtags: string[] | null
          id: string
          is_published: boolean | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_type: string
          video_url: string | null
        }
        Insert: {
          api_cost_credits?: number | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          facebook_caption?: string | null
          generated_date?: string
          hashtags?: string[] | null
          id?: string
          is_published?: boolean | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Update: {
          api_cost_credits?: number | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          facebook_caption?: string | null
          generated_date?: string
          hashtags?: string[] | null
          id?: string
          is_published?: boolean | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          ai_instruction: string | null
          category: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_instruction?: string | null
          category: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_instruction?: string | null
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_packages: {
        Row: {
          created_at: string
          credits: number
          currency: string
          id: string
          is_active: boolean | null
          is_best_value: boolean | null
          name: string
          price_mmk: number
          price_thb: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          currency?: string
          id?: string
          is_active?: boolean | null
          is_best_value?: boolean | null
          name: string
          price_mmk?: number
          price_thb?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          is_active?: boolean | null
          is_best_value?: boolean | null
          name?: string
          price_mmk?: number
          price_thb?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credit_balance: number
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credit_balance?: number
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credit_balance?: number
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      promo_code_uses: {
        Row: {
          created_at: string
          credits_awarded: number
          id: string
          promo_code_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_awarded?: number
          id?: string
          promo_code_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_awarded?: number
          id?: string
          promo_code_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          bonus_credits: number
          code: string
          created_at: string
          discount_percent: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          uses_count: number
        }
        Insert: {
          bonus_credits?: number
          code: string
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses_count?: number
        }
        Update: {
          bonus_credits?: number
          code?: string
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          credits_earned: number
          id: string
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          credits_earned?: number
          id?: string
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          credits_earned?: number
          id?: string
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      referral_uses: {
        Row: {
          code_id: string
          created_at: string
          credits_awarded: number
          id: string
          used_by_user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          credits_awarded?: number
          id?: string
          used_by_user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          credits_awarded?: number
          id?: string
          used_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_uses_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          credits: number
          duration_days: number
          id: string
          is_active: boolean | null
          name: string
          price_mmk: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          duration_days?: number
          id?: string
          is_active?: boolean | null
          name: string
          price_mmk?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          duration_days?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price_mmk?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_mmk: number
          bonus_credits: number | null
          created_at: string
          credits: number
          id: string
          is_first_purchase: boolean | null
          package_name: string
          screenshot_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_mmk: number
          bonus_credits?: number | null
          created_at?: string
          credits: number
          id?: string
          is_first_purchase?: boolean | null
          package_name: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_mmk?: number
          bonus_credits?: number | null
          created_at?: string
          credits?: number
          id?: string
          is_first_purchase?: boolean | null
          package_name?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tutorial_purchases: {
        Row: {
          credits_paid: number
          id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          credits_paid: number
          id?: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          credits_paid?: number
          id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      user_outputs: {
        Row: {
          content: string | null
          created_at: string
          expires_at: string
          file_url: string | null
          id: string
          output_type: string
          thumbnail_url: string | null
          tool_id: string
          tool_name: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          expires_at?: string
          file_url?: string | null
          id?: string
          output_type?: string
          thumbnail_url?: string | null
          tool_id: string
          tool_name: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          expires_at?: string
          file_url?: string | null
          id?: string
          output_type?: string
          thumbnail_url?: string | null
          tool_id?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      campaigns_user_view: {
        Row: {
          created_at: string | null
          credits_awarded: number | null
          fb_link: string | null
          id: string | null
          link: string | null
          platform: string | null
          status: string | null
          tiktok_link: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits_awarded?: number | null
          fb_link?: string | null
          id?: string | null
          link?: string | null
          platform?: string | null
          status?: string | null
          tiktok_link?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits_awarded?: number | null
          fb_link?: string | null
          id?: string | null
          link?: string | null
          platform?: string | null
          status?: string | null
          tiktok_link?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_credits_via_service: {
        Args: { _amount: number; _user_id: string }
        Returns: Json
      }
      add_user_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: Json
      }
      cleanup_expired_outputs: { Args: never; Returns: number }
      deduct_user_credits: {
        Args: { _action: string; _amount: number; _user_id: string }
        Returns: Json
      }
      get_screenshot_signed_url: {
        Args: { screenshot_path: string }
        Returns: string
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_email: { Args: { _email: string }; Returns: boolean }
      purchase_tutorial: {
        Args: { _credits_cost: number; _user_id: string }
        Returns: Json
      }
      redeem_promo_code: {
        Args: { _code: string; _user_id: string }
        Returns: Json
      }
      transfer_credits: {
        Args: { _amount: number; _receiver_id: string; _sender_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "trainer"
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
      app_role: ["admin", "moderator", "user", "trainer"],
    },
  },
} as const
