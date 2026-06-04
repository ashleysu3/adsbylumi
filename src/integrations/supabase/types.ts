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
      account_credits: {
        Row: {
          amount_cents: number
          applied_at: string | null
          created_at: string
          currency: string
          id: string
          note: string | null
          source: string
          source_ref: string | null
          stripe_balance_transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          applied_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          source: string
          source_ref?: string | null
          stripe_balance_transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          applied_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          source?: string
          source_ref?: string | null
          stripe_balance_transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_action_log: {
        Row: {
          action_detail: Json
          action_type: string
          brand_id: string
          created_at: string
          id: string
          meta_entity_id: string | null
          source: string
          workspace_id: string | null
        }
        Insert: {
          action_detail?: Json
          action_type: string
          brand_id: string
          created_at?: string
          id?: string
          meta_entity_id?: string | null
          source?: string
          workspace_id?: string | null
        }
        Update: {
          action_detail?: Json
          action_type?: string
          brand_id?: string
          created_at?: string
          id?: string
          meta_entity_id?: string | null
          source?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_action_log_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_action_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "campaign_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          action_category: string
          admin_email: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          action_category: string
          admin_email: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          action_category?: string
          admin_email?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          admin_id: string
          category: string | null
          created_at: string
          id: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id: string
          category?: string | null
          created_at?: string
          id?: string
          note: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          category?: string | null
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agency_branding: {
        Row: {
          accent_color: string | null
          brand_id: string
          company_name: string | null
          created_at: string | null
          custom_footer_text: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
          white_label_portal: boolean | null
          white_label_reports: boolean | null
        }
        Insert: {
          accent_color?: string | null
          brand_id: string
          company_name?: string | null
          created_at?: string | null
          custom_footer_text?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
          white_label_portal?: boolean | null
          white_label_reports?: boolean | null
        }
        Update: {
          accent_color?: string | null
          brand_id?: string
          company_name?: string | null
          created_at?: string | null
          custom_footer_text?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
          white_label_portal?: boolean | null
          white_label_reports?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_branding_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_clients: {
        Row: {
          ad_literacy_level: string
          brand_id: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          health_status: string
          id: string
          notes: string | null
          slack_client_channel: string | null
          slack_internal_channel: string | null
          updated_at: string
        }
        Insert: {
          ad_literacy_level?: string
          brand_id: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          health_status?: string
          id?: string
          notes?: string | null
          slack_client_channel?: string | null
          slack_internal_channel?: string | null
          updated_at?: string
        }
        Update: {
          ad_literacy_level?: string
          brand_id?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          health_status?: string
          id?: string
          notes?: string | null
          slack_client_channel?: string | null
          slack_internal_channel?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_clients_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
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
      beta_feedback: {
        Row: {
          additional_notes: string | null
          confusing_part: string | null
          created_at: string
          favorite_feature: string | null
          id: string
          missing_feature: string | null
          recommendation_score: number | null
          user_email: string
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          confusing_part?: string | null
          created_at?: string
          favorite_feature?: string | null
          id?: string
          missing_feature?: string | null
          recommendation_score?: number | null
          user_email: string
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          confusing_part?: string | null
          created_at?: string
          favorite_feature?: string | null
          id?: string
          missing_feature?: string | null
          recommendation_score?: number | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      board_items: {
        Row: {
          board_id: string
          created_at: string
          id: string
          inspiration_item_id: string | null
          note: string | null
          status: string
          tags: Json | null
          uploaded_image_url: string | null
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          inspiration_item_id?: string | null
          note?: string | null
          status?: string
          tags?: Json | null
          uploaded_image_url?: string | null
          user_id?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          inspiration_item_id?: string | null
          note?: string | null
          status?: string
          tags?: Json | null
          uploaded_image_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_items_inspiration_item_id_fkey"
            columns: ["inspiration_item_id"]
            isOneToOne: false
            referencedRelation: "inspiration_items"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_assets: {
        Row: {
          brand_id: string | null
          created_at: string
          height: number | null
          id: string
          kept: boolean
          role: string
          source_url: string | null
          url: string
          user_id: string
          width: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          height?: number | null
          id?: string
          kept?: boolean
          role: string
          source_url?: string | null
          url: string
          user_id?: string
          width?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          height?: number | null
          id?: string
          kept?: boolean
          role?: string
          source_url?: string | null
          url?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_content_assets: {
        Row: {
          asset_type: string
          brand_id: string
          content: string
          created_at: string | null
          id: string
          label: string | null
          offer_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          asset_type: string
          brand_id: string
          content: string
          created_at?: string | null
          id?: string
          label?: string | null
          offer_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          asset_type?: string
          brand_id?: string
          content?: string
          created_at?: string | null
          id?: string
          label?: string | null
          offer_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_content_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kits: {
        Row: {
          brand_id: string | null
          colors: Json | null
          created_at: string
          fonts: Json | null
          id: string
          logo_url: string | null
          offer: Json | null
          source_url: string | null
          status: string
          updated_at: string
          user_id: string
          voice: Json | null
        }
        Insert: {
          brand_id?: string | null
          colors?: Json | null
          created_at?: string
          fonts?: Json | null
          id?: string
          logo_url?: string | null
          offer?: Json | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          voice?: Json | null
        }
        Update: {
          brand_id?: string | null
          colors?: Json | null
          created_at?: string
          fonts?: Json | null
          id?: string
          logo_url?: string | null
          offer?: Json | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          voice?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_learnings: {
        Row: {
          brand_id: string
          category: string
          confidence: string
          created_at: string
          id: string
          insight: string
          is_active: boolean
          source_workspace_id: string | null
          supporting_data: string | null
        }
        Insert: {
          brand_id: string
          category: string
          confidence?: string
          created_at?: string
          id?: string
          insight: string
          is_active?: boolean
          source_workspace_id?: string | null
          supporting_data?: string | null
        }
        Update: {
          brand_id?: string
          category?: string
          confidence?: string
          created_at?: string
          id?: string
          insight?: string
          is_active?: boolean
          source_workspace_id?: string | null
          supporting_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_learnings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_learnings_source_workspace_id_fkey"
            columns: ["source_workspace_id"]
            isOneToOne: false
            referencedRelation: "campaign_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_team_members: {
        Row: {
          brand_id: string
          created_at: string
          email: string | null
          id: string
          invite_status: string
          invite_token: string | null
          invited_by: string
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          email?: string | null
          id?: string
          invite_status?: string
          invite_token?: string | null
          invited_by: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          email?: string | null
          id?: string
          invite_status?: string
          invite_token?: string | null
          invited_by?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_team_members_brand_id_fkey"
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
          brand_emojis: string[] | null
          brand_voice: string | null
          broll_library: Json | null
          bullet_emoji: string | null
          copy_perspective: string
          created_at: string | null
          flodesk_api_key: string | null
          flodesk_webhook_id: string | null
          id: string
          industry: string | null
          instagram_account_id: string | null
          instagram_account_name: string | null
          kit_access_token: string | null
          kit_refresh_token: string | null
          kit_webhook_id: string | null
          last_review_date: string | null
          meta_access_token: string | null
          meta_account_id: string | null
          meta_pixel_events: Json | null
          meta_pixel_id: string | null
          meta_pixel_name: string | null
          meta_pixel_verified_at: string | null
          meta_token_expires_at: string | null
          multi_advertiser_ads: boolean | null
          name: string
          never_use_words: string[] | null
          next_report_due: string | null
          notification_preferences: Json | null
          overlay_style: Json | null
          page_id: string | null
          page_name: string | null
          psychology_content_hash: string | null
          psychology_generated_at: string | null
          psychology_status: string | null
          site_links_enabled: boolean | null
          social_proof: Json | null
          social_proof_generated_at: string | null
          target_audience: string | null
          updated_at: string | null
          use_emojis: boolean | null
          user_id: string
          value_proposition: string | null
          voice_profile: Json | null
          voice_profile_generated_at: string | null
          website_url: string | null
        }
        Insert: {
          alert_thresholds?: Json | null
          audience_psychology?: Json | null
          brand_emojis?: string[] | null
          brand_voice?: string | null
          broll_library?: Json | null
          bullet_emoji?: string | null
          copy_perspective?: string
          created_at?: string | null
          flodesk_api_key?: string | null
          flodesk_webhook_id?: string | null
          id?: string
          industry?: string | null
          instagram_account_id?: string | null
          instagram_account_name?: string | null
          kit_access_token?: string | null
          kit_refresh_token?: string | null
          kit_webhook_id?: string | null
          last_review_date?: string | null
          meta_access_token?: string | null
          meta_account_id?: string | null
          meta_pixel_events?: Json | null
          meta_pixel_id?: string | null
          meta_pixel_name?: string | null
          meta_pixel_verified_at?: string | null
          meta_token_expires_at?: string | null
          multi_advertiser_ads?: boolean | null
          name: string
          never_use_words?: string[] | null
          next_report_due?: string | null
          notification_preferences?: Json | null
          overlay_style?: Json | null
          page_id?: string | null
          page_name?: string | null
          psychology_content_hash?: string | null
          psychology_generated_at?: string | null
          psychology_status?: string | null
          site_links_enabled?: boolean | null
          social_proof?: Json | null
          social_proof_generated_at?: string | null
          target_audience?: string | null
          updated_at?: string | null
          use_emojis?: boolean | null
          user_id: string
          value_proposition?: string | null
          voice_profile?: Json | null
          voice_profile_generated_at?: string | null
          website_url?: string | null
        }
        Update: {
          alert_thresholds?: Json | null
          audience_psychology?: Json | null
          brand_emojis?: string[] | null
          brand_voice?: string | null
          broll_library?: Json | null
          bullet_emoji?: string | null
          copy_perspective?: string
          created_at?: string | null
          flodesk_api_key?: string | null
          flodesk_webhook_id?: string | null
          id?: string
          industry?: string | null
          instagram_account_id?: string | null
          instagram_account_name?: string | null
          kit_access_token?: string | null
          kit_refresh_token?: string | null
          kit_webhook_id?: string | null
          last_review_date?: string | null
          meta_access_token?: string | null
          meta_account_id?: string | null
          meta_pixel_events?: Json | null
          meta_pixel_id?: string | null
          meta_pixel_name?: string | null
          meta_pixel_verified_at?: string | null
          meta_token_expires_at?: string | null
          multi_advertiser_ads?: boolean | null
          name?: string
          never_use_words?: string[] | null
          next_report_due?: string | null
          notification_preferences?: Json | null
          overlay_style?: Json | null
          page_id?: string | null
          page_name?: string | null
          psychology_content_hash?: string | null
          psychology_generated_at?: string | null
          psychology_status?: string | null
          site_links_enabled?: boolean | null
          social_proof?: Json | null
          social_proof_generated_at?: string | null
          target_audience?: string | null
          updated_at?: string | null
          use_emojis?: boolean | null
          user_id?: string
          value_proposition?: string | null
          voice_profile?: Json | null
          voice_profile_generated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      broll_libraries: {
        Row: {
          brand_id: string
          clips: Json
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          clips?: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          clips?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broll_libraries_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          assigned_to: string | null
          context: string | null
          conversation_context: string | null
          created_at: string
          current_page: string | null
          current_url: string | null
          details: string | null
          id: string
          priority: string | null
          resolution_notes: string | null
          resolved_at: string | null
          screenshot_url: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          context?: string | null
          conversation_context?: string | null
          created_at?: string
          current_page?: string | null
          current_url?: string | null
          details?: string | null
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          context?: string | null
          conversation_context?: string | null
          created_at?: string
          current_page?: string | null
          current_url?: string | null
          details?: string | null
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_goals: {
        Row: {
          auto_suggested: boolean
          brand_id: string | null
          check_frequency_at: string | null
          created_at: string | null
          created_by: string
          frequency_threshold: number | null
          id: string
          primary_kpi: string
          primary_kpi_goal_type: string
          primary_kpi_label: string
          primary_kpi_threshold: number
          secondary_kpi: string | null
          secondary_kpi_goal_type: string | null
          secondary_kpi_label: string | null
          secondary_kpi_threshold: number | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          auto_suggested?: boolean
          brand_id?: string | null
          check_frequency_at?: string | null
          created_at?: string | null
          created_by: string
          frequency_threshold?: number | null
          id?: string
          primary_kpi: string
          primary_kpi_goal_type: string
          primary_kpi_label: string
          primary_kpi_threshold: number
          secondary_kpi?: string | null
          secondary_kpi_goal_type?: string | null
          secondary_kpi_label?: string | null
          secondary_kpi_threshold?: number | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          auto_suggested?: boolean
          brand_id?: string | null
          check_frequency_at?: string | null
          created_at?: string | null
          created_by?: string
          frequency_threshold?: number | null
          id?: string
          primary_kpi?: string
          primary_kpi_goal_type?: string
          primary_kpi_label?: string
          primary_kpi_threshold?: number
          secondary_kpi?: string | null
          secondary_kpi_goal_type?: string | null
          secondary_kpi_label?: string | null
          secondary_kpi_threshold?: number | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_goals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "campaign_workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          auto_rotate_enabled: boolean | null
          brand_id: string
          broll_library_id: string | null
          campaign_builder_answers: Json | null
          chat_history: Json | null
          created_at: string | null
          creative_feedback: Json | null
          creative_json: Json | null
          custom_conversion_id: string | null
          final_answers: Json | null
          id: string
          loved_concepts: Json | null
          meta_campaign_ids: Json | null
          meta_campaign_status: string | null
          meta_errors: Json | null
          meta_insights_last_sync: string | null
          name: string
          objective: string | null
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
          retrospective_generated_at: string | null
          retrospective_json: Json | null
          rotation_preferences: Json | null
          selected_copy: Json | null
          strategy_id: string | null
          strategy_json: Json | null
          template_id: string | null
          tracking_verified: boolean | null
          updated_at: string | null
          user_uploaded_assets: Json | null
          weekly_report_draft: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          auto_rotate_enabled?: boolean | null
          brand_id: string
          broll_library_id?: string | null
          campaign_builder_answers?: Json | null
          chat_history?: Json | null
          created_at?: string | null
          creative_feedback?: Json | null
          creative_json?: Json | null
          custom_conversion_id?: string | null
          final_answers?: Json | null
          id?: string
          loved_concepts?: Json | null
          meta_campaign_ids?: Json | null
          meta_campaign_status?: string | null
          meta_errors?: Json | null
          meta_insights_last_sync?: string | null
          name: string
          objective?: string | null
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
          retrospective_generated_at?: string | null
          retrospective_json?: Json | null
          rotation_preferences?: Json | null
          selected_copy?: Json | null
          strategy_id?: string | null
          strategy_json?: Json | null
          template_id?: string | null
          tracking_verified?: boolean | null
          updated_at?: string | null
          user_uploaded_assets?: Json | null
          weekly_report_draft?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          auto_rotate_enabled?: boolean | null
          brand_id?: string
          broll_library_id?: string | null
          campaign_builder_answers?: Json | null
          chat_history?: Json | null
          created_at?: string | null
          creative_feedback?: Json | null
          creative_json?: Json | null
          custom_conversion_id?: string | null
          final_answers?: Json | null
          id?: string
          loved_concepts?: Json | null
          meta_campaign_ids?: Json | null
          meta_campaign_status?: string | null
          meta_errors?: Json | null
          meta_insights_last_sync?: string | null
          name?: string
          objective?: string | null
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
          retrospective_generated_at?: string | null
          retrospective_json?: Json | null
          rotation_preferences?: Json | null
          selected_copy?: Json | null
          strategy_id?: string | null
          strategy_json?: Json | null
          template_id?: string | null
          tracking_verified?: boolean | null
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
            foreignKeyName: "campaign_workspaces_broll_library_id_fkey"
            columns: ["broll_library_id"]
            isOneToOne: false
            referencedRelation: "broll_libraries"
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
      cancellation_requests: {
        Row: {
          created_at: string
          id: string
          period_end: string | null
          reason: string
          stripe_subscription_id: string | null
          tier_at_cancellation: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          period_end?: string | null
          reason: string
          stripe_subscription_id?: string | null
          tier_at_cancellation?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string | null
          reason?: string
          stripe_subscription_id?: string | null
          tier_at_cancellation?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      changelog_entries: {
        Row: {
          approval_status: string
          body: string | null
          category: string
          commit_refs: Json
          created_at: string
          created_by: string | null
          id: string
          included_in_campaign_id: string | null
          is_user_visible: boolean
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          body?: string | null
          category?: string
          commit_refs?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          included_in_campaign_id?: string | null
          is_user_visible?: boolean
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          body?: string | null
          category?: string
          commit_refs?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          included_in_campaign_id?: string | null
          is_user_visible?: boolean
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_portal_activity: {
        Row: {
          action: string
          client_name: string | null
          comment: string | null
          created_at: string | null
          id: string
          portal_id: string | null
          production_item_id: string
        }
        Insert: {
          action: string
          client_name?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          portal_id?: string | null
          production_item_id: string
        }
        Update: {
          action?: string
          client_name?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          portal_id?: string | null
          production_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_activity_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portals: {
        Row: {
          access_code_hash: string
          agency_branding: Json | null
          brand_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          items_included: Json | null
          portal_name: string
          status: string | null
          workspace_id: string | null
        }
        Insert: {
          access_code_hash: string
          agency_branding?: Json | null
          brand_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          items_included?: Json | null
          portal_name: string
          status?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_code_hash?: string
          agency_branding?: Json | null
          brand_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          items_included?: Json | null
          portal_name?: string
          status?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "campaign_workspaces"
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
      creative_bench: {
        Row: {
          auto_rotate_approved: boolean
          brand_id: string
          created_at: string
          id: string
          last_live_at: string | null
          meta_ad_id: string | null
          paused_at: string | null
          performance_snapshot: Json | null
          production_item_id: string | null
          retest_eligible_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          auto_rotate_approved?: boolean
          brand_id: string
          created_at?: string
          id?: string
          last_live_at?: string | null
          meta_ad_id?: string | null
          paused_at?: string | null
          performance_snapshot?: Json | null
          production_item_id?: string | null
          retest_eligible_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          auto_rotate_approved?: boolean
          brand_id?: string
          created_at?: string
          id?: string
          last_live_at?: string | null
          meta_ad_id?: string | null
          paused_at?: string | null
          performance_snapshot?: Json | null
          production_item_id?: string | null
          retest_eligible_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_bench_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_bench_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "campaign_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_rotation_log: {
        Row: {
          action: string
          brand_id: string
          created_at: string
          id: string
          new_ad_id: string | null
          old_ad_id: string | null
          reason: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          brand_id: string
          created_at?: string
          id?: string
          new_ad_id?: string | null
          old_ad_id?: string | null
          reason?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          brand_id?: string
          created_at?: string
          id?: string
          new_ad_id?: string | null
          old_ad_id?: string | null
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_rotation_log_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_rotation_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "campaign_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_settings: {
        Row: {
          additional_emails: string[] | null
          alert_on_red: boolean | null
          auto_optimize: boolean | null
          brand_id: string | null
          created_by: string
          date_range_days: number
          enabled: boolean | null
          id: string
          last_sent_at: string | null
          report_auto_send: boolean | null
          send_day: string
          send_days: string[] | null
          send_time: string
          slack_channel_id: string | null
          timezone: string
        }
        Insert: {
          additional_emails?: string[] | null
          alert_on_red?: boolean | null
          auto_optimize?: boolean | null
          brand_id?: string | null
          created_by: string
          date_range_days?: number
          enabled?: boolean | null
          id?: string
          last_sent_at?: string | null
          report_auto_send?: boolean | null
          send_day?: string
          send_days?: string[] | null
          send_time?: string
          slack_channel_id?: string | null
          timezone?: string
        }
        Update: {
          additional_emails?: string[] | null
          alert_on_red?: boolean | null
          auto_optimize?: boolean | null
          brand_id?: string | null
          created_by?: string
          date_range_days?: number
          enabled?: boolean | null
          id?: string
          last_sent_at?: string | null
          report_auto_send?: boolean | null
          send_day?: string
          send_days?: string[] | null
          send_time?: string
          slack_channel_id?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_settings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      email_approval_tokens: {
        Row: {
          action_data: Json
          action_description: string
          brand_id: string
          created_at: string
          expires_at: string
          id: string
          status: string
          token: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action_data?: Json
          action_description: string
          brand_id: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action_data?: Json
          action_description?: string
          brand_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_approval_tokens_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_approval_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "campaign_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          edge_function: string | null
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          recipient_user_id: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          edge_function?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          recipient_user_id?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          edge_function?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          recipient_user_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          edge_function: string | null
          enabled: boolean
          id: string
          intro: string | null
          key: string
          label: string
          outro: string | null
          subject: string | null
          trigger_description: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          edge_function?: string | null
          enabled?: boolean
          id?: string
          intro?: string | null
          key: string
          label: string
          outro?: string | null
          subject?: string | null
          trigger_description?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          edge_function?: string | null
          enabled?: boolean
          id?: string
          intro?: string | null
          key?: string
          label?: string
          outro?: string | null
          subject?: string | null
          trigger_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      inspiration_items: {
        Row: {
          created_at: string
          id: string
          image_url: string
          source: string | null
          tags: Json | null
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          source?: string | null
          tags?: Json | null
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          source?: string | null
          tags?: Json | null
          title?: string | null
        }
        Relationships: []
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
          is_beta: boolean
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
          is_beta?: boolean
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
          is_beta?: boolean
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
          priority: number | null
          source_url: string | null
          subcategory: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          usage_count: number | null
          version: number | null
        }
        Insert: {
          active?: boolean | null
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          priority?: number | null
          source_url?: string | null
          subcategory?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
          version?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          priority?: number | null
          source_url?: string | null
          subcategory?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
          version?: number | null
        }
        Relationships: []
      }
      lumi_features: {
        Row: {
          area: string | null
          category: string
          created_at: string
          highlight: boolean
          id: string
          ideal_audience: string | null
          is_active: boolean
          last_updated_note: string | null
          long_description: string | null
          marketing_angles: string[]
          name: string
          related_pages: string[]
          short_description: string | null
          slug: string | null
          sort_order: number
          status: string
          tags: string[]
          updated_at: string
          why_helpful: string | null
        }
        Insert: {
          area?: string | null
          category?: string
          created_at?: string
          highlight?: boolean
          id?: string
          ideal_audience?: string | null
          is_active?: boolean
          last_updated_note?: string | null
          long_description?: string | null
          marketing_angles?: string[]
          name: string
          related_pages?: string[]
          short_description?: string | null
          slug?: string | null
          sort_order?: number
          status?: string
          tags?: string[]
          updated_at?: string
          why_helpful?: string | null
        }
        Update: {
          area?: string | null
          category?: string
          created_at?: string
          highlight?: boolean
          id?: string
          ideal_audience?: string | null
          is_active?: boolean
          last_updated_note?: string | null
          long_description?: string | null
          marketing_angles?: string[]
          name?: string
          related_pages?: string[]
          short_description?: string | null
          slug?: string | null
          sort_order?: number
          status?: string
          tags?: string[]
          updated_at?: string
          why_helpful?: string | null
        }
        Relationships: []
      }
      meta_connection_checks: {
        Row: {
          brand_id: string
          check_type: string
          checks_performed: Json
          created_at: string
          details: Json
          id: string
          outcome: string
          summary: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          check_type: string
          checks_performed?: Json
          created_at?: string
          details?: Json
          id?: string
          outcome: string
          summary?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          check_type?: string
          checks_performed?: Json
          created_at?: string
          details?: Json
          id?: string
          outcome?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_connection_checks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_campaigns: {
        Row: {
          angles: Json
          created_at: string
          created_by: string | null
          custom_note: string | null
          id: string
          month_label: string
          partner_html: string | null
          partner_resend_subject: string | null
          partner_subject: string | null
          scheduled_at: string | null
          selected_update_ids: string[]
          sent_at: string | null
          status: string
          updated_at: string
          user_html: string | null
          user_resend_subject: string | null
          user_subject: string | null
        }
        Insert: {
          angles?: Json
          created_at?: string
          created_by?: string | null
          custom_note?: string | null
          id?: string
          month_label: string
          partner_html?: string | null
          partner_resend_subject?: string | null
          partner_subject?: string | null
          scheduled_at?: string | null
          selected_update_ids?: string[]
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_html?: string | null
          user_resend_subject?: string | null
          user_subject?: string | null
        }
        Update: {
          angles?: Json
          created_at?: string
          created_by?: string | null
          custom_note?: string | null
          id?: string
          month_label?: string
          partner_html?: string | null
          partner_resend_subject?: string | null
          partner_subject?: string | null
          scheduled_at?: string | null
          selected_update_ids?: string[]
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_html?: string | null
          user_resend_subject?: string | null
          user_subject?: string | null
        }
        Relationships: []
      }
      newsletter_sends: {
        Row: {
          campaign_id: string
          click_count: number
          clicked_at: string | null
          id: string
          message_id: string | null
          opened_at: string | null
          recipient_email: string
          recipient_user_id: string | null
          resend_message_id: string | null
          resent_at: string | null
          sent_at: string
          variant: string
        }
        Insert: {
          campaign_id: string
          click_count?: number
          clicked_at?: string | null
          id?: string
          message_id?: string | null
          opened_at?: string | null
          recipient_email: string
          recipient_user_id?: string | null
          resend_message_id?: string | null
          resent_at?: string | null
          sent_at?: string
          variant: string
        }
        Update: {
          campaign_id?: string
          click_count?: number
          clicked_at?: string | null
          id?: string
          message_id?: string | null
          opened_at?: string | null
          recipient_email?: string
          recipient_user_id?: string | null
          resend_message_id?: string | null
          resent_at?: string | null
          sent_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaigns"
            referencedColumns: ["id"]
          },
        ]
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
          offer_audience_psychology: Json | null
          page_goal: string | null
          price_point: string | null
          product_psychology: Json | null
          psychology_content_hash: string | null
          recommendation_confidence: string | null
          recommendation_reason: string | null
          recommended_template_id: string | null
          target_outcome: string | null
          url: string | null
          use_brand_style_defaults: boolean
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
          offer_audience_psychology?: Json | null
          page_goal?: string | null
          price_point?: string | null
          product_psychology?: Json | null
          psychology_content_hash?: string | null
          recommendation_confidence?: string | null
          recommendation_reason?: string | null
          recommended_template_id?: string | null
          target_outcome?: string | null
          url?: string | null
          use_brand_style_defaults?: boolean
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
          offer_audience_psychology?: Json | null
          page_goal?: string | null
          price_point?: string | null
          product_psychology?: Json | null
          psychology_content_hash?: string | null
          recommendation_confidence?: string | null
          recommendation_reason?: string | null
          recommended_template_id?: string | null
          target_outcome?: string | null
          url?: string | null
          use_brand_style_defaults?: boolean
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
      optimization_reports: {
        Row: {
          brand_id: string | null
          created_at: string | null
          created_by: string
          date_range_end: string
          date_range_start: string
          id: string
          report_data: Json
          share_token: string | null
          status: string | null
          summary: Json | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          created_by: string
          date_range_end: string
          date_range_start: string
          id?: string
          report_data?: Json
          share_token?: string | null
          status?: string | null
          summary?: Json | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string
          date_range_end?: string
          date_range_start?: string
          id?: string
          report_data?: Json
          share_token?: string | null
          status?: string | null
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "optimization_reports_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_access_tokens: {
        Row: {
          audience_strategies: Json
          comped_at: string | null
          comped_by: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          is_active: boolean
          membership_comped: boolean
          partner_application_id: string | null
          partner_display_name: string | null
          partner_email: string | null
          partner_photo_url: string | null
          partner_title: string | null
          partner_trial_code: string | null
          partner_user_id: string | null
          perks: Json
          recommended_features: Json
          recommended_strategies: Json
          referral_link: string | null
          rewardful_affiliate_id: string | null
          share_resources: Json
          stripe_coupon_id: string | null
          stripe_promo_synced_at: string | null
          stripe_promotion_code_id: string | null
          support_links: Json
          token: string
          trial_days: number
          welcome_message: string | null
        }
        Insert: {
          audience_strategies?: Json
          comped_at?: string | null
          comped_by?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          membership_comped?: boolean
          partner_application_id?: string | null
          partner_display_name?: string | null
          partner_email?: string | null
          partner_photo_url?: string | null
          partner_title?: string | null
          partner_trial_code?: string | null
          partner_user_id?: string | null
          perks?: Json
          recommended_features?: Json
          recommended_strategies?: Json
          referral_link?: string | null
          rewardful_affiliate_id?: string | null
          share_resources?: Json
          stripe_coupon_id?: string | null
          stripe_promo_synced_at?: string | null
          stripe_promotion_code_id?: string | null
          support_links?: Json
          token?: string
          trial_days?: number
          welcome_message?: string | null
        }
        Update: {
          audience_strategies?: Json
          comped_at?: string | null
          comped_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          membership_comped?: boolean
          partner_application_id?: string | null
          partner_display_name?: string | null
          partner_email?: string | null
          partner_photo_url?: string | null
          partner_title?: string | null
          partner_trial_code?: string | null
          partner_user_id?: string | null
          perks?: Json
          recommended_features?: Json
          recommended_strategies?: Json
          referral_link?: string | null
          rewardful_affiliate_id?: string | null
          share_resources?: Json
          stripe_coupon_id?: string | null
          stripe_promo_synced_at?: string | null
          stripe_promotion_code_id?: string | null
          support_links?: Json
          token?: string
          trial_days?: number
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_access_tokens_partner_application_id_fkey"
            columns: ["partner_application_id"]
            isOneToOne: false
            referencedRelation: "partner_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_applications: {
        Row: {
          application_type: string
          audience_description: string | null
          created_at: string | null
          email: string
          first_name: string
          how_will_you_share: string | null
          id: string
          last_name: string
          notes: string | null
          promotion_plan: string | null
          rewardful_affiliate_id: string | null
          status: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          application_type: string
          audience_description?: string | null
          created_at?: string | null
          email: string
          first_name: string
          how_will_you_share?: string | null
          id?: string
          last_name: string
          notes?: string | null
          promotion_plan?: string | null
          rewardful_affiliate_id?: string | null
          status?: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          application_type?: string
          audience_description?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          how_will_you_share?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          promotion_plan?: string | null
          rewardful_affiliate_id?: string | null
          status?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      partner_updates: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_published: boolean
          link_label: string | null
          link_url: string | null
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          link_label?: string | null
          link_url?: string | null
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          link_label?: string | null
          link_url?: string | null
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_optimizations: {
        Row: {
          action_description: string
          auto_applied: boolean
          brand_id: string
          created_at: string
          id: string
          meta_action: Json | null
          recommendation_type: string
          report_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          workspace_id: string | null
        }
        Insert: {
          action_description: string
          auto_applied?: boolean
          brand_id: string
          created_at?: string
          id?: string
          meta_action?: Json | null
          recommendation_type: string
          report_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          workspace_id?: string | null
        }
        Update: {
          action_description?: string
          auto_applied?: boolean
          brand_id?: string
          created_at?: string
          id?: string
          meta_action?: Json | null
          recommendation_type?: string
          report_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_optimizations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_optimizations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "optimization_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_optimizations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "campaign_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          beta_feedback_email_sent: boolean
          created_at: string | null
          email: string
          first_campaign_launched_at: string | null
          full_name: string | null
          id: string
          is_agency_user: boolean | null
          is_beta_user: boolean
          last_seen_updates_at: string | null
          newsletter_opt_in: boolean
          onboarding_email_step: number
          policy_acknowledged_at: string | null
          referral_code: string | null
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          beta_feedback_email_sent?: boolean
          created_at?: string | null
          email: string
          first_campaign_launched_at?: string | null
          full_name?: string | null
          id: string
          is_agency_user?: boolean | null
          is_beta_user?: boolean
          last_seen_updates_at?: string | null
          newsletter_opt_in?: boolean
          onboarding_email_step?: number
          policy_acknowledged_at?: string | null
          referral_code?: string | null
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          beta_feedback_email_sent?: boolean
          created_at?: string | null
          email?: string
          first_campaign_launched_at?: string | null
          full_name?: string | null
          id?: string
          is_agency_user?: boolean | null
          is_beta_user?: boolean
          last_seen_updates_at?: string | null
          newsletter_opt_in?: boolean
          onboarding_email_step?: number
          policy_acknowledged_at?: string | null
          referral_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recommended_strategies: {
        Row: {
          business_model: string[]
          campaigns: Json
          created_at: string
          created_by: string | null
          description: string
          id: string
          industry: string[]
          is_active: boolean
          keywords: string[]
          name: string
          primary_goals: string[]
          slug: string
          sort_order: number
          updated_at: string
          why_it_works: string
        }
        Insert: {
          business_model?: string[]
          campaigns?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          industry?: string[]
          is_active?: boolean
          keywords?: string[]
          name: string
          primary_goals?: string[]
          slug: string
          sort_order?: number
          updated_at?: string
          why_it_works?: string
        }
        Update: {
          business_model?: string[]
          campaigns?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          industry?: string[]
          is_active?: boolean
          keywords?: string[]
          name?: string
          primary_goals?: string[]
          slug?: string
          sort_order?: number
          updated_at?: string
          why_it_works?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          credited_at: string | null
          id: string
          referred_email: string
          referred_user_id: string | null
          referrer_user_id: string
          source: string
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_email: string
          referred_user_id?: string | null
          referrer_user_id: string
          source?: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_email?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      review_logs: {
        Row: {
          action_plan: string | null
          ad_level_data: Json
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          brand_id: string
          campaign_metrics: Json
          created_at: string
          id: string
          notes: string | null
          review_date: string
          reviewer_id: string
        }
        Insert: {
          action_plan?: string | null
          ad_level_data?: Json
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          brand_id: string
          campaign_metrics?: Json
          created_at?: string
          id?: string
          notes?: string | null
          review_date?: string
          reviewer_id: string
        }
        Update: {
          action_plan?: string | null
          ad_level_data?: Json
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          brand_id?: string
          campaign_metrics?: Json
          created_at?: string
          id?: string
          notes?: string | null
          review_date?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
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
      strategy_requests: {
        Row: {
          admin_notes: string | null
          admin_response: Json | null
          brand_id: string
          brand_snapshot: Json
          created_at: string
          id: string
          responded_at: string | null
          status: string
          user_goal: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          admin_response?: Json | null
          brand_id: string
          brand_snapshot?: Json
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_goal?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          admin_response?: Json | null
          brand_id?: string
          brand_snapshot?: Json
          created_at?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_goal?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          id: string
          price_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      template_requests: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          locked_at: string | null
          notes: string | null
          reference_url: string
          requested_by: string
          result: Json | null
          source_path: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          locked_at?: string | null
          notes?: string | null
          reference_url: string
          requested_by: string
          result?: Json | null
          source_path?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          locked_at?: string | null
          notes?: string | null
          reference_url?: string
          requested_by?: string
          result?: Json | null
          source_path?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          copy_slots: Json
          created_at: string
          html: string | null
          id: string
          name: string | null
          needs_photo: boolean
          placements: Json
          preview_url: string | null
          slide_slots: Json
          source_image_url: string | null
          status: string
          style_hint: string | null
          type: string
        }
        Insert: {
          copy_slots?: Json
          created_at?: string
          html?: string | null
          id?: string
          name?: string | null
          needs_photo?: boolean
          placements?: Json
          preview_url?: string | null
          slide_slots?: Json
          source_image_url?: string | null
          status?: string
          style_hint?: string | null
          type?: string
        }
        Update: {
          copy_slots?: Json
          created_at?: string
          html?: string | null
          id?: string
          name?: string | null
          needs_photo?: boolean
          placements?: Json
          preview_url?: string | null
          slide_slots?: Json
          source_image_url?: string | null
          status?: string
          style_hint?: string | null
          type?: string
        }
        Relationships: []
      }
      text_overlay_templates: {
        Row: {
          bg_color: string
          bg_opacity: number
          created_at: string
          created_by: string | null
          description: string | null
          font_family: string
          font_size: number
          font_weight: string
          id: string
          is_active: boolean
          letter_case: string
          name: string
          position: string
          reference_video_storage_path: string | null
          reference_video_url: string | null
          sort_order: number
          text_color: string
          text_shadow: boolean
          text_stroke_color: string | null
          text_stroke_width: number
          updated_at: string
        }
        Insert: {
          bg_color?: string
          bg_opacity?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          font_family?: string
          font_size?: number
          font_weight?: string
          id?: string
          is_active?: boolean
          letter_case?: string
          name: string
          position?: string
          reference_video_storage_path?: string | null
          reference_video_url?: string | null
          sort_order?: number
          text_color?: string
          text_shadow?: boolean
          text_stroke_color?: string | null
          text_stroke_width?: number
          updated_at?: string
        }
        Update: {
          bg_color?: string
          bg_opacity?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          font_family?: string
          font_size?: number
          font_weight?: string
          id?: string
          is_active?: boolean
          letter_case?: string
          name?: string
          position?: string
          reference_video_storage_path?: string | null
          reference_video_url?: string | null
          sort_order?: number
          text_color?: string
          text_shadow?: boolean
          text_stroke_color?: string | null
          text_stroke_width?: number
          updated_at?: string
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
      user_assets: {
        Row: {
          created_at: string
          cutout_url: string | null
          id: string
          kind: string | null
          original_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          cutout_url?: string | null
          id?: string
          kind?: string | null
          original_url?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          cutout_url?: string | null
          id?: string
          kind?: string | null
          original_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_reviews: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          approved_quote: string | null
          business_name: string
          created_at: string
          email: string
          id: string
          instagram_handle: string | null
          rating: number
          review_text: string
          reviewer_name: string
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_quote?: string | null
          business_name: string
          created_at?: string
          email: string
          id?: string
          instagram_handle?: string | null
          rating?: number
          review_text: string
          reviewer_name: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_quote?: string | null
          business_name?: string
          created_at?: string
          email?: string
          id?: string
          instagram_handle?: string | null
          rating?: number
          review_text?: string
          reviewer_name?: string
          status?: string
          updated_at?: string
          website_url?: string | null
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
      weekly_reports: {
        Row: {
          brand_id: string
          campaign_statuses: Json
          created_at: string
          date_range_end: string
          date_range_start: string
          id: string
          metrics_snapshot: Json
          recommendations_snapshot: Json
          report_text: string
        }
        Insert: {
          brand_id: string
          campaign_statuses?: Json
          created_at?: string
          date_range_end: string
          date_range_start: string
          id?: string
          metrics_snapshot?: Json
          recommendations_snapshot?: Json
          report_text: string
        }
        Update: {
          brand_id?: string
          campaign_statuses?: Json
          created_at?: string
          date_range_end?: string
          date_range_start?: string
          id?: string
          metrics_snapshot?: Json
          recommendations_snapshot?: Json
          report_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      winback_offers: {
        Row: {
          accepted_at: string | null
          consent_ip: string | null
          consent_user_agent: string | null
          created_at: string
          created_by_admin_id: string | null
          currency: string
          email: string
          expires_at: string
          id: string
          interval: string
          offered_price_cents: number
          price_id: string | null
          start_choice: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          token: string
          trial_days: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          consent_ip?: string | null
          consent_user_agent?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          currency?: string
          email: string
          expires_at?: string
          id?: string
          interval?: string
          offered_price_cents: number
          price_id?: string | null
          start_choice?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          token: string
          trial_days?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          consent_ip?: string | null
          consent_user_agent?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          currency?: string
          email?: string
          expires_at?: string
          id?: string
          interval?: string
          offered_price_cents?: number
          price_id?: string | null
          start_choice?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          token?: string
          trial_days?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invite: { Args: { p_token: string }; Returns: Json }
      admin_get_newsletter_signals: { Args: never; Returns: Json }
      admin_link_partner_user: {
        Args: { p_email: string; p_partner_id: string }
        Returns: Json
      }
      claim_first_campaign_launch: { Args: never; Returns: boolean }
      claim_invite_code: { Args: { code_input: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_meta_token: { Args: { p_brand_id: string }; Returns: boolean }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_referral_code: { Args: never; Returns: string }
      get_meta_token: { Args: { p_brand_id: string }; Returns: string }
      get_my_partner_portal: { Args: never; Returns: Json }
      get_my_referral_summary: { Args: never; Returns: Json }
      get_partner_portal_admin: {
        Args: { p_partner_id: string }
        Returns: Json
      }
      get_partner_welcome: { Args: { p_code: string }; Returns: Json }
      get_shared_report: { Args: { p_share_token: string }; Returns: Json }
      get_whats_new: { Args: never; Returns: Json }
      get_winback_offer_by_token: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_current_user_comped_partner: { Args: never; Returns: boolean }
      mark_updates_seen: { Args: never; Returns: undefined }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      store_meta_token: {
        Args: { p_brand_id: string; p_token: string }
        Returns: string
      }
      validate_invite_code: { Args: { p_code: string }; Returns: boolean }
      validate_partner_trial_code: {
        Args: { p_code: string }
        Returns: boolean
      }
      validate_portal_access: { Args: { p_portal_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
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
      app_role: ["admin", "user", "moderator"],
      subscription_tier: ["starter", "growth", "agency_pro"],
    },
  },
} as const
