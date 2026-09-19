// Generado con la Supabase MCP tool `generate_typescript_types` contra el
// proyecto afzbblteskkbmlgrrfkv después de aplicar supabase/migrations/.
// Regenerar cuando cambie el esquema (misma herramienta, o
// `npx supabase gen types typescript --project-id afzbblteskkbmlgrrfkv`).

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
  public: {
    Tables: {
      agent_settings: {
        Row: {
          autonomous_enabled: boolean
          business_hours: Json | null
          id: boolean
          model: string
          system_prompt: string
          temperature: number
          updated_at: string
        }
        Insert: {
          autonomous_enabled?: boolean
          business_hours?: Json | null
          id?: boolean
          model?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
        }
        Update: {
          autonomous_enabled?: boolean
          business_hours?: Json | null
          id?: boolean
          model?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_channels: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          contact_id: string
          created_at: string
          display_name: string | null
          external_id: string
          id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["channel_type"]
          contact_id: string
          created_at?: string
          display_name?: string | null
          external_id: string
          id?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          contact_id?: string
          created_at?: string
          display_name?: string | null
          external_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_channels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_contacted_at: string | null
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_contacted_at?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_contacted_at?: string | null
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          assigned_to: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          contact_id: string
          created_at: string
          deal_id: string | null
          id: string
          last_message_at: string | null
          status: string
          unread_count: number
        }
        Insert: {
          ai_enabled?: boolean
          assigned_to?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          contact_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          last_message_at?: string | null
          status?: string
          unread_count?: number
        }
        Update: {
          ai_enabled?: boolean
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          contact_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          last_message_at?: string | null
          status?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_deal_fk"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          closed_at: string | null
          contact_id: string
          created_at: string
          id: string
          pax: number | null
          source: Database["public"]["Enums"]["channel_type"] | null
          stage_id: string
          title: string | null
          tour_date: string | null
          tour_id: string | null
          updated_at: string
          value_cop: number | null
        }
        Insert: {
          closed_at?: string | null
          contact_id: string
          created_at?: string
          id?: string
          pax?: number | null
          source?: Database["public"]["Enums"]["channel_type"] | null
          stage_id: string
          title?: string | null
          tour_date?: string | null
          tour_id?: string | null
          updated_at?: string
          value_cop?: number | null
        }
        Update: {
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          pax?: number | null
          source?: Database["public"]["Enums"]["channel_type"] | null
          stage_id?: string
          title?: string | null
          tour_date?: string | null
          tour_id?: string | null
          updated_at?: string
          value_cop?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor: string
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          deal_id: string | null
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          actor: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          deal_id?: string | null
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          actor?: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          deal_id?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_processed: boolean
          channel: Database["public"]["Enums"]["channel_type"]
          content_type: Database["public"]["Enums"]["content_type_enum"]
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string | null
          id: string
          media_mime_type: string | null
          media_storage_path: string | null
          raw_payload: Json | null
          sender_type: Database["public"]["Enums"]["sender_type_enum"]
          status: string
          text_body: string | null
          transcript: string | null
          vision_analysis: Json | null
        }
        Insert: {
          ai_processed?: boolean
          channel: Database["public"]["Enums"]["channel_type"]
          content_type?: Database["public"]["Enums"]["content_type_enum"]
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          id?: string
          media_mime_type?: string | null
          media_storage_path?: string | null
          raw_payload?: Json | null
          sender_type: Database["public"]["Enums"]["sender_type_enum"]
          status?: string
          text_body?: string | null
          transcript?: string | null
          vision_analysis?: Json | null
        }
        Update: {
          ai_processed?: boolean
          channel?: Database["public"]["Enums"]["channel_type"]
          content_type?: Database["public"]["Enums"]["content_type_enum"]
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          id?: string
          media_mime_type?: string | null
          media_storage_path?: string | null
          raw_payload?: Json | null
          sender_type?: Database["public"]["Enums"]["sender_type_enum"]
          status?: string
          text_body?: string | null
          transcript?: string | null
          vision_analysis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author: string
          body: string
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
        }
        Insert: {
          author?: string
          body: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
        }
        Update: {
          author?: string
          body?: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          position: number
        }
        Insert: {
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          position: number
        }
        Update: {
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          description: string | null
          due_at: string | null
          id: string
          status: string
          title: string
        }
        Insert: {
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          status?: string
          title: string
        }
        Update: {
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_media: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_primary: boolean
          source: Database["public"]["Enums"]["tour_media_source"]
          storage_path: string
          tour_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          source?: Database["public"]["Enums"]["tour_media_source"]
          storage_path: string
          tour_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          source?: Database["public"]["Enums"]["tour_media_source"]
          storage_path?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_media_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          duration: string | null
          highlights: Json
          id: string
          includes: Json
          name: string
          note: string | null
          pickup_text: string | null
          price_cop: number | null
          price_unit: string | null
          schedule_text: string | null
          slug: string
          tag: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          highlights?: Json
          id?: string
          includes?: Json
          name: string
          note?: string | null
          pickup_text?: string | null
          price_cop?: number | null
          price_unit?: string | null
          schedule_text?: string | null
          slug: string
          tag?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          highlights?: Json
          id?: string
          includes?: Json
          name?: string
          note?: string | null
          pickup_text?: string | null
          price_cop?: number | null
          price_unit?: string | null
          schedule_text?: string | null
          slug?: string
          tag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      channel_type: "whatsapp" | "instagram" | "messenger" | "internal"
      content_type_enum:
        | "text"
        | "audio"
        | "image"
        | "video"
        | "document"
        | "sticker"
        | "location"
        | "template"
      message_direction: "inbound" | "outbound"
      sender_type_enum: "contact" | "agent_ai" | "agent_human" | "system"
      tour_media_source: "catalog" | "ai_generated"
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
      channel_type: ["whatsapp", "instagram", "messenger", "internal"],
      content_type_enum: [
        "text",
        "audio",
        "image",
        "video",
        "document",
        "sticker",
        "location",
        "template",
      ],
      message_direction: ["inbound", "outbound"],
      sender_type_enum: ["contact", "agent_ai", "agent_human", "system"],
      tour_media_source: ["catalog", "ai_generated"],
    },
  },
} as const
