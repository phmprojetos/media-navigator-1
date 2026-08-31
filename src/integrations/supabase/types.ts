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
      agencies: {
        Row: {
          admin_email: string | null
          created_at: string
          id: string
          is_platform: boolean
          name: string
          onboarding_status: string
          slug: string
          updated_at: string
        }
        Insert: {
          admin_email?: string | null
          created_at?: string
          id?: string
          is_platform?: boolean
          name: string
          onboarding_status?: string
          slug: string
          updated_at?: string
        }
        Update: {
          admin_email?: string | null
          created_at?: string
          id?: string
          is_platform?: boolean
          name?: string
          onboarding_status?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          agency_id: string | null
          bairro: string | null
          city: string | null
          cnpj: string | null
          codigo: string | null
          company_name: string
          complemento: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          cpf: string | null
          created_at: string
          data_fundacao: string | null
          document_type: string
          email_contato: string | null
          id: string
          id_estrangeiro: string | null
          municipal_registration: string | null
          notes: string | null
          numero: string | null
          rebate_tiers: Json | null
          state: string | null
          state_registration: string | null
          status: string | null
          telefone: string | null
          trade_name: string | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          agency_id?: string | null
          bairro?: string | null
          city?: string | null
          cnpj?: string | null
          codigo?: string | null
          company_name: string
          complemento?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          data_fundacao?: string | null
          document_type?: string
          email_contato?: string | null
          id?: string
          id_estrangeiro?: string | null
          municipal_registration?: string | null
          notes?: string | null
          numero?: string | null
          rebate_tiers?: Json | null
          state?: string | null
          state_registration?: string | null
          status?: string | null
          telefone?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          agency_id?: string | null
          bairro?: string | null
          city?: string | null
          cnpj?: string | null
          codigo?: string | null
          company_name?: string
          complemento?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          data_fundacao?: string | null
          document_type?: string
          email_contato?: string | null
          id?: string
          id_estrangeiro?: string | null
          municipal_registration?: string | null
          notes?: string | null
          numero?: string | null
          rebate_tiers?: Json | null
          state?: string | null
          state_registration?: string | null
          status?: string | null
          telefone?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      efficiency_scores: {
        Row: {
          agency_id: string | null
          bottleneck_dimension: string | null
          bottleneck_severity: string | null
          calculated_at: string | null
          campaign_id: string
          campaign_objective_type: string
          client_id: string | null
          cost_efficiency_score: number | null
          created_at: string
          funnel_bottom_clicks: number | null
          funnel_bottom_impressions: number | null
          funnel_conversions: number | null
          funnel_mid_clicks: number | null
          funnel_mid_impressions: number | null
          funnel_stage: string
          funnel_top_clicks: number | null
          funnel_top_impressions: number | null
          id: string
          inventory_quality_score: number | null
          mbes_classification: string | null
          mbes_score: number
          mes_classification: string | null
          mes_model: string
          mes_score: number
          operational_quality_score: number | null
          oqs_classification: string | null
          oqs_score: number | null
          period_end: string | null
          period_start: string | null
          platform: string
          raw_metrics: Json | null
          recorded_at: string
          scalability_score: number | null
          sps_classification: string | null
          sps_score: number | null
          structural_stability_score: number | null
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          bottleneck_dimension?: string | null
          bottleneck_severity?: string | null
          calculated_at?: string | null
          campaign_id: string
          campaign_objective_type: string
          client_id?: string | null
          cost_efficiency_score?: number | null
          created_at?: string
          funnel_bottom_clicks?: number | null
          funnel_bottom_impressions?: number | null
          funnel_conversions?: number | null
          funnel_mid_clicks?: number | null
          funnel_mid_impressions?: number | null
          funnel_stage: string
          funnel_top_clicks?: number | null
          funnel_top_impressions?: number | null
          id?: string
          inventory_quality_score?: number | null
          mbes_classification?: string | null
          mbes_score: number
          mes_classification?: string | null
          mes_model: string
          mes_score: number
          operational_quality_score?: number | null
          oqs_classification?: string | null
          oqs_score?: number | null
          period_end?: string | null
          period_start?: string | null
          platform: string
          raw_metrics?: Json | null
          recorded_at?: string
          scalability_score?: number | null
          sps_classification?: string | null
          sps_score?: number | null
          structural_stability_score?: number | null
          user_id: string
        }
        Update: {
          agency_id?: string | null
          bottleneck_dimension?: string | null
          bottleneck_severity?: string | null
          calculated_at?: string | null
          campaign_id?: string
          campaign_objective_type?: string
          client_id?: string | null
          cost_efficiency_score?: number | null
          created_at?: string
          funnel_bottom_clicks?: number | null
          funnel_bottom_impressions?: number | null
          funnel_conversions?: number | null
          funnel_mid_clicks?: number | null
          funnel_mid_impressions?: number | null
          funnel_stage?: string
          funnel_top_clicks?: number | null
          funnel_top_impressions?: number | null
          id?: string
          inventory_quality_score?: number | null
          mbes_classification?: string | null
          mbes_score?: number
          mes_classification?: string | null
          mes_model?: string
          mes_score?: number
          operational_quality_score?: number | null
          oqs_classification?: string | null
          oqs_score?: number | null
          period_end?: string | null
          period_start?: string | null
          platform?: string
          raw_metrics?: Json | null
          recorded_at?: string
          scalability_score?: number | null
          sps_classification?: string | null
          sps_score?: number | null
          structural_stability_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      evolution_api_configs: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          id: string
          instance_name: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          id?: string
          instance_name: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      media_plans: {
        Row: {
          active_scenario_id: string | null
          campaign: string
          client: string
          company_logo: string | null
          created_at: string
          id: string
          plan_id: string
          quarter: string | null
          scenarios: Json
          status: string
          taxonomy: string | null
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          active_scenario_id?: string | null
          campaign: string
          client: string
          company_logo?: string | null
          created_at?: string
          id?: string
          plan_id: string
          quarter?: string | null
          scenarios?: Json
          status?: string
          taxonomy?: string | null
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          active_scenario_id?: string | null
          campaign?: string
          client?: string
          company_logo?: string | null
          created_at?: string
          id?: string
          plan_id?: string
          quarter?: string | null
          scenarios?: Json
          status?: string
          taxonomy?: string | null
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      meta_leads: {
        Row: {
          ad_account_id: string | null
          ad_id: string | null
          campaign_name: string | null
          created_at: string
          email: string | null
          form_id: string | null
          full_name: string | null
          id: string
          lead_id: string
          page_id: string | null
          phone: string | null
          raw_field_data: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id?: string | null
          ad_id?: string | null
          campaign_name?: string | null
          created_at?: string
          email?: string | null
          form_id?: string | null
          full_name?: string | null
          id?: string
          lead_id: string
          page_id?: string | null
          phone?: string | null
          raw_field_data?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string | null
          ad_id?: string | null
          campaign_name?: string | null
          created_at?: string
          email?: string | null
          form_id?: string | null
          full_name?: string | null
          id?: string
          lead_id?: string
          page_id?: string | null
          phone?: string | null
          raw_field_data?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_webhook_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          page_access_token: string | null
          page_id: string | null
          updated_at: string
          user_id: string
          verify_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          page_access_token?: string | null
          page_id?: string | null
          updated_at?: string
          user_id: string
          verify_token: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          page_access_token?: string | null
          page_id?: string | null
          updated_at?: string
          user_id?: string
          verify_token?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          module_key?: string
          updated_at?: string
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
      whatsapp_routing_rules: {
        Row: {
          created_at: string
          destination_numbers: string[]
          id: string
          is_active: boolean
          name: string
          source_type: string
          source_value: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_numbers?: string[]
          id?: string
          is_active?: boolean
          name: string
          source_type?: string
          source_value?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination_numbers?: string[]
          id?: string
          is_active?: boolean
          name?: string
          source_type?: string
          source_value?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      provision_agency: {
        Args: {
          p_agency_name: string
          p_admin_email: string
          p_admin_name?: string | null
          p_admin_password?: string | null
        }
        Returns: Json
      }
      is_platform_ops: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "operador" | "super_admin"
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
      app_role: ["admin", "gestor", "operador", "super_admin"],
    },
  },
} as const
