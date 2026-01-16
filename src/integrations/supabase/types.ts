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
      brand_vault_secrets: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          secret_name: string
          vault_secret_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          secret_name: string
          vault_secret_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          secret_name?: string
          vault_secret_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_vault_secrets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          alert_thresholds: Json | null
          audience_psychology: Json | null
          brand_voice: string | null
          created_at: string | null
          id: string
          industry: string | null
          instagram_account_id: string | null
          instagram_account_name: string | null
          meta_access_token: string | null
          meta_account_id: string | null
          meta_pixel_events: Json | null
          meta_pixel_id: string | null
          meta_pixel_name: string | null
          meta_pixel_verified_at: string | null
          meta_token_expires_at: string | null
          multi_advertiser_ads: boolean | null
          name: string
          notification_preferences: Json | null
          page_id: string | null
          page_name: string | null
          psychology_status: string | null
          site_links_enabled: boolean | null
          target_audience: string | null
          updated_at: string | null
          user_id: string
          value_proposition: string | null
          website_url: string | null
        }
        Insert: {
          alert_thresholds?: Json | null
          audience_psychology?: Json | null
          brand_voice?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          instagram_account_id?: string | null
          instagram_account_name?: string | null
          meta_access_token?: string | null
          meta_account_id?: string | null
          meta_pixel_events?: Json | null
          meta_pixel_id?: string | null
          meta_pixel_name?: string | null
          meta_pixel_verified_at?: string | null
          meta_token_expires_at?: string | null
          multi_advertiser_ads?: boolean | null
          name: string
          notification_preferences?: Json | null
          page_id?: string | null
          page_name?: string | null
          psychology_status?: string | null
          site_links_enabled?: boolean | null
          target_audience?: string | null
          updated_at?: string | null
          user_id: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Update: {
          alert_thresholds?: Json | null
          audience_psychology?: Json | null
          brand_voice?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          instagram_account_id?: string | null
          instagram_account_name?: string | null
          meta_access_token?: string | null
          meta_account_id?: string | null
          meta_pixel_events?: Json | null
          meta_pixel_id?: string | null
          meta_pixel_name?: string | null
          meta_pixel_verified_at?: string | null
          meta_token_expires_at?: string | null
          multi_advertiser_ads?: boolean | null
          name?: string
          notification_preferences?: Json | null
          page_id?: string | null
          page_name?: string | null
          psychology_status?: string | null
          site_links_enabled?: boolean | null
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
          journey_stages: Json | null
          kpi_benchmarks: Json | null
          kpi_priorities: Json | null
          long_description: string
          name: string
          objective: string
          optimization_event: string | null
          prepopulated_fields: Json | null
          purpose: string | null
          slug: string
          sort_order: number | null
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
          journey_stages?: Json | null
          kpi_benchmarks?: Json | null
          kpi_priorities?: Json | null
          long_description: string
          name: string
          objective: string
          optimization_event?: string | null
          prepopulated_fields?: Json | null
          purpose?: string | null
          slug: string
          sort_order?: number | null
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
          journey_stages?: Json | null
          kpi_benchmarks?: Json | null
          kpi_priorities?: Json | null
          long_description?: string
          name?: string
          objective?: string
          optimization_event?: string | null
          prepopulated_fields?: Json | null
          purpose?: string | null
          slug?: string
          sort_order?: number | null
          strategy_template?: Json
          use_case?: string
        }
        Relationships: []
      }
      campaign_workspaces: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          brand_id: string
          campaign_builder_answers: Json | null
          chat_history: Json | null
          created_at: string | null
          creative_feedback: Json | null
          creative_json: Json | null
          final_answers: Json | null
          id: string
          loved_concepts: Json | null
          meta_campaign_ids: Json | null
          meta_campaign_status: string | null
          meta_errors: Json | null
          meta_insights_last_sync: string | null
          name: string
          offer_description: string | null
          offer_id: string | null
          offer_name: string | null
          offer_price: string | null
          offer_url: string | null
          performance_history: Json | null
          performance_report_latest: Json | null
          performance_reports: Json | null
          production_checklist: Json | null
          production_items: Json | null
          progress_status: string
          published_at: string | null
          selected_copy: Json | null
          strategy_id: string | null
          strategy_json: Json | null
          template_id: string | null
          updated_at: string | null
          user_uploaded_assets: Json | null
          weekly_report_draft: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          brand_id: string
          campaign_builder_answers?: Json | null
          chat_history?: Json | null
          created_at?: string | null
          creative_feedback?: Json | null
          creative_json?: Json | null
          final_answers?: Json | null
          id?: string
          loved_concepts?: Json | null
          meta_campaign_ids?: Json | null
          meta_campaign_status?: string | null
          meta_errors?: Json | null
          meta_insights_last_sync?: string | null
          name: string
          offer_description?: string | null
          offer_id?: string | null
          offer_name?: string | null
          offer_price?: string | null
          offer_url?: string | null
          performance_history?: Json | null
          performance_report_latest?: Json | null
          performance_reports?: Json | null
          production_checklist?: Json | null
          production_items?: Json | null
          progress_status?: string
          published_at?: string | null
          selected_copy?: Json | null
          strategy_id?: string | null
          strategy_json?: Json | null
          template_id?: string | null
          updated_at?: string | null
          user_uploaded_assets?: Json | null
          weekly_report_draft?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          brand_id?: string
          campaign_builder_answers?: Json | null
          chat_history?: Json | null
          created_at?: string | null
          creative_feedback?: Json | null
          creative_json?: Json | null
          final_answers?: Json | null
          id?: string
          loved_concepts?: Json | null
          meta_campaign_ids?: Json | null
          meta_campaign_status?: string | null
          meta_errors?: Json | null
          meta_insights_last_sync?: string | null
          name?: string
          offer_description?: string | null
          offer_id?: string | null
          offer_name?: string | null
          offer_price?: string | null
          offer_url?: string | null
          performance_history?: Json | null
          performance_report_latest?: Json | null
          performance_reports?: Json | null
          production_checklist?: Json | null
          production_items?: Json | null
          progress_status?: string
          published_at?: string | null
          selected_copy?: Json | null
          strategy_id?: string | null
          strategy_json?: Json | null
          template_id?: string | null
          updated_at?: string | null
          user_uploaded_assets?: Json | null
          weekly_report_draft?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_workspaces_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_workspaces_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_workspaces_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_workspaces_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "campaign_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ideas: {
        Row: {
          brand_id: string
          content: string | null
          created_at: string
          id: string
          offer_id: string | null
          status: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          content?: string | null
          created_at?: string
          id?: string
          offer_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          content?: string | null
          created_at?: string
          id?: string
          offer_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          active: boolean | null
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          active?: boolean | null
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          ai_generated_description: boolean | null
          ai_generated_price: boolean | null
          archived: boolean | null
          archived_at: string | null
          brand_id: string
          created_at: string | null
          description: string | null
          id: string
          messaging_guidelines: Json | null
          name: string
          page_goal: string | null
          price_point: string | null
          product_psychology: Json | null
          recommendation_confidence: string | null
          recommendation_reason: string | null
          recommended_template_id: string | null
          target_outcome: string | null
          url: string | null
        }
        Insert: {
          ai_generated_description?: boolean | null
          ai_generated_price?: boolean | null
          archived?: boolean | null
          archived_at?: string | null
          brand_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          messaging_guidelines?: Json | null
          name: string
          page_goal?: string | null
          price_point?: string | null
          product_psychology?: Json | null
          recommendation_confidence?: string | null
          recommendation_reason?: string | null
          recommended_template_id?: string | null
          target_outcome?: string | null
          url?: string | null
        }
        Update: {
          ai_generated_description?: boolean | null
          ai_generated_price?: boolean | null
          archived?: boolean | null
          archived_at?: string | null
          brand_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          messaging_guidelines?: Json | null
          name?: string
          page_goal?: string | null
          price_point?: string | null
          product_psychology?: Json | null
          recommendation_confidence?: string | null
          recommendation_reason?: string | null
          recommended_template_id?: string | null
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
          {
            foreignKeyName: "offers_recommended_template_id_fkey"
            columns: ["recommended_template_id"]
            isOneToOne: false
            referencedRelation: "campaign_templates"
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
      user_alerts: {
        Row: {
          action_label: string | null
          action_url: string | null
          brand_id: string | null
          created_at: string
          dismissed_at: string | null
          expires_at: string | null
          id: string
          message: string
          read_at: string | null
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          brand_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          message: string
          read_at?: string | null
          severity?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          brand_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          read_at?: string | null
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_alerts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
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
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_at: string | null
          name: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_at?: string | null
          name?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_at?: string | null
          name?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_invite_code: { Args: { code_input: string }; Returns: boolean }
      delete_meta_token: { Args: { p_brand_id: string }; Returns: boolean }
      get_meta_token: { Args: { p_brand_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      store_meta_token: {
        Args: { p_brand_id: string; p_token: string }
        Returns: string
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
