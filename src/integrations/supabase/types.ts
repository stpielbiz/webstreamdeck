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
      device_codes: {
        Row: {
          approved_at: string | null
          code: string
          consumed_at: string | null
          created_at: string
          device_label: string | null
          expires_at: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          code: string
          consumed_at?: string | null
          created_at?: string
          device_label?: string | null
          expires_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          code?: string
          consumed_at?: string | null
          created_at?: string
          device_label?: string | null
          expires_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_kind: Database["public"]["Enums"]["item_kind"]
          logo_url: string | null
          playlist_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_kind: Database["public"]["Enums"]["item_kind"]
          logo_url?: string | null
          playlist_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_kind?: Database["public"]["Enums"]["item_kind"]
          logo_url?: string | null
          playlist_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          epg_url: string | null
          id: string
          kind: Database["public"]["Enums"]["playlist_kind"]
          m3u_url: string | null
          name: string
          password: string | null
          server_url: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          epg_url?: string | null
          id?: string
          kind: Database["public"]["Enums"]["playlist_kind"]
          m3u_url?: string | null
          name: string
          password?: string | null
          server_url?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          epg_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["playlist_kind"]
          m3u_url?: string | null
          name?: string
          password?: string | null
          server_url?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      stream_logs: {
        Row: {
          code: string
          created_at: string
          device: string | null
          entries: Json
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          device?: string | null
          entries?: Json
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          device?: string | null
          entries?: Json
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      streaming_top10: {
        Row: {
          fetched_at: string
          id: string
          kind: string
          poster_url: string | null
          rank: number
          service: string
          title: string
          year: number | null
        }
        Insert: {
          fetched_at?: string
          id?: string
          kind: string
          poster_url?: string | null
          rank: number
          service: string
          title: string
          year?: number | null
        }
        Update: {
          fetched_at?: string
          id?: string
          kind?: string
          poster_url?: string | null
          rank?: number
          service?: string
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      title_metadata: {
        Row: {
          backdrop_url: string | null
          cast_checked: boolean
          cast_names: string[]
          confidence: number | null
          created_at: string
          genres: string[]
          id: string
          item_kind: string
          lookup_key: string
          overview: string | null
          poster_url: string | null
          resolved_title: string | null
          source: string
          updated_at: string
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          cast_checked?: boolean
          cast_names?: string[]
          confidence?: number | null
          created_at?: string
          genres?: string[]
          id?: string
          item_kind: string
          lookup_key: string
          overview?: string | null
          poster_url?: string | null
          resolved_title?: string | null
          source?: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          cast_checked?: boolean
          cast_names?: string[]
          confidence?: number | null
          created_at?: string
          genres?: string[]
          id?: string
          item_kind?: string
          lookup_key?: string
          overview?: string | null
          poster_url?: string | null
          resolved_title?: string | null
          source?: string
          updated_at?: string
          year?: number | null
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
          role: Database["public"]["Enums"]["app_role"]
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
      user_settings: {
        Row: {
          sync_playlists: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          sync_playlists?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          sync_playlists?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_progress: {
        Row: {
          completed: boolean
          duration_seconds: number | null
          episode: number | null
          external: boolean
          id: string
          item_id: string
          item_kind: Database["public"]["Enums"]["item_kind"]
          playlist_id: string
          position_seconds: number
          poster_url: string | null
          season: number | null
          series_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          duration_seconds?: number | null
          episode?: number | null
          external?: boolean
          id?: string
          item_id: string
          item_kind: Database["public"]["Enums"]["item_kind"]
          playlist_id: string
          position_seconds?: number
          poster_url?: string | null
          season?: number | null
          series_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          duration_seconds?: number | null
          episode?: number | null
          external?: boolean
          id?: string
          item_id?: string
          item_kind?: Database["public"]["Enums"]["item_kind"]
          playlist_id?: string
          position_seconds?: number
          poster_url?: string | null
          season?: number | null
          series_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_progress_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
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
      popular_titles: {
        Args: {
          _days?: number
          _kind: Database["public"]["Enums"]["item_kind"]
          _lim?: number
        }
        Returns: {
          poster_url: string
          title: string
          viewers: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      item_kind: "live" | "movie" | "series" | "episode"
      playlist_kind: "xtream" | "m3u"
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
      app_role: ["admin", "moderator", "user"],
      item_kind: ["live", "movie", "series", "episode"],
      playlist_kind: ["xtream", "m3u"],
    },
  },
} as const
