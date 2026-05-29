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
      match_results_history: {
        Row: {
          away_score: number
          home_score: number
          match_id: number
          match_results_history_id: number
          recorded_at: string
          recorded_by: string | null
          source: string
        }
        Insert: {
          away_score: number
          home_score: number
          match_id: number
          match_results_history_id?: number
          recorded_at?: string
          recorded_by?: string | null
          source: string
        }
        Update: {
          away_score?: number
          home_score?: number
          match_id?: number
          match_results_history_id?: number
          recorded_at?: string
          recorded_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
      matches: {
        Row: {
          api_fixture_id: number | null
          away_flag: string | null
          away_score: number | null
          away_team: string | null
          away_team_id: number | null
          group: string | null
          group_turn: number | null
          home_flag: string | null
          home_score: number | null
          home_team: string | null
          home_team_id: number | null
          is_finished: boolean | null
          kickoff_utc: string | null
          location: string | null
          match_id: number
          round: string | null
          status: string | null
        }
        Insert: {
          api_fixture_id?: number | null
          away_flag?: string | null
          away_score?: number | null
          away_team?: string | null
          away_team_id?: number | null
          group?: string | null
          group_turn?: number | null
          home_flag?: string | null
          home_score?: number | null
          home_team?: string | null
          home_team_id?: number | null
          is_finished?: boolean | null
          kickoff_utc?: string | null
          location?: string | null
          match_id: number
          round?: string | null
          status?: string | null
        }
        Update: {
          api_fixture_id?: number | null
          away_flag?: string | null
          away_score?: number | null
          away_team?: string | null
          away_team_id?: number | null
          group?: string | null
          group_turn?: number | null
          home_flag?: string | null
          home_score?: number | null
          home_team?: string | null
          home_team_id?: number | null
          is_finished?: boolean | null
          kickoff_utc?: string | null
          location?: string | null
          match_id?: number
          round?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_matches_away_team"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "fk_matches_home_team"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      player_stats: {
        Row: {
          api_player_id: number | null
          goals: number
          player_id: number
          player_name: string
          team_id: number | null
          updated_at: string
        }
        Insert: {
          api_player_id?: number | null
          goals?: number
          player_id?: number
          player_name: string
          team_id?: number | null
          updated_at?: string
        }
        Update: {
          api_player_id?: number | null
          goals?: number
          player_id?: number
          player_name?: string
          team_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_player_stats_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      pools: {
        Row: {
          created_at: string
          invite_code: string | null
          pool_id: number
          pool_name: string
        }
        Insert: {
          created_at?: string
          invite_code?: string | null
          pool_id?: number
          pool_name: string
        }
        Update: {
          created_at?: string
          invite_code?: string | null
          pool_id?: number
          pool_name?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          created_at: string
          late_penalty_applied: boolean
          match_id: number
          predicted_away_score: number
          predicted_home_score: number
          prediction_id: number
          updated_at: string
          user_id: number
          version: number
        }
        Insert: {
          created_at?: string
          late_penalty_applied?: boolean
          match_id: number
          predicted_away_score?: number
          predicted_home_score?: number
          prediction_id?: number
          updated_at?: string
          user_id: number
          version?: number
        }
        Update: {
          created_at?: string
          late_penalty_applied?: boolean
          match_id?: number
          predicted_away_score?: number
          predicted_home_score?: number
          prediction_id?: number
          updated_at?: string
          user_id?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_predictions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
      standings: {
        Row: {
          draws: number
          goal_difference: number
          group: string | null
          losses: number
          played: number
          points: number
          standing_id: number
          team_id: number
          updated_at: string
          wins: number
        }
        Insert: {
          draws?: number
          goal_difference?: number
          group?: string | null
          losses?: number
          played?: number
          points?: number
          standing_id?: number
          team_id: number
          updated_at?: string
          wins?: number
        }
        Update: {
          draws?: number
          goal_difference?: number
          group?: string | null
          losses?: number
          played?: number
          points?: number
          standing_id?: number
          team_id?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_standings_team"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      teams: {
        Row: {
          abbreviation: string | null
          group: string | null
          team_flag: string | null
          team_id: number
          team_name: string | null
        }
        Insert: {
          abbreviation?: string | null
          group?: string | null
          team_flag?: string | null
          team_id: number
          team_name?: string | null
        }
        Update: {
          abbreviation?: string | null
          group?: string | null
          team_flag?: string | null
          team_id?: number
          team_name?: string | null
        }
        Relationships: []
      }
      user_points_events: {
        Row: {
          created_at: string
          event_type: string
          match_id: number | null
          points_delta: number
          reason: string | null
          user_id: number
          user_points_event_id: number
        }
        Insert: {
          created_at?: string
          event_type: string
          match_id?: number | null
          points_delta: number
          reason?: string | null
          user_id: number
          user_points_event_id?: number
        }
        Update: {
          created_at?: string
          event_type?: string
          match_id?: number | null
          points_delta?: number
          reason?: string | null
          user_id?: number
          user_points_event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_points_events_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_points_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
      user_pools: {
        Row: {
          is_admin: boolean | null
          joined_at: string
          pool_id: number
          role: string
          user_id: number
          user_pool_id: number
        }
        Insert: {
          is_admin?: boolean | null
          joined_at?: string
          pool_id: number
          role?: string
          user_id: number
          user_pool_id?: number
        }
        Update: {
          is_admin?: boolean | null
          joined_at?: string
          pool_id?: number
          role?: string
          user_id?: number
          user_pool_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_pools_pool"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["pool_id"]
          },
          {
            foreignKeyName: "fk_user_pools_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          exact_hits: number
          hits_total: number | null
          late_scorer_penalty: boolean
          late_winner_penalty: boolean
          misses_total: number | null
          pin: string | null
          points_total: number
          predicted_top_scorer_id: number | null
          predicted_tournament_winner_id: number | null
          user_id: number
          username: string
        }
        Insert: {
          created_at?: string
          exact_hits?: number
          hits_total?: number | null
          late_scorer_penalty?: boolean
          late_winner_penalty?: boolean
          misses_total?: number | null
          pin?: string | null
          points_total?: number
          predicted_top_scorer_id?: number | null
          predicted_tournament_winner_id?: number | null
          user_id?: number
          username: string
        }
        Update: {
          created_at?: string
          exact_hits?: number
          hits_total?: number | null
          late_scorer_penalty?: boolean
          late_winner_penalty?: boolean
          misses_total?: number | null
          pin?: string | null
          points_total?: number
          predicted_top_scorer_id?: number | null
          predicted_tournament_winner_id?: number | null
          user_id?: number
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_predicted_top_scorer"
            columns: ["predicted_top_scorer_id"]
            isOneToOne: false
            referencedRelation: "player_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_users_predicted_winner_team"
            columns: ["predicted_tournament_winner_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
    }
    Views: {
      pool_predictions_view: {
        Row: {
          display_away_score: string | null
          display_home_score: string | null
          exact_hits: number | null
          is_finished: boolean | null
          match_id: number | null
          points_delta: number | null
          points_total: number | null
          pool_id: number | null
          predictor_name: string | null
          user_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_predictions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_user_pools_pool"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["pool_id"]
          },
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
      secure_predictions_view: {
        Row: {
          display_away_score: string | null
          display_home_score: string | null
          event_type: string | null
          is_finished: boolean | null
          kickoff_utc: string | null
          match_id: number | null
          points_delta: number | null
          prediction_id: number | null
          user_id: number | null
          username: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_predictions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["match_id"]
          },
        ]
      }
    }
    Functions: {
      _drop_fks_and_create: {
        Args: {
          child_col: string
          child_table: string
          constraint_name: string
          on_delete?: string
          parent_col: string
          parent_table: string
        }
        Returns: undefined
      }
      custom_login: {
        Args: { p_pin: string; p_username: string }
        Returns: {
          user_id: number
          username: string
        }[]
      }
      custom_signup: {
        Args: { p_pin: string; p_username: string }
        Returns: {
          user_id: number
          username: string
        }[]
      }
      create_pool_and_join: {
        Args: { p_pool_name: string; p_user_id: number }
        Returns: {
          pool_id: number
          pool_name: string
        }[]
      }
      join_pool_by_name: {
        Args: { p_pool_name: string; p_user_id: number }
        Returns: {
          pool_id: number
          pool_name: string
        }[]
      }
      leave_pool: {
        Args: { p_pool_id: number; p_user_id: number }
        Returns: undefined
      }
      set_current_user_id: { Args: { uid: number }; Returns: undefined }
      get_bonus_pick_cutoff: { Args: never; Returns: string }
      get_pool_leaderboard: {
        Args: { p_pool_id: number }
        Returns: {
          exact_hits: number
          hits_total: number
          misses_total: number
          points_total: number
          predicted_top_scorer_id: number
          predicted_tournament_winner_id: number
          rank: number
          user_id: number
          username: string
        }[]
      }
      process_match_conclusion:
        | { Args: { p_match_id: number }; Returns: undefined }
        | {
            Args: {
              p_away_score: number
              p_home_score: number
              p_match_id: number
              p_scorer_ids: number[]
            }
            Returns: undefined
          }
      process_match_scoring: {
        Args: { p_match_id: number }
        Returns: undefined
      }
      record_tournament_bonus_hit: {
        Args: {
          p_event_type: string
          p_points_delta: number
          p_reason: string
          p_user_id: number
        }
        Returns: undefined
      }
      record_tournament_top_scorer_hit: {
        Args: { p_user_id: number }
        Returns: undefined
      }
      record_tournament_winner_hit: {
        Args: { p_user_id: number }
        Returns: undefined
      }
      save_bonus_pick: {
        Args: {
          p_pick_type: string
          p_player_id?: number
          p_team_id?: number
          p_user_id: number
        }
        Returns: undefined
      }
      save_prediction: {
        Args: {
          p_away_score?: number
          p_home_score?: number
          p_match_id: number
          p_user_id: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
