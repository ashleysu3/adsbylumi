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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audiences: {
        Row: {
          brand_id: string
          created_at: string | null
          demographics: string | null
          desires: string[] | null
          id: string
          name: string
          objections: string[] | null
          pain_points: string[] | null
          psychographics: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          demographics?: string | null
          desires?: string[] | null
          id?: string
          name: string
          objections?: string[] | null
          pain_points?: string[] | null
          psychographics?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          demographics?: string | null
          desires?: string[] | null
          id?: string
          name?: string
          objections?: string[] | null
          pain_points?: string[] | null
          psychographics?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audiences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          audience_psychology: Json | null
          brand_voice: string | null
          created_at: string | null
          id: string
          industry: string | null
          meta_account_id: string | null
          name: string
          psychology_status: string | null
          target_audience: string | null
          updated_at: string | null
          user_id: string
          value_proposition: string | null
          website_url: string | null
        }
        Insert: {
          audience_psychology?: Json | null
          brand_voice?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          meta_account_id?: string | null
          name: string
          psychology_status?: string | null
          target_audience?: string | null
          updated_at?: string | null
          user_id: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Update: {
          audience_psychology?: Json | null
          brand_voice?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          meta_account_id?: string | null
          name?: string
          psychology_status?: string | null
          target_audience?: string | null
          updated_at?: string | null
          user_id?: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      campaign_templates: {
        Row: {
          active: boolean | null
          audience_type: string
          budget_suggestion: string | null
          campaign_structure: string
          created_at: string | null
          description: string
          icon: string
          id: string
          long_description: string
          name: string
          objective: string
          optimization_event: string | null
          slug: string
          strategy_template: Json
          use_case: string
        }
        Insert: {
          active?: boolean | null
          audience_type: string
          budget_suggestion?: string | null
          campaign_structure: string
          created_at?: string | null
          description: string
          icon: string
          id?: string
          long_description: string
          name: string
          objective: string
          optimization_event?: string | null
          slug: string
          strategy_template: Json
          use_case: string
        }
        Update: {
          active?: boolean | null
          audience_type?: string
          budget_suggestion?: string | null
          campaign_structure?: string
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          long_description?: string
          name?: string
          objective?: string
          optimization_event?: string | null
          slug?: string
          strategy_template?: Json
          use_case?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          ai_generated_description: boolean | null
          ai_generated_price: boolean | null
          brand_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          price_point: string | null
          product_psychology: Json | null
          target_outcome: string | null
          url: string | null
        }
        Insert: {
          ai_generated_description?: boolean | null
          ai_generated_price?: boolean | null
          brand_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price_point?: string | null
          product_psychology?: Json | null
          target_outcome?: string | null
          url?: string | null
        }
        Update: {
          ai_generated_description?: boolean | null
          ai_generated_price?: boolean | null
          brand_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price_point?: string | null
          product_psychology?: Json | null
          target_outcome?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      strategies: {
        Row: {
          audience_psychology: Json | null
          brand_id: string
          campaign_type: string
          contextual_keywords: string[] | null
          created_at: string | null
          id: string
          kpi_benchmarks: Json | null
          messaging_framework: Json | null
          name: string
          offer_description: string | null
          offer_name: string | null
          offer_price: string | null
          offer_url: string | null
          optimization_goals: string[] | null
          status: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          audience_psychology?: Json | null
          brand_id: string
          campaign_type: string
          contextual_keywords?: string[] | null
          created_at?: string | null
          id?: string
          kpi_benchmarks?: Json | null
          messaging_framework?: Json | null
          name: string
          offer_description?: string | null
          offer_name?: string | null
          offer_price?: string | null
          offer_url?: string | null
          optimization_goals?: string[] | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          audience_psychology?: Json | null
          brand_id?: string
          campaign_type?: string
          contextual_keywords?: string[] | null
          created_at?: string | null
          id?: string
          kpi_benchmarks?: Json | null
          messaging_framework?: Json | null
          name?: string
          offer_description?: string | null
          offer_name?: string | null
          offer_price?: string | null
          offer_url?: string | null
          optimization_goals?: string[] | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategies_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "campaign_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      subscription_tier: "starter" | "growth" | "agency_pro"
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
      app_role: ["admin", "user"],
      subscription_tier: ["starter", "growth", "agency_pro"],
    },
  },
} as const
