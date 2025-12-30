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
      achievements: {
        Row: {
          achievement_type: string
          created_at: string | null
          description: string
          earned_at: string
          icon: string
          id: string
          metadata: Json | null
          tier: string
          title: string
          user_id: string
        }
        Insert: {
          achievement_type: string
          created_at?: string | null
          description: string
          earned_at?: string
          icon: string
          id?: string
          metadata?: Json | null
          tier?: string
          title: string
          user_id: string
        }
        Update: {
          achievement_type?: string
          created_at?: string | null
          description?: string
          earned_at?: string
          icon?: string
          id?: string
          metadata?: Json | null
          tier?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_feed: {
        Row: {
          activity_data: Json
          activity_type: string
          created_at: string
          id: string
          is_read: boolean | null
          mentor_comment: string | null
          mentor_voice_url: string | null
          user_id: string
        }
        Insert: {
          activity_data?: Json
          activity_type: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          mentor_comment?: string | null
          mentor_voice_url?: string | null
          user_id: string
        }
        Update: {
          activity_data?: Json
          activity_type?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          mentor_comment?: string | null
          mentor_voice_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      adaptive_push_queue: {
        Row: {
          category: string | null
          created_at: string | null
          delivered: boolean | null
          id: string
          mentor_id: string | null
          message: string | null
          scheduled_for: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          delivered?: boolean | null
          id?: string
          mentor_id?: string | null
          message?: string | null
          scheduled_for?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          delivered?: boolean | null
          id?: string
          mentor_id?: string | null
          message?: string | null
          scheduled_for?: string | null
          user_id?: string
        }
        Relationships: []
      }
      adaptive_push_settings: {
        Row: {
          categories: string[] | null
          created_at: string | null
          emotional_triggers: string[] | null
          enabled: boolean | null
          frequency: string | null
          id: string
          intensity: string | null
          last_category_index: number | null
          mentor_id: string | null
          primary_category: string | null
          time_window: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categories?: string[] | null
          created_at?: string | null
          emotional_triggers?: string[] | null
          enabled?: boolean | null
          frequency?: string | null
          id?: string
          intensity?: string | null
          last_category_index?: number | null
          mentor_id?: string | null
          primary_category?: string | null
          time_window?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categories?: string[] | null
          created_at?: string | null
          emotional_triggers?: string[] | null
          enabled?: boolean | null
          frequency?: string | null
          id?: string
          intensity?: string | null
          last_category_index?: number | null
          mentor_id?: string | null
          primary_category?: string | null
          time_window?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_push_settings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      adversary_essences: {
        Row: {
          absorbed_at: string
          adversary_name: string
          adversary_theme: string
          companion_id: string
          created_at: string
          encounter_id: string
          essence_description: string | null
          essence_name: string
          id: string
          rarity: string
          stat_boost: number
          stat_type: string
          user_id: string
        }
        Insert: {
          absorbed_at?: string
          adversary_name: string
          adversary_theme: string
          companion_id: string
          created_at?: string
          encounter_id: string
          essence_description?: string | null
          essence_name: string
          id?: string
          rarity?: string
          stat_boost?: number
          stat_type: string
          user_id: string
        }
        Update: {
          absorbed_at?: string
          adversary_name?: string
          adversary_theme?: string
          companion_id?: string
          created_at?: string
          encounter_id?: string
          essence_description?: string | null
          essence_name?: string
          id?: string
          rarity?: string
          stat_boost?: number
          stat_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adversary_essences_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "user_companion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adversary_essences_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "astral_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adversary_essences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adversary_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          theme: string
          tier: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          theme: string
          tier: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          theme?: string
          tier?: string
        }
        Relationships: []
      }
      ai_interactions: {
        Row: {
          ai_response: Json | null
          context_snapshot: Json | null
          created_at: string
          detected_intent: string | null
          id: string
          input_text: string | null
          interaction_type: string
          modifications: Json | null
          response_time_ms: number | null
          session_id: string | null
          user_action: string | null
          user_id: string
        }
        Insert: {
          ai_response?: Json | null
          context_snapshot?: Json | null
          created_at?: string
          detected_intent?: string | null
          id?: string
          input_text?: string | null
          interaction_type: string
          modifications?: Json | null
          response_time_ms?: number | null
          session_id?: string | null
          user_action?: string | null
          user_id: string
        }
        Update: {
          ai_response?: Json | null
          context_snapshot?: Json | null
          created_at?: string
          detected_intent?: string | null
          id?: string
          input_text?: string | null
          interaction_type?: string
          modifications?: Json | null
          response_time_ms?: number | null
          session_id?: string | null
          user_action?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_output_validation_log: {
        Row: {
          created_at: string | null
          id: string
          input_data: Json
          model_used: string
          output_data: Json
          response_time_ms: number | null
          template_key: string
          tokens_used: number | null
          user_id: string | null
          validation_errors: Json | null
          validation_passed: boolean
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_data: Json
          model_used: string
          output_data: Json
          response_time_ms?: number | null
          template_key: string
          tokens_used?: number | null
          user_id?: string | null
          validation_errors?: Json | null
          validation_passed: boolean
        }
        Update: {
          created_at?: string | null
          id?: string
          input_data?: Json
          model_used?: string
          output_data?: Json
          response_time_ms?: number | null
          template_key?: string
          tokens_used?: number | null
          user_id?: string | null
          validation_errors?: Json | null
          validation_passed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_output_validation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      astral_encounters: {
        Row: {
          accuracy_score: number | null
          adversary_lore: string | null
          adversary_name: string
          adversary_theme: string
          adversary_tier: string
          companion_id: string
          completed_at: string | null
          created_at: string
          essence_earned: string | null
          id: string
          mini_game_type: string
          phases_completed: number | null
          result: string | null
          retry_available_at: string | null
          started_at: string
          stat_boost_amount: number | null
          stat_boost_type: string | null
          total_phases: number | null
          trigger_source_id: string | null
          trigger_type: string
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          accuracy_score?: number | null
          adversary_lore?: string | null
          adversary_name: string
          adversary_theme: string
          adversary_tier?: string
          companion_id: string
          completed_at?: string | null
          created_at?: string
          essence_earned?: string | null
          id?: string
          mini_game_type: string
          phases_completed?: number | null
          result?: string | null
          retry_available_at?: string | null
          started_at?: string
          stat_boost_amount?: number | null
          stat_boost_type?: string | null
          total_phases?: number | null
          trigger_source_id?: string | null
          trigger_type: string
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          accuracy_score?: number | null
          adversary_lore?: string | null
          adversary_name?: string
          adversary_theme?: string
          adversary_tier?: string
          companion_id?: string
          completed_at?: string | null
          created_at?: string
          essence_earned?: string | null
          id?: string
          mini_game_type?: string
          phases_completed?: number | null
          result?: string | null
          retry_available_at?: string | null
          started_at?: string
          stat_boost_amount?: number | null
          stat_boost_type?: string | null
          total_phases?: number | null
          trigger_source_id?: string | null
          trigger_type?: string
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "astral_encounters_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "user_companion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "astral_encounters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_clips: {
        Row: {
          audio_url: string
          category: string
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_premium: boolean | null
          mentor_id: string | null
          title: string
        }
        Insert: {
          audio_url: string
          category: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_premium?: boolean | null
          mentor_id?: string | null
          title: string
        }
        Update: {
          audio_url?: string
          category?: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_premium?: boolean | null
          mentor_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_clips_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_history: {
        Row: {
          battle_log: Json | null
          cards_used: string[]
          completed_at: string | null
          damage_dealt: number | null
          damage_received: number | null
          id: string
          opponent_id: string | null
          opponent_type: string
          result: string
          rewards_claimed: Json | null
          started_at: string
          turns_taken: number | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          battle_log?: Json | null
          cards_used: string[]
          completed_at?: string | null
          damage_dealt?: number | null
          damage_received?: number | null
          id?: string
          opponent_id?: string | null
          opponent_type: string
          result: string
          rewards_claimed?: Json | null
          started_at?: string
          turns_taken?: number | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          battle_log?: Json | null
          cards_used?: string[]
          completed_at?: string | null
          damage_dealt?: number | null
          damage_received?: number | null
          id?: string
          opponent_id?: string | null
          opponent_type?: string
          result?: string
          rewards_claimed?: Json | null
          started_at?: string
          turns_taken?: number | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_matches: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_round: number | null
          id: string
          max_rounds: number | null
          started_at: string | null
          status: string
          winner_user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_round?: number | null
          id?: string
          max_rounds?: number | null
          started_at?: string | null
          status?: string
          winner_user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_round?: number | null
          id?: string
          max_rounds?: number | null
          started_at?: string | null
          status?: string
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_matches_winner_user_id_fkey"
            columns: ["winner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_participants: {
        Row: {
          cards_used: string[]
          created_at: string | null
          eliminated_at: string | null
          energy: number | null
          id: string
          match_id: string
          placement: number | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          cards_used: string[]
          created_at?: string | null
          eliminated_at?: string | null
          energy?: number | null
          id?: string
          match_id: string
          placement?: number | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          cards_used?: string[]
          created_at?: string | null
          eliminated_at?: string | null
          energy?: number | null
          id?: string
          match_id?: string
          placement?: number | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "battle_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_rankings: {
        Row: {
          id: string
          rank_points: number | null
          second_place: number | null
          third_place: number | null
          total_matches: number | null
          total_xp_earned: number | null
          updated_at: string | null
          user_id: string
          wins: number | null
        }
        Insert: {
          id?: string
          rank_points?: number | null
          second_place?: number | null
          third_place?: number | null
          total_matches?: number | null
          total_xp_earned?: number | null
          updated_at?: string | null
          user_id: string
          wins?: number | null
        }
        Update: {
          id?: string
          rank_points?: number | null
          second_place?: number | null
          third_place?: number | null
          total_matches?: number | null
          total_xp_earned?: number | null
          updated_at?: string | null
          user_id?: string
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_rankings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_rounds: {
        Row: {
          created_at: string | null
          id: string
          match_id: string
          player_actions: Json
          round_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id: string
          player_actions: Json
          round_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string
          player_actions?: Json
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "battle_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      card_move_assignments: {
        Row: {
          card_id: string
          id: string
          move_id: string
          slot_number: number
          unlocked_at: string
        }
        Insert: {
          card_id: string
          id?: string
          move_id: string
          slot_number?: number
          unlocked_at?: string
        }
        Update: {
          card_id?: string
          id?: string
          move_id?: string
          slot_number?: number
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_move_assignments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "companion_evolution_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_move_assignments_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "card_moves"
            referencedColumns: ["id"]
          },
        ]
      }
      card_moves: {
        Row: {
          accuracy: number
          base_power: number
          cooldown_turns: number | null
          created_at: string
          description: string | null
          element: string
          energy_cost: number
          id: string
          move_type: string
          name: string
          status_chance: number | null
          status_effect: string | null
        }
        Insert: {
          accuracy?: number
          base_power?: number
          cooldown_turns?: number | null
          created_at?: string
          description?: string | null
          element: string
          energy_cost?: number
          id?: string
          move_type?: string
          name: string
          status_chance?: number | null
          status_effect?: string | null
        }
        Update: {
          accuracy?: number
          base_power?: number
          cooldown_turns?: number | null
          created_at?: string
          description?: string | null
          element?: string
          energy_cost?: number
          id?: string
          move_type?: string
          name?: string
          status_chance?: number | null
          status_effect?: string | null
        }
        Relationships: []
      }
      challenge_progress: {
        Row: {
          completed: boolean | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          user_challenge_id: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          user_challenge_id?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          user_challenge_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_user_challenge_id_fkey"
            columns: ["user_challenge_id"]
            isOneToOne: false
            referencedRelation: "user_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_tasks: {
        Row: {
          challenge_id: string
          created_at: string | null
          day_number: number
          id: string
          task_description: string
          task_title: string
        }
        Insert: {
          challenge_id: string
          created_at?: string | null
          day_number: number
          id?: string
          task_description: string
          task_title: string
        }
        Update: {
          challenge_id?: string
          created_at?: string | null
          day_number?: number
          id?: string
          task_description?: string
          task_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_tasks_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          duration_days: number
          id: string
          source: string | null
          title: string
          total_days: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          duration_days: number
          id?: string
          source?: string | null
          title: string
          total_days: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          duration_days?: number
          id?: string
          source?: string | null
          title?: string
          total_days?: number
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          created_at: string | null
          date: string
          focus_goal: string | null
          id: string
          mood: number | null
          reflection: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          focus_goal?: string | null
          id?: string
          mood?: number | null
          reflection?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          focus_goal?: string | null
          id?: string
          mood?: number | null
          reflection?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          avatar_url: string | null
          banner_style: string | null
          created_at: string | null
          description: string | null
          emblem_icon: string | null
          frame_style: string | null
          glow_effect: string | null
          id: string
          invite_code: string
          is_public: boolean | null
          name: string
          owner_id: string
          particle_effect: string | null
          theme_color: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_style?: string | null
          created_at?: string | null
          description?: string | null
          emblem_icon?: string | null
          frame_style?: string | null
          glow_effect?: string | null
          id?: string
          invite_code?: string
          is_public?: boolean | null
          name: string
          owner_id: string
          particle_effect?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_style?: string | null
          created_at?: string | null
          description?: string | null
          emblem_icon?: string | null
          frame_style?: string | null
          glow_effect?: string | null
          id?: string
          invite_code?: string
          is_public?: boolean | null
          name?: string
          owner_id?: string
          particle_effect?: string | null
          theme_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string | null
          last_activity_at: string | null
          role: string | null
          total_contribution: number | null
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string | null
          last_activity_at?: string | null
          role?: string | null
          total_contribution?: number | null
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string | null
          last_activity_at?: string | null
          role?: string | null
          total_contribution?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_evolution_cards: {
        Row: {
          bond_level: number | null
          card_id: string
          companion_id: string
          created_at: string | null
          creature_name: string
          element: string
          energy_cost: number
          evolution_id: string
          evolution_stage: number
          frame_type: string
          generated_at: string | null
          id: string
          image_url: string | null
          lore_seed: string
          rarity: string
          species: string
          stats: Json
          story_text: string
          traits: string[] | null
          user_id: string
        }
        Insert: {
          bond_level?: number | null
          card_id: string
          companion_id: string
          created_at?: string | null
          creature_name: string
          element: string
          energy_cost?: number
          evolution_id: string
          evolution_stage: number
          frame_type: string
          generated_at?: string | null
          id?: string
          image_url?: string | null
          lore_seed: string
          rarity: string
          species: string
          stats?: Json
          story_text: string
          traits?: string[] | null
          user_id: string
        }
        Update: {
          bond_level?: number | null
          card_id?: string
          companion_id?: string
          created_at?: string | null
          creature_name?: string
          element?: string
          energy_cost?: number
          evolution_id?: string
          evolution_stage?: number
          frame_type?: string
          generated_at?: string | null
          id?: string
          image_url?: string | null
          lore_seed?: string
          rarity?: string
          species?: string
          stats?: Json
          story_text?: string
          traits?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_evolution_cards_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "user_companion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companion_evolution_cards_evolution_id_fkey"
            columns: ["evolution_id"]
            isOneToOne: false
            referencedRelation: "companion_evolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companion_evolution_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_evolutions: {
        Row: {
          companion_id: string
          evolved_at: string
          id: string
          image_url: string
          stage: number
          xp_at_evolution: number
        }
        Insert: {
          companion_id: string
          evolved_at?: string
          id?: string
          image_url: string
          stage: number
          xp_at_evolution: number
        }
        Update: {
          companion_id?: string
          evolved_at?: string
          id?: string
          image_url?: string
          stage?: number
          xp_at_evolution?: number
        }
        Relationships: [
          {
            foreignKeyName: "companion_evolutions_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "user_companion"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_postcards: {
        Row: {
          caption: string | null
          chapter_number: number | null
          chapter_title: string | null
          characters_featured: string[] | null
          clue_text: string | null
          companion_id: string
          created_at: string
          epic_id: string | null
          generated_at: string
          id: string
          image_url: string
          is_finale: boolean | null
          location_description: string
          location_name: string
          location_revealed: boolean | null
          milestone_percent: number
          prophecy_line: string | null
          seeds_planted: string[] | null
          story_content: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          chapter_number?: number | null
          chapter_title?: string | null
          characters_featured?: string[] | null
          clue_text?: string | null
          companion_id: string
          created_at?: string
          epic_id?: string | null
          generated_at?: string
          id?: string
          image_url: string
          is_finale?: boolean | null
          location_description: string
          location_name: string
          location_revealed?: boolean | null
          milestone_percent: number
          prophecy_line?: string | null
          seeds_planted?: string[] | null
          story_content?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          chapter_number?: number | null
          chapter_title?: string | null
          characters_featured?: string[] | null
          clue_text?: string | null
          companion_id?: string
          created_at?: string
          epic_id?: string | null
          generated_at?: string
          id?: string
          image_url?: string
          is_finale?: boolean | null
          location_description?: string
          location_name?: string
          location_revealed?: boolean | null
          milestone_percent?: number
          prophecy_line?: string | null
          seeds_planted?: string[] | null
          story_content?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_postcards_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "user_companion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companion_postcards_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_skins: {
        Row: {
          created_at: string | null
          css_effect: Json
          description: string | null
          id: string
          image_url: string | null
          name: string
          rarity: string | null
          skin_type: string
          unlock_requirement: number | null
          unlock_type: string
        }
        Insert: {
          created_at?: string | null
          css_effect: Json
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          rarity?: string | null
          skin_type: string
          unlock_requirement?: number | null
          unlock_type: string
        }
        Update: {
          created_at?: string | null
          css_effect?: Json
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          rarity?: string | null
          skin_type?: string
          unlock_requirement?: number | null
          unlock_type?: string
        }
        Relationships: []
      }
      companion_stories: {
        Row: {
          bond_moment: string
          chapter_title: string
          companion_id: string
          generated_at: string
          id: string
          intro_line: string
          life_lesson: string
          lore_expansion: Json
          main_story: string
          next_hook: string
          stage: number
          tone_preference: string
          user_id: string
        }
        Insert: {
          bond_moment: string
          chapter_title: string
          companion_id: string
          generated_at?: string
          id?: string
          intro_line: string
          life_lesson: string
          lore_expansion?: Json
          main_story: string
          next_hook: string
          stage: number
          tone_preference?: string
          user_id: string
        }
        Update: {
          bond_moment?: string
          chapter_title?: string
          companion_id?: string
          generated_at?: string
          id?: string
          intro_line?: string
          life_lesson?: string
          lore_expansion?: Json
          main_story?: string
          next_hook?: string
          stage?: number
          tone_preference?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_stories_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "user_companion"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_voice_templates: {
        Row: {
          concern_templates: string[] | null
          created_at: string | null
          encouragement_templates: string[] | null
          greeting_templates: string[] | null
          id: string
          personality_traits: string[]
          species: string
          voice_style: string
        }
        Insert: {
          concern_templates?: string[] | null
          created_at?: string | null
          encouragement_templates?: string[] | null
          greeting_templates?: string[] | null
          id?: string
          personality_traits?: string[]
          species: string
          voice_style: string
        }
        Update: {
          concern_templates?: string[] | null
          created_at?: string | null
          encouragement_templates?: string[] | null
          greeting_templates?: string[] | null
          id?: string
          personality_traits?: string[]
          species?: string
          voice_style?: string
        }
        Relationships: []
      }
      completed_books: {
        Row: {
          book_title: string
          boss_defeated_at: string | null
          boss_defeated_name: string | null
          companion_name: string | null
          companion_species: string | null
          completed_at: string | null
          created_at: string | null
          epic_id: string
          final_wisdom: string | null
          id: string
          mentor_name: string | null
          story_type_slug: string | null
          total_chapters: number
          user_id: string
        }
        Insert: {
          book_title: string
          boss_defeated_at?: string | null
          boss_defeated_name?: string | null
          companion_name?: string | null
          companion_species?: string | null
          completed_at?: string | null
          created_at?: string | null
          epic_id: string
          final_wisdom?: string | null
          id?: string
          mentor_name?: string | null
          story_type_slug?: string | null
          total_chapters: number
          user_id: string
        }
        Update: {
          book_title?: string
          boss_defeated_at?: string | null
          boss_defeated_name?: string | null
          companion_name?: string | null
          companion_species?: string | null
          completed_at?: string | null
          created_at?: string | null
          epic_id?: string
          final_wisdom?: string | null
          id?: string
          mentor_name?: string | null
          story_type_slug?: string | null
          total_chapters?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_books_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: true
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_books_story_type_slug_fkey"
            columns: ["story_type_slug"]
            isOneToOne: false
            referencedRelation: "epic_story_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      cosmic_codex_entries: {
        Row: {
          adversary_lore: string | null
          adversary_name: string
          adversary_theme: string
          created_at: string
          first_defeated_at: string
          id: string
          last_defeated_at: string
          times_defeated: number
          user_id: string
        }
        Insert: {
          adversary_lore?: string | null
          adversary_name: string
          adversary_theme: string
          created_at?: string
          first_defeated_at?: string
          id?: string
          last_defeated_at?: string
          times_defeated?: number
          user_id: string
        }
        Update: {
          adversary_lore?: string | null
          adversary_name?: string
          adversary_theme?: string
          created_at?: string
          first_defeated_at?: string
          id?: string
          last_defeated_at?: string
          times_defeated?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cosmic_codex_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmic_deep_dive_feedback: {
        Row: {
          created_at: string
          id: string
          placement: string
          resonates: boolean
          sign: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          placement: string
          resonates: boolean
          sign: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          placement?: string
          resonates?: boolean
          sign?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_check_ins: {
        Row: {
          check_in_date: string
          check_in_type: string
          completed_at: string | null
          created_at: string
          id: string
          intention: string | null
          mentor_response: string | null
          mood: string | null
          reflection: string | null
          user_id: string
        }
        Insert: {
          check_in_date?: string
          check_in_type: string
          completed_at?: string | null
          created_at?: string
          id?: string
          intention?: string | null
          mentor_response?: string | null
          mood?: string | null
          reflection?: string | null
          user_id: string
        }
        Update: {
          check_in_date?: string
          check_in_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          intention?: string | null
          mentor_response?: string | null
          mood?: string | null
          reflection?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_messages: {
        Row: {
          audio_url: string | null
          category: string | null
          created_at: string | null
          date: string
          id: string
          mentor_id: string | null
          message_text: string
        }
        Insert: {
          audio_url?: string | null
          category?: string | null
          created_at?: string | null
          date?: string
          id?: string
          mentor_id?: string | null
          message_text: string
        }
        Update: {
          audio_url?: string | null
          category?: string | null
          created_at?: string | null
          date?: string
          id?: string
          mentor_id?: string | null
          message_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_messages_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_missions: {
        Row: {
          auto_complete: boolean | null
          category: string | null
          chain_parent_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          difficulty: string | null
          id: string
          is_bonus: boolean | null
          mission_date: string
          mission_text: string
          mission_type: string
          progress_current: number | null
          progress_target: number | null
          user_id: string
          xp_reward: number
        }
        Insert: {
          auto_complete?: boolean | null
          category?: string | null
          chain_parent_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_bonus?: boolean | null
          mission_date?: string
          mission_text: string
          mission_type: string
          progress_current?: number | null
          progress_target?: number | null
          user_id: string
          xp_reward?: number
        }
        Update: {
          auto_complete?: boolean | null
          category?: string | null
          chain_parent_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_bonus?: boolean | null
          mission_date?: string
          mission_text?: string
          mission_type?: string
          progress_current?: number | null
          progress_target?: number | null
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_missions_chain_parent_id_fkey"
            columns: ["chain_parent_id"]
            isOneToOne: false
            referencedRelation: "daily_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_pep_talks: {
        Row: {
          audio_url: string
          created_at: string
          emotional_triggers: string[]
          for_date: string
          id: string
          intensity: string
          mentor_slug: string
          script: string
          summary: string
          title: string
          topic_category: string
          transcript: Json | null
        }
        Insert: {
          audio_url: string
          created_at?: string
          emotional_triggers?: string[]
          for_date: string
          id?: string
          intensity: string
          mentor_slug: string
          script: string
          summary: string
          title: string
          topic_category: string
          transcript?: Json | null
        }
        Update: {
          audio_url?: string
          created_at?: string
          emotional_triggers?: string[]
          for_date?: string
          id?: string
          intensity?: string
          mentor_slug?: string
          script?: string
          summary?: string
          title?: string
          topic_category?: string
          transcript?: Json | null
        }
        Relationships: []
      }
      daily_quotes: {
        Row: {
          created_at: string
          for_date: string
          id: string
          mentor_slug: string
          quote_id: string
        }
        Insert: {
          created_at?: string
          for_date: string
          id?: string
          mentor_slug: string
          quote_id: string
        }
        Update: {
          created_at?: string
          for_date?: string
          id?: string
          mentor_slug?: string
          quote_id?: string
        }
        Relationships: []
      }
      daily_tasks: {
        Row: {
          actual_time_spent: number | null
          ai_generated: boolean | null
          category: string | null
          completed: boolean | null
          completed_at: string | null
          context_id: string | null
          created_at: string | null
          difficulty: string | null
          energy_level: string | null
          epic_id: string | null
          estimated_duration: number | null
          habit_source_id: string | null
          id: string
          is_bonus: boolean | null
          is_main_quest: boolean | null
          is_milestone: boolean | null
          is_recurring: boolean | null
          is_top_three: boolean | null
          parent_template_id: string | null
          priority: string | null
          recurrence_days: number[] | null
          recurrence_pattern: string | null
          reminder_enabled: boolean | null
          reminder_minutes_before: number | null
          reminder_sent: boolean | null
          scheduled_time: string | null
          source: string | null
          task_date: string
          task_text: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          actual_time_spent?: number | null
          ai_generated?: boolean | null
          category?: string | null
          completed?: boolean | null
          completed_at?: string | null
          context_id?: string | null
          created_at?: string | null
          difficulty?: string | null
          energy_level?: string | null
          epic_id?: string | null
          estimated_duration?: number | null
          habit_source_id?: string | null
          id?: string
          is_bonus?: boolean | null
          is_main_quest?: boolean | null
          is_milestone?: boolean | null
          is_recurring?: boolean | null
          is_top_three?: boolean | null
          parent_template_id?: string | null
          priority?: string | null
          recurrence_days?: number[] | null
          recurrence_pattern?: string | null
          reminder_enabled?: boolean | null
          reminder_minutes_before?: number | null
          reminder_sent?: boolean | null
          scheduled_time?: string | null
          source?: string | null
          task_date?: string
          task_text: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          actual_time_spent?: number | null
          ai_generated?: boolean | null
          category?: string | null
          completed?: boolean | null
          completed_at?: string | null
          context_id?: string | null
          created_at?: string | null
          difficulty?: string | null
          energy_level?: string | null
          epic_id?: string | null
          estimated_duration?: number | null
          habit_source_id?: string | null
          id?: string
          is_bonus?: boolean | null
          is_main_quest?: boolean | null
          is_milestone?: boolean | null
          is_recurring?: boolean | null
          is_top_three?: boolean | null
          parent_template_id?: string | null
          priority?: string | null
          recurrence_days?: number[] | null
          recurrence_pattern?: string | null
          reminder_enabled?: boolean | null
          reminder_minutes_before?: number | null
          reminder_sent?: boolean | null
          scheduled_time?: string | null
          source?: string | null
          task_date?: string
          task_text?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "task_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_habit_source_id_fkey"
            columns: ["habit_source_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      epic_activity_feed: {
        Row: {
          activity_data: Json | null
          activity_type: string
          created_at: string
          epic_id: string
          id: string
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          created_at?: string
          epic_id: string
          id?: string
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          created_at?: string
          epic_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epic_activity_feed_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      epic_discord_events: {
        Row: {
          epic_id: string
          event_data: Json
          event_type: string
          id: string
          posted_at: string
          webhook_response: string | null
        }
        Insert: {
          epic_id: string
          event_data?: Json
          event_type: string
          id?: string
          posted_at?: string
          webhook_response?: string | null
        }
        Update: {
          epic_id?: string
          event_data?: Json
          event_type?: string
          id?: string
          posted_at?: string
          webhook_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epic_discord_events_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      epic_habits: {
        Row: {
          created_at: string | null
          epic_id: string
          habit_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          epic_id: string
          habit_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          epic_id?: string
          habit_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epic_habits_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epic_habits_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      epic_members: {
        Row: {
          epic_id: string
          id: string
          joined_at: string
          last_activity_at: string | null
          total_contribution: number
          user_id: string
        }
        Insert: {
          epic_id: string
          id?: string
          joined_at?: string
          last_activity_at?: string | null
          total_contribution?: number
          user_id: string
        }
        Update: {
          epic_id?: string
          id?: string
          joined_at?: string
          last_activity_at?: string | null
          total_contribution?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epic_members_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epic_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      epic_milestones: {
        Row: {
          chapter_number: number | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          epic_id: string
          id: string
          is_postcard_milestone: boolean | null
          is_surfaced: boolean | null
          milestone_percent: number
          phase_name: string | null
          phase_order: number | null
          surfaced_at: string | null
          target_date: string | null
          task_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chapter_number?: number | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          epic_id: string
          id?: string
          is_postcard_milestone?: boolean | null
          is_surfaced?: boolean | null
          milestone_percent: number
          phase_name?: string | null
          phase_order?: number | null
          surfaced_at?: string | null
          target_date?: string | null
          task_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chapter_number?: number | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          epic_id?: string
          id?: string
          is_postcard_milestone?: boolean | null
          is_surfaced?: boolean | null
          milestone_percent?: number
          phase_name?: string | null
          phase_order?: number | null
          surfaced_at?: string | null
          target_date?: string | null
          task_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epic_milestones_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epic_milestones_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      epic_progress_log: {
        Row: {
          created_at: string | null
          date: string
          epic_id: string
          habits_completed: number | null
          habits_total: number | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          epic_id: string
          habits_completed?: number | null
          habits_total?: number | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          epic_id?: string
          habits_completed?: number | null
          habits_total?: number | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "epic_progress_log_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      epic_rewards: {
        Row: {
          adversary_theme: string | null
          created_at: string | null
          css_effect: Json | null
          description: string
          drop_weight: number | null
          id: string
          image_url: string | null
          name: string
          rarity: string
          reward_type: string
          story_type_slug: string | null
        }
        Insert: {
          adversary_theme?: string | null
          created_at?: string | null
          css_effect?: Json | null
          description: string
          drop_weight?: number | null
          id?: string
          image_url?: string | null
          name: string
          rarity: string
          reward_type: string
          story_type_slug?: string | null
        }
        Update: {
          adversary_theme?: string | null
          created_at?: string | null
          css_effect?: Json | null
          description?: string
          drop_weight?: number | null
          id?: string
          image_url?: string | null
          name?: string
          rarity?: string
          reward_type?: string
          story_type_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epic_rewards_story_type_slug_fkey"
            columns: ["story_type_slug"]
            isOneToOne: false
            referencedRelation: "epic_story_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      epic_story_types: {
        Row: {
          base_chapters: number
          boss_lore_template: string | null
          boss_name_template: string
          boss_theme: string
          created_at: string | null
          description: string
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          base_chapters?: number
          boss_lore_template?: string | null
          boss_name_template: string
          boss_theme: string
          created_at?: string | null
          description: string
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          base_chapters?: number
          boss_lore_template?: string | null
          boss_name_template?: string
          boss_theme?: string
          created_at?: string | null
          description?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      epic_templates: {
        Row: {
          badge_icon: string | null
          badge_name: string | null
          created_at: string | null
          description: string
          difficulty_tier: string
          habits: Json
          id: string
          is_featured: boolean | null
          name: string
          popularity_count: number | null
          target_days: number
          theme_color: string
        }
        Insert: {
          badge_icon?: string | null
          badge_name?: string | null
          created_at?: string | null
          description: string
          difficulty_tier?: string
          habits?: Json
          id?: string
          is_featured?: boolean | null
          name: string
          popularity_count?: number | null
          target_days?: number
          theme_color?: string
        }
        Update: {
          badge_icon?: string | null
          badge_name?: string | null
          created_at?: string | null
          description?: string
          difficulty_tier?: string
          habits?: Json
          id?: string
          is_featured?: boolean | null
          name?: string
          popularity_count?: number | null
          target_days?: number
          theme_color?: string
        }
        Relationships: []
      }
      epics: {
        Row: {
          book_title: string | null
          community_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          discord_channel_id: string | null
          discord_invite_url: string | null
          discord_ready: boolean | null
          end_date: string | null
          id: string
          invite_code: string | null
          is_public: boolean | null
          progress_percentage: number | null
          start_date: string
          status: string
          story_seed: Json | null
          story_type_slug: string | null
          target_days: number
          theme_color: string | null
          title: string
          total_chapters: number | null
          updated_at: string | null
          user_id: string
          xp_reward: number
        }
        Insert: {
          book_title?: string | null
          community_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          discord_channel_id?: string | null
          discord_invite_url?: string | null
          discord_ready?: boolean | null
          end_date?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean | null
          progress_percentage?: number | null
          start_date?: string
          status?: string
          story_seed?: Json | null
          story_type_slug?: string | null
          target_days?: number
          theme_color?: string | null
          title: string
          total_chapters?: number | null
          updated_at?: string | null
          user_id: string
          xp_reward?: number
        }
        Update: {
          book_title?: string | null
          community_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          discord_channel_id?: string | null
          discord_invite_url?: string | null
          discord_ready?: boolean | null
          end_date?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean | null
          progress_percentage?: number | null
          start_date?: string
          status?: string
          story_seed?: Json | null
          story_type_slug?: string | null
          target_days?: number
          theme_color?: string | null
          title?: string
          total_chapters?: number | null
          updated_at?: string | null
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "epics_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epics_story_type_slug_fkey"
            columns: ["story_type_slug"]
            isOneToOne: false
            referencedRelation: "epic_story_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      evening_reflections: {
        Row: {
          created_at: string
          gratitude: string | null
          id: string
          mentor_response: string | null
          mood: string
          reflection_date: string
          user_id: string
          wins: string | null
        }
        Insert: {
          created_at?: string
          gratitude?: string | null
          id?: string
          mentor_response?: string | null
          mood: string
          reflection_date?: string
          user_id: string
          wins?: string | null
        }
        Update: {
          created_at?: string
          gratitude?: string | null
          id?: string
          mentor_response?: string | null
          mood?: string
          reflection_date?: string
          user_id?: string
          wins?: string | null
        }
        Relationships: []
      }
      evolution_thresholds: {
        Row: {
          stage: number
          stage_name: string
          xp_required: number
        }
        Insert: {
          stage: number
          stage_name: string
          xp_required: number
        }
        Update: {
          stage?: number
          stage_name?: string
          xp_required?: number
        }
        Relationships: []
      }
      external_calendar_events: {
        Row: {
          color: string | null
          connection_id: string
          description: string | null
          end_time: string
          external_event_id: string
          id: string
          is_all_day: boolean | null
          location: string | null
          raw_data: Json | null
          source: string
          start_time: string
          synced_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          color?: string | null
          connection_id: string
          description?: string | null
          end_time: string
          external_event_id: string
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          raw_data?: Json | null
          source: string
          start_time: string
          synced_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          color?: string | null
          connection_id?: string
          description?: string | null
          end_time?: string
          external_event_id?: string
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          raw_data?: Json | null
          source?: string
          start_time?: string
          synced_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "user_calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          actual_duration: number | null
          completed_at: string | null
          created_at: string
          distractions_count: number | null
          duration_type: string
          id: string
          notes: string | null
          paused_at: string | null
          planned_duration: number
          started_at: string
          status: string | null
          task_id: string | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          actual_duration?: number | null
          completed_at?: string | null
          created_at?: string
          distractions_count?: number | null
          duration_type: string
          id?: string
          notes?: string | null
          paused_at?: string | null
          planned_duration: number
          started_at?: string
          status?: string | null
          task_id?: string | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          actual_duration?: number | null
          completed_at?: string | null
          created_at?: string
          distractions_count?: number | null
          duration_type?: string
          id?: string
          notes?: string | null
          paused_at?: string | null
          planned_duration?: number
          started_at?: string
          status?: string | null
          task_id?: string | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_artifact_unlocks: {
        Row: {
          artifact_id: string
          community_id: string | null
          epic_id: string | null
          id: string
          unlocked_at: string
          unlocked_by: string
        }
        Insert: {
          artifact_id: string
          community_id?: string | null
          epic_id?: string | null
          id?: string
          unlocked_at?: string
          unlocked_by: string
        }
        Update: {
          artifact_id?: string
          community_id?: string | null
          epic_id?: string | null
          id?: string
          unlocked_at?: string
          unlocked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_artifact_unlocks_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "guild_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_artifact_unlocks_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_artifact_unlocks_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_artifact_unlocks_unlocked_by_fkey"
            columns: ["unlocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_artifacts: {
        Row: {
          artifact_type: string
          created_at: string
          css_effect: Json | null
          description: string
          icon: string
          id: string
          image_url: string | null
          name: string
          rarity: string
          unlock_requirement_type: string
          unlock_requirement_value: number
        }
        Insert: {
          artifact_type: string
          created_at?: string
          css_effect?: Json | null
          description: string
          icon: string
          id?: string
          image_url?: string | null
          name: string
          rarity?: string
          unlock_requirement_type: string
          unlock_requirement_value: number
        }
        Update: {
          artifact_type?: string
          created_at?: string
          css_effect?: Json | null
          description?: string
          icon?: string
          id?: string
          image_url?: string | null
          name?: string
          rarity?: string
          unlock_requirement_type?: string
          unlock_requirement_value?: number
        }
        Relationships: []
      }
      guild_blessing_charges: {
        Row: {
          charges_remaining: number
          created_at: string
          id: string
          last_refresh_at: string
          max_charges: number
          user_id: string
        }
        Insert: {
          charges_remaining?: number
          created_at?: string
          id?: string
          last_refresh_at?: string
          max_charges?: number
          user_id: string
        }
        Update: {
          charges_remaining?: number
          created_at?: string
          id?: string
          last_refresh_at?: string
          max_charges?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_blessing_charges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_blessing_types: {
        Row: {
          created_at: string
          description: string
          effect_duration_hours: number
          effect_type: string
          effect_value: number
          icon: string
          id: string
          name: string
          rarity: string
          theme_color: string
        }
        Insert: {
          created_at?: string
          description: string
          effect_duration_hours?: number
          effect_type: string
          effect_value?: number
          icon: string
          id?: string
          name: string
          rarity?: string
          theme_color?: string
        }
        Update: {
          created_at?: string
          description?: string
          effect_duration_hours?: number
          effect_type?: string
          effect_value?: number
          icon?: string
          id?: string
          name?: string
          rarity?: string
          theme_color?: string
        }
        Relationships: []
      }
      guild_blessings: {
        Row: {
          blessing_type_id: string
          community_id: string | null
          created_at: string
          epic_id: string | null
          expires_at: string
          id: string
          is_active: boolean
          message: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          blessing_type_id: string
          community_id?: string | null
          created_at?: string
          epic_id?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          message?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          blessing_type_id?: string
          community_id?: string | null
          created_at?: string
          epic_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          message?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_blessings_blessing_type_id_fkey"
            columns: ["blessing_type_id"]
            isOneToOne: false
            referencedRelation: "guild_blessing_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_blessings_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_blessings_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_blessings_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_blessings_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_boss_damage_log: {
        Row: {
          created_at: string
          damage_amount: number
          damage_source: string
          encounter_id: string
          id: string
          is_killing_blow: boolean
          source_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          damage_amount: number
          damage_source: string
          encounter_id: string
          id?: string
          is_killing_blow?: boolean
          source_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          damage_amount?: number
          damage_source?: string
          encounter_id?: string
          id?: string
          is_killing_blow?: boolean
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_boss_damage_log_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "guild_boss_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_boss_damage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_boss_encounters: {
        Row: {
          boss_image_url: string | null
          boss_lore: string | null
          boss_name: string
          boss_tier: string
          boss_title: string | null
          community_id: string | null
          created_at: string
          current_hp: number
          defeated_at: string | null
          epic_id: string | null
          expires_at: string
          id: string
          max_hp: number
          spawned_at: string
          status: string
          xp_reward: number
        }
        Insert: {
          boss_image_url?: string | null
          boss_lore?: string | null
          boss_name: string
          boss_tier?: string
          boss_title?: string | null
          community_id?: string | null
          created_at?: string
          current_hp?: number
          defeated_at?: string | null
          epic_id?: string | null
          expires_at: string
          id?: string
          max_hp?: number
          spawned_at?: string
          status?: string
          xp_reward?: number
        }
        Update: {
          boss_image_url?: string | null
          boss_lore?: string | null
          boss_name?: string
          boss_tier?: string
          boss_title?: string | null
          community_id?: string | null
          created_at?: string
          current_hp?: number
          defeated_at?: string | null
          epic_id?: string | null
          expires_at?: string
          id?: string
          max_hp?: number
          spawned_at?: string
          status?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "guild_boss_encounters_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_boss_encounters_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_legends: {
        Row: {
          community_id: string | null
          description: string
          epic_id: string | null
          hero_ids: string[]
          icon: string
          id: string
          legend_type: string
          metadata: Json | null
          recorded_at: string
          title: string
        }
        Insert: {
          community_id?: string | null
          description: string
          epic_id?: string | null
          hero_ids?: string[]
          icon: string
          id?: string
          legend_type: string
          metadata?: Json | null
          recorded_at?: string
          title: string
        }
        Update: {
          community_id?: string | null
          description?: string
          epic_id?: string | null
          hero_ids?: string[]
          icon?: string
          id?: string
          legend_type?: string
          metadata?: Json | null
          recorded_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_legends_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_legends_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_member_titles: {
        Row: {
          community_id: string | null
          earned_at: string
          epic_id: string | null
          id: string
          is_active: boolean
          title_id: string
          user_id: string
        }
        Insert: {
          community_id?: string | null
          earned_at?: string
          epic_id?: string | null
          id?: string
          is_active?: boolean
          title_id: string
          user_id: string
        }
        Update: {
          community_id?: string | null
          earned_at?: string
          epic_id?: string | null
          id?: string
          is_active?: boolean
          title_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_member_titles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_member_titles_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_member_titles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "guild_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_member_titles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_prophecies: {
        Row: {
          community_id: string | null
          created_at: string
          epic_id: string | null
          expires_at: string
          fulfilled_at: string | null
          id: string
          is_fulfilled: boolean
          prophecy_text: string
          prophecy_type: string
          prophet_id: string
          subject_id: string
          target_value: number | null
          xp_reward: number
        }
        Insert: {
          community_id?: string | null
          created_at?: string
          epic_id?: string | null
          expires_at: string
          fulfilled_at?: string | null
          id?: string
          is_fulfilled?: boolean
          prophecy_text: string
          prophecy_type: string
          prophet_id: string
          subject_id: string
          target_value?: number | null
          xp_reward?: number
        }
        Update: {
          community_id?: string | null
          created_at?: string
          epic_id?: string | null
          expires_at?: string
          fulfilled_at?: string | null
          id?: string
          is_fulfilled?: boolean
          prophecy_text?: string
          prophecy_type?: string
          prophet_id?: string
          subject_id?: string
          target_value?: number | null
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "guild_prophecies_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_prophecies_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_prophecies_prophet_id_fkey"
            columns: ["prophet_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_prophecies_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_raid_scores: {
        Row: {
          bosses_defeated: number
          community_id: string | null
          epic_id: string | null
          id: string
          members_active: number
          rank: number | null
          season_id: string
          total_damage_dealt: number
          total_score: number
          updated_at: string
        }
        Insert: {
          bosses_defeated?: number
          community_id?: string | null
          epic_id?: string | null
          id?: string
          members_active?: number
          rank?: number | null
          season_id: string
          total_damage_dealt?: number
          total_score?: number
          updated_at?: string
        }
        Update: {
          bosses_defeated?: number
          community_id?: string | null
          epic_id?: string | null
          id?: string
          members_active?: number
          rank?: number | null
          season_id?: string
          total_damage_dealt?: number
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_raid_scores_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_raid_scores_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_raid_scores_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "guild_raid_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_raid_seasons: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          name: string
          rewards: Json | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          rewards?: Json | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rewards?: Json | null
          starts_at?: string
        }
        Relationships: []
      }
      guild_ritual_attendance: {
        Row: {
          attended_at: string
          id: string
          ritual_date: string
          ritual_id: string
          user_id: string
        }
        Insert: {
          attended_at?: string
          id?: string
          ritual_date?: string
          ritual_id: string
          user_id: string
        }
        Update: {
          attended_at?: string
          id?: string
          ritual_date?: string
          ritual_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_ritual_attendance_ritual_id_fkey"
            columns: ["ritual_id"]
            isOneToOne: false
            referencedRelation: "guild_rituals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_ritual_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_rituals: {
        Row: {
          community_id: string | null
          created_at: string
          created_by: string
          description: string | null
          epic_id: string | null
          id: string
          is_active: boolean
          name: string
          ritual_type: string
          scheduled_days: number[]
          scheduled_time: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          epic_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          ritual_type: string
          scheduled_days?: number[]
          scheduled_time: string
        }
        Update: {
          community_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          epic_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          ritual_type?: string
          scheduled_days?: number[]
          scheduled_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_rituals_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_rituals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_rituals_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_rivalries: {
        Row: {
          community_id: string | null
          created_at: string | null
          epic_id: string | null
          id: string
          rival_id: string
          user_id: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string | null
          epic_id?: string | null
          id?: string
          rival_id: string
          user_id: string
        }
        Update: {
          community_id?: string | null
          created_at?: string | null
          epic_id?: string | null
          id?: string
          rival_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_rivalries_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_rivalries_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_rivalries_rival_id_fkey"
            columns: ["rival_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_rivalries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_shouts: {
        Row: {
          community_id: string | null
          created_at: string | null
          epic_id: string | null
          id: string
          is_read: boolean | null
          message_key: string
          recipient_id: string
          sender_id: string
          shout_type: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string | null
          epic_id?: string | null
          id?: string
          is_read?: boolean | null
          message_key: string
          recipient_id: string
          sender_id: string
          shout_type: string
        }
        Update: {
          community_id?: string | null
          created_at?: string | null
          epic_id?: string | null
          id?: string
          is_read?: boolean | null
          message_key?: string
          recipient_id?: string
          sender_id?: string
          shout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_shouts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_shouts_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_shouts_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_shouts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_stories: {
        Row: {
          bond_lesson: string
          chapter_number: number
          chapter_title: string
          climax_moment: string
          community_id: string | null
          companion_spotlights: Json
          created_at: string | null
          epic_id: string
          generated_at: string | null
          id: string
          intro_line: string
          main_story: string
          next_hook: string | null
          trigger_type: string
        }
        Insert: {
          bond_lesson: string
          chapter_number?: number
          chapter_title: string
          climax_moment: string
          community_id?: string | null
          companion_spotlights?: Json
          created_at?: string | null
          epic_id: string
          generated_at?: string | null
          id?: string
          intro_line: string
          main_story: string
          next_hook?: string | null
          trigger_type: string
        }
        Update: {
          bond_lesson?: string
          chapter_number?: number
          chapter_title?: string
          climax_moment?: string
          community_id?: string | null
          companion_spotlights?: Json
          created_at?: string | null
          epic_id?: string
          generated_at?: string | null
          id?: string
          intro_line?: string
          main_story?: string
          next_hook?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_stories_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_stories_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_story_reads: {
        Row: {
          id: string
          read_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          id?: string
          read_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          id?: string
          read_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_story_reads_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "guild_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guild_story_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_titles: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          rarity: string
          requirement_type: string
          requirement_value: number
          theme_color: string
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          rarity?: string
          requirement_type: string
          requirement_value: number
          theme_color?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          rarity?: string
          requirement_type?: string
          requirement_value?: number
          theme_color?: string
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          completed_at: string | null
          date: string
          habit_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          date?: string
          habit_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          date?: string
          habit_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string | null
          current_streak: number | null
          custom_days: number[] | null
          description: string | null
          difficulty: string | null
          estimated_minutes: number | null
          frequency: string
          id: string
          is_active: boolean | null
          longest_streak: number | null
          preferred_time: string | null
          reminder_enabled: boolean | null
          reminder_minutes_before: number | null
          reminder_sent_today: boolean | null
          sort_order: number | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          custom_days?: number[] | null
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          frequency: string
          id?: string
          is_active?: boolean | null
          longest_streak?: number | null
          preferred_time?: string | null
          reminder_enabled?: boolean | null
          reminder_minutes_before?: number | null
          reminder_sent_today?: boolean | null
          sort_order?: number | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          custom_days?: number[] | null
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          longest_streak?: number | null
          preferred_time?: string | null
          reminder_enabled?: boolean | null
          reminder_minutes_before?: number | null
          reminder_sent_today?: boolean | null
          sort_order?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          mentor_id: string | null
          position: number | null
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          mentor_id?: string | null
          position?: number | null
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          mentor_id?: string | null
          position?: number | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_slides_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_creation_log: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_address: string
          request_type: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_address: string
          request_type?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string
          request_type?: string | null
        }
        Relationships: []
      }
      journey_phases: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          epic_id: string
          id: string
          is_active: boolean | null
          name: string
          phase_order: number
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          epic_id: string
          id?: string
          is_active?: boolean | null
          name: string
          phase_order?: number
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          epic_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phase_order?: number
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_phases_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_mentors: {
        Row: {
          created_at: string | null
          id: string
          lesson_id: string | null
          mentor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          mentor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          mentor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_mentors_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_mentors_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          audio_url: string | null
          category: string | null
          content: string
          created_at: string | null
          description: string
          id: string
          is_premium: boolean | null
          lesson_number: number | null
          mentor_id: string | null
          title: string
          total_lessons: number | null
        }
        Insert: {
          audio_url?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          description: string
          id?: string
          is_premium?: boolean | null
          lesson_number?: number | null
          mentor_id?: string | null
          title: string
          total_lessons?: number | null
        }
        Update: {
          audio_url?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          description?: string
          id?: string
          is_premium?: boolean | null
          lesson_number?: number | null
          mentor_id?: string | null
          title?: string
          total_lessons?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_chats: {
        Row: {
          content: string
          created_at: string | null
          id: string
          mentor_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_chats_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_nudges: {
        Row: {
          context: Json | null
          created_at: string
          delivered_at: string | null
          dismissed_at: string | null
          id: string
          message: string
          nudge_type: string
          push_sent_at: string | null
          read_at: string | null
          user_id: string
          voice_url: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          delivered_at?: string | null
          dismissed_at?: string | null
          id?: string
          message: string
          nudge_type: string
          push_sent_at?: string | null
          read_at?: string | null
          user_id: string
          voice_url?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          delivered_at?: string | null
          dismissed_at?: string | null
          id?: string
          message?: string
          nudge_type?: string
          push_sent_at?: string | null
          read_at?: string | null
          user_id?: string
          voice_url?: string | null
        }
        Relationships: []
      }
      mentor_story_relationship: {
        Row: {
          created_at: string | null
          current_since: string | null
          id: string
          key_moments: string[] | null
          mentor_id: string | null
          mentor_transitions: Json | null
          trust_level: number | null
          updated_at: string | null
          user_id: string
          wisdom_shared: string[] | null
        }
        Insert: {
          created_at?: string | null
          current_since?: string | null
          id?: string
          key_moments?: string[] | null
          mentor_id?: string | null
          mentor_transitions?: Json | null
          trust_level?: number | null
          updated_at?: string | null
          user_id: string
          wisdom_shared?: string[] | null
        }
        Update: {
          created_at?: string | null
          current_since?: string | null
          id?: string
          key_moments?: string[] | null
          mentor_id?: string | null
          mentor_transitions?: Json | null
          trust_level?: number | null
          updated_at?: string | null
          user_id?: string
          wisdom_shared?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_story_relationship_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentors: {
        Row: {
          archetype: string | null
          avatar_url: string | null
          created_at: string
          description: string
          gender_energy: string | null
          id: string
          identity_description: string | null
          intensity_level: string | null
          is_active: boolean | null
          mentor_type: string
          name: string
          primary_color: string | null
          short_title: string | null
          signature_line: string | null
          slug: string | null
          style: string | null
          style_description: string | null
          tags: string[]
          target_user: string | null
          target_user_type: string | null
          theme_config: Json | null
          themes: string[] | null
          tone_description: string
          voice_style: string
          welcome_message: string | null
        }
        Insert: {
          archetype?: string | null
          avatar_url?: string | null
          created_at?: string
          description: string
          gender_energy?: string | null
          id?: string
          identity_description?: string | null
          intensity_level?: string | null
          is_active?: boolean | null
          mentor_type: string
          name: string
          primary_color?: string | null
          short_title?: string | null
          signature_line?: string | null
          slug?: string | null
          style?: string | null
          style_description?: string | null
          tags?: string[]
          target_user?: string | null
          target_user_type?: string | null
          theme_config?: Json | null
          themes?: string[] | null
          tone_description: string
          voice_style: string
          welcome_message?: string | null
        }
        Update: {
          archetype?: string | null
          avatar_url?: string | null
          created_at?: string
          description?: string
          gender_energy?: string | null
          id?: string
          identity_description?: string | null
          intensity_level?: string | null
          is_active?: boolean | null
          mentor_type?: string
          name?: string
          primary_color?: string | null
          short_title?: string | null
          signature_line?: string | null
          slug?: string | null
          style?: string | null
          style_description?: string | null
          tags?: string[]
          target_user?: string | null
          target_user_type?: string | null
          theme_config?: Json | null
          themes?: string[] | null
          tone_description?: string
          voice_style?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      mood_logs: {
        Row: {
          created_at: string
          id: string
          mood: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: string
          user_id?: string
        }
        Relationships: []
      }
      morning_briefings: {
        Row: {
          action_prompt: string | null
          briefing_date: string
          content: string
          created_at: string
          data_snapshot: Json | null
          dismissed_at: string | null
          id: string
          inferred_goals: Json | null
          mentor_id: string | null
          todays_focus: string | null
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          action_prompt?: string | null
          briefing_date?: string
          content: string
          created_at?: string
          data_snapshot?: Json | null
          dismissed_at?: string | null
          id?: string
          inferred_goals?: Json | null
          mentor_id?: string | null
          todays_focus?: string | null
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          action_prompt?: string | null
          briefing_date?: string
          content?: string
          created_at?: string
          data_snapshot?: Json | null
          dismissed_at?: string | null
          id?: string
          inferred_goals?: Json | null
          mentor_id?: string | null
          todays_focus?: string | null
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "morning_briefings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "morning_briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      muted_guild_users: {
        Row: {
          epic_id: string | null
          id: string
          muted_at: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          epic_id?: string | null
          id?: string
          muted_at?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          epic_id?: string | null
          id?: string
          muted_at?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muted_guild_users_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muted_guild_users_muted_user_id_fkey"
            columns: ["muted_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muted_guild_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          failure_reason: string | null
          id: string
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          id?: string
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          id?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pep_talk_mentors: {
        Row: {
          created_at: string | null
          id: string
          mentor_id: string | null
          pep_talk_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          pep_talk_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          pep_talk_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pep_talk_mentors_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pep_talk_mentors_pep_talk_id_fkey"
            columns: ["pep_talk_id"]
            isOneToOne: false
            referencedRelation: "pep_talks"
            referencedColumns: ["id"]
          },
        ]
      }
      pep_talks: {
        Row: {
          audio_url: string
          category: string
          created_at: string
          description: string
          emotional_triggers: string[] | null
          for_date: string | null
          id: string
          intensity: string | null
          is_featured: boolean
          is_premium: boolean | null
          mentor_id: string | null
          mentor_slug: string | null
          quote: string
          source: string | null
          tags: string[] | null
          title: string
          topic_category: string[] | null
          transcript: Json | null
        }
        Insert: {
          audio_url: string
          category: string
          created_at?: string
          description: string
          emotional_triggers?: string[] | null
          for_date?: string | null
          id?: string
          intensity?: string | null
          is_featured?: boolean
          is_premium?: boolean | null
          mentor_id?: string | null
          mentor_slug?: string | null
          quote: string
          source?: string | null
          tags?: string[] | null
          title: string
          topic_category?: string[] | null
          transcript?: Json | null
        }
        Update: {
          audio_url?: string
          category?: string
          created_at?: string
          description?: string
          emotional_triggers?: string[] | null
          for_date?: string | null
          id?: string
          intensity?: string | null
          is_featured?: boolean
          is_premium?: boolean | null
          mentor_id?: string | null
          mentor_slug?: string | null
          quote?: string
          source?: string | null
          tags?: string[] | null
          title?: string
          topic_category?: string[] | null
          transcript?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pep_talks_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          playlist_id: string
          position: number | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          playlist_id: string
          position?: number | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          playlist_id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_premium: boolean | null
          mentor_id: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          mentor_id?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          mentor_id?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      productivity_stats: {
        Row: {
          created_at: string
          focus_sessions_completed: number | null
          id: string
          most_productive_context: string | null
          peak_hour: number | null
          productivity_score: number | null
          stat_date: string
          streak_maintained: boolean | null
          subtasks_completed: number | null
          tasks_completed: number | null
          tasks_created: number | null
          top_three_completed: number | null
          total_focus_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus_sessions_completed?: number | null
          id?: string
          most_productive_context?: string | null
          peak_hour?: number | null
          productivity_score?: number | null
          stat_date?: string
          streak_maintained?: boolean | null
          subtasks_completed?: number | null
          tasks_completed?: number | null
          tasks_created?: number | null
          top_three_completed?: number | null
          total_focus_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          focus_sessions_completed?: number | null
          id?: string
          most_productive_context?: string | null
          peak_hour?: number | null
          productivity_score?: number | null
          stat_date?: string
          streak_maintained?: boolean | null
          subtasks_completed?: number | null
          tasks_completed?: number | null
          tasks_created?: number | null
          top_three_completed?: number | null
          total_focus_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productivity_stats_most_productive_context_fkey"
            columns: ["most_productive_context"]
            isOneToOne: false
            referencedRelation: "task_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          astral_encounters_enabled: boolean | null
          birth_location: string | null
          birth_time: string | null
          birthdate: string | null
          cosmic_profile_generated_at: string | null
          created_at: string | null
          current_habit_streak: number | null
          daily_push_enabled: boolean | null
          daily_push_time: string | null
          daily_push_window: string | null
          daily_quote_push_enabled: boolean | null
          daily_quote_push_time: string | null
          daily_quote_push_window: string | null
          email: string | null
          faction: string | null
          habit_reminders_enabled: boolean | null
          id: string
          is_premium: boolean | null
          last_encounter_quest_count: number | null
          last_streak_freeze_used: string | null
          last_weekly_encounter: string | null
          longest_habit_streak: number | null
          mars_sign: string | null
          mercury_sign: string | null
          moon_sign: string | null
          next_encounter_quest_count: number | null
          onboarding_completed: boolean | null
          onboarding_data: Json | null
          onboarding_step: string | null
          paypal_email: string | null
          preferences: Json | null
          referral_code: string | null
          referral_count: number | null
          referred_by: string | null
          referred_by_code: string | null
          rising_sign: string | null
          selected_mentor_id: string | null
          streak_at_risk: boolean | null
          streak_at_risk_since: string | null
          streak_freezes_available: number | null
          streak_freezes_reset_at: string | null
          stripe_customer_id: string | null
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          task_reminders_enabled: boolean | null
          timezone: string | null
          total_quests_completed: number | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          venus_sign: string | null
          zodiac_sign: string | null
        }
        Insert: {
          astral_encounters_enabled?: boolean | null
          birth_location?: string | null
          birth_time?: string | null
          birthdate?: string | null
          cosmic_profile_generated_at?: string | null
          created_at?: string | null
          current_habit_streak?: number | null
          daily_push_enabled?: boolean | null
          daily_push_time?: string | null
          daily_push_window?: string | null
          daily_quote_push_enabled?: boolean | null
          daily_quote_push_time?: string | null
          daily_quote_push_window?: string | null
          email?: string | null
          faction?: string | null
          habit_reminders_enabled?: boolean | null
          id: string
          is_premium?: boolean | null
          last_encounter_quest_count?: number | null
          last_streak_freeze_used?: string | null
          last_weekly_encounter?: string | null
          longest_habit_streak?: number | null
          mars_sign?: string | null
          mercury_sign?: string | null
          moon_sign?: string | null
          next_encounter_quest_count?: number | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          onboarding_step?: string | null
          paypal_email?: string | null
          preferences?: Json | null
          referral_code?: string | null
          referral_count?: number | null
          referred_by?: string | null
          referred_by_code?: string | null
          rising_sign?: string | null
          selected_mentor_id?: string | null
          streak_at_risk?: boolean | null
          streak_at_risk_since?: string | null
          streak_freezes_available?: number | null
          streak_freezes_reset_at?: string | null
          stripe_customer_id?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          task_reminders_enabled?: boolean | null
          timezone?: string | null
          total_quests_completed?: number | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          venus_sign?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          astral_encounters_enabled?: boolean | null
          birth_location?: string | null
          birth_time?: string | null
          birthdate?: string | null
          cosmic_profile_generated_at?: string | null
          created_at?: string | null
          current_habit_streak?: number | null
          daily_push_enabled?: boolean | null
          daily_push_time?: string | null
          daily_push_window?: string | null
          daily_quote_push_enabled?: boolean | null
          daily_quote_push_time?: string | null
          daily_quote_push_window?: string | null
          email?: string | null
          faction?: string | null
          habit_reminders_enabled?: boolean | null
          id?: string
          is_premium?: boolean | null
          last_encounter_quest_count?: number | null
          last_streak_freeze_used?: string | null
          last_weekly_encounter?: string | null
          longest_habit_streak?: number | null
          mars_sign?: string | null
          mercury_sign?: string | null
          moon_sign?: string | null
          next_encounter_quest_count?: number | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          onboarding_step?: string | null
          paypal_email?: string | null
          preferences?: Json | null
          referral_code?: string | null
          referral_count?: number | null
          referred_by?: string | null
          referred_by_code?: string | null
          rising_sign?: string | null
          selected_mentor_id?: string | null
          streak_at_risk?: boolean | null
          streak_at_risk_since?: string | null
          streak_freezes_available?: number | null
          streak_freezes_reset_at?: string | null
          stripe_customer_id?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          task_reminders_enabled?: boolean | null
          timezone?: string | null
          total_quests_completed?: number | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          venus_sign?: string | null
          zodiac_sign?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_selected_mentor_id_fkey"
            columns: ["selected_mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          output_constraints: Json | null
          system_prompt: string
          template_key: string
          template_name: string
          updated_at: string | null
          user_prompt_template: string
          validation_rules: Json | null
          variables: Json | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          output_constraints?: Json | null
          system_prompt: string
          template_key: string
          template_name: string
          updated_at?: string | null
          user_prompt_template: string
          validation_rules?: Json | null
          variables?: Json | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          output_constraints?: Json | null
          system_prompt?: string
          template_key?: string
          template_name?: string
          updated_at?: string | null
          user_prompt_template?: string
          validation_rules?: Json | null
          variables?: Json | null
        }
        Relationships: []
      }
      push_device_tokens: {
        Row: {
          created_at: string | null
          device_token: string
          id: string
          platform: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_token: string
          id?: string
          platform: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_token?: string
          id?: string
          platform?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_notification_queue: {
        Row: {
          body: string
          context: Json | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          id: string
          notification_type: string
          scheduled_for: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          context?: Json | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string
          notification_type: string
          scheduled_for: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          context?: Json | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          id?: string
          notification_type?: string
          scheduled_for?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      questionnaire_responses: {
        Row: {
          answer_tags: string[]
          created_at: string | null
          id: string
          question_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer_tags: string[]
          created_at?: string | null
          id?: string
          question_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer_tags?: string[]
          created_at?: string | null
          id?: string
          question_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          author: string | null
          category: string | null
          created_at: string | null
          emotional_triggers: string[] | null
          id: string
          intensity: string | null
          is_premium: boolean | null
          mentor_id: string | null
          tags: string[] | null
          text: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          created_at?: string | null
          emotional_triggers?: string[] | null
          id?: string
          intensity?: string | null
          is_premium?: boolean | null
          mentor_id?: string | null
          tags?: string[] | null
          text: string
        }
        Update: {
          author?: string | null
          category?: string | null
          created_at?: string | null
          emotional_triggers?: string[] | null
          id?: string
          intensity?: string | null
          is_premium?: boolean | null
          mentor_id?: string | null
          tags?: string[] | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          influencer_email: string | null
          influencer_handle: string | null
          influencer_name: string | null
          is_active: boolean | null
          owner_type: string
          owner_user_id: string | null
          payout_identifier: string | null
          payout_method: string | null
          tier: string | null
          total_conversions: number | null
          total_revenue: number | null
          total_signups: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          influencer_email?: string | null
          influencer_handle?: string | null
          influencer_name?: string | null
          is_active?: boolean | null
          owner_type: string
          owner_user_id?: string | null
          payout_identifier?: string | null
          payout_method?: string | null
          tier?: string | null
          total_conversions?: number | null
          total_revenue?: number | null
          total_signups?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          influencer_email?: string | null
          influencer_handle?: string | null
          influencer_name?: string | null
          is_active?: boolean | null
          owner_type?: string
          owner_user_id?: string | null
          payout_identifier?: string | null
          payout_method?: string | null
          tier?: string | null
          total_conversions?: number | null
          total_revenue?: number | null
          total_signups?: number | null
        }
        Relationships: []
      }
      referral_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_payouts: {
        Row: {
          admin_notes: string | null
          amount: number
          apple_transaction_id: string | null
          approved_at: string | null
          created_at: string | null
          failure_reason: string | null
          id: string
          last_retry_at: string | null
          next_retry_at: string | null
          paid_at: string | null
          payout_type: string
          paypal_payer_id: string | null
          paypal_transaction_id: string | null
          referee_id: string
          referral_code_id: string | null
          referrer_id: string | null
          rejected_at: string | null
          retry_count: number | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          apple_transaction_id?: string | null
          approved_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          last_retry_at?: string | null
          next_retry_at?: string | null
          paid_at?: string | null
          payout_type: string
          paypal_payer_id?: string | null
          paypal_transaction_id?: string | null
          referee_id: string
          referral_code_id?: string | null
          referrer_id?: string | null
          rejected_at?: string | null
          retry_count?: number | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          apple_transaction_id?: string | null
          approved_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          last_retry_at?: string | null
          next_retry_at?: string | null
          paid_at?: string | null
          payout_type?: string
          paypal_payer_id?: string | null
          paypal_transaction_id?: string | null
          referee_id?: string
          referral_code_id?: string | null
          referrer_id?: string | null
          rejected_at?: string | null
          retry_count?: number | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_payouts_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_payouts_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_payouts_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          time_of_day: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          time_of_day: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          time_of_day?: string
          user_id?: string
        }
        Relationships: []
      }
      rhythm_track_ratings: {
        Row: {
          created_at: string | null
          id: string
          rating: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rating: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rating?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rhythm_track_ratings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "rhythm_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rhythm_track_ratings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "rhythm_tracks_with_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      rhythm_tracks: {
        Row: {
          audio_url: string
          bpm: number
          created_at: string | null
          difficulty_tier: string | null
          duration_seconds: number
          genre: string | null
          id: string
          is_active: boolean | null
          play_count: number | null
          prompt: string
          storage_path: string
        }
        Insert: {
          audio_url: string
          bpm: number
          created_at?: string | null
          difficulty_tier?: string | null
          duration_seconds: number
          genre?: string | null
          id?: string
          is_active?: boolean | null
          play_count?: number | null
          prompt: string
          storage_path: string
        }
        Update: {
          audio_url?: string
          bpm?: number
          created_at?: string | null
          difficulty_tier?: string | null
          duration_seconds?: number
          genre?: string | null
          id?: string
          is_active?: boolean | null
          play_count?: number | null
          prompt?: string
          storage_path?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          function_name: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          function_name: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          function_name?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      shout_push_log: {
        Row: {
          community_id: string | null
          epic_id: string | null
          id: string
          recipient_id: string
          sender_id: string
          sent_at: string
        }
        Insert: {
          community_id?: string | null
          epic_id?: string | null
          id?: string
          recipient_id: string
          sender_id: string
          sent_at?: string
        }
        Update: {
          community_id?: string | null
          epic_id?: string | null
          id?: string
          recipient_id?: string
          sender_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shout_push_log_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shout_push_log_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shout_push_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shout_push_log_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_characters: {
        Row: {
          arc_stage: string | null
          archetype: string
          backstory: string | null
          catchphrase: string | null
          core_motivation: string | null
          created_at: string | null
          current_goal: string | null
          fate: string | null
          first_appeared_chapter: number | null
          first_appeared_epic_id: string | null
          greatest_fear: string | null
          id: string
          is_active: boolean | null
          last_seen_chapter: number | null
          last_seen_epic_id: string | null
          name: string
          relationship_history: string[] | null
          relationship_to_user: string | null
          secret_shame: string | null
          signature_feature: string | null
          species: string | null
          speech_pattern: string | null
          times_encountered: number | null
          updated_at: string | null
          user_id: string
          visual_description: string | null
        }
        Insert: {
          arc_stage?: string | null
          archetype: string
          backstory?: string | null
          catchphrase?: string | null
          core_motivation?: string | null
          created_at?: string | null
          current_goal?: string | null
          fate?: string | null
          first_appeared_chapter?: number | null
          first_appeared_epic_id?: string | null
          greatest_fear?: string | null
          id?: string
          is_active?: boolean | null
          last_seen_chapter?: number | null
          last_seen_epic_id?: string | null
          name: string
          relationship_history?: string[] | null
          relationship_to_user?: string | null
          secret_shame?: string | null
          signature_feature?: string | null
          species?: string | null
          speech_pattern?: string | null
          times_encountered?: number | null
          updated_at?: string | null
          user_id: string
          visual_description?: string | null
        }
        Update: {
          arc_stage?: string | null
          archetype?: string
          backstory?: string | null
          catchphrase?: string | null
          core_motivation?: string | null
          created_at?: string | null
          current_goal?: string | null
          fate?: string | null
          first_appeared_chapter?: number | null
          first_appeared_epic_id?: string | null
          greatest_fear?: string | null
          id?: string
          is_active?: boolean | null
          last_seen_chapter?: number | null
          last_seen_epic_id?: string | null
          name?: string
          relationship_history?: string[] | null
          relationship_to_user?: string | null
          secret_shame?: string | null
          signature_feature?: string | null
          species?: string | null
          speech_pattern?: string | null
          times_encountered?: number | null
          updated_at?: string | null
          user_id?: string
          visual_description?: string | null
        }
        Relationships: []
      }
      story_universe: {
        Row: {
          active_mysteries: string[] | null
          created_at: string | null
          foreshadowing_seeds: string[] | null
          id: string
          memorable_moments: string[] | null
          prophecy_fragments: string[] | null
          resolved_mysteries: string[] | null
          running_callbacks: string[] | null
          updated_at: string | null
          user_id: string
          world_era: string | null
          world_name: string | null
        }
        Insert: {
          active_mysteries?: string[] | null
          created_at?: string | null
          foreshadowing_seeds?: string[] | null
          id?: string
          memorable_moments?: string[] | null
          prophecy_fragments?: string[] | null
          resolved_mysteries?: string[] | null
          running_callbacks?: string[] | null
          updated_at?: string | null
          user_id: string
          world_era?: string | null
          world_name?: string | null
        }
        Update: {
          active_mysteries?: string[] | null
          created_at?: string | null
          foreshadowing_seeds?: string[] | null
          id?: string
          memorable_moments?: string[] | null
          prophecy_fragments?: string[] | null
          resolved_mysteries?: string[] | null
          running_callbacks?: string[] | null
          updated_at?: string | null
          user_id?: string
          world_era?: string | null
          world_name?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          environment: string | null
          id: string
          plan: string
          source: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          environment?: string | null
          id?: string
          plan: string
          source?: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          environment?: string | null
          id?: string
          plan?: string
          source?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          sort_order: number | null
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          sort_order?: number | null
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          sort_order?: number | null
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_contexts: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reminders_log: {
        Row: {
          created_at: string | null
          id: string
          notification_status: string | null
          reminder_sent_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_status?: string | null
          reminder_sent_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_status?: string | null
          reminder_sent_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_learning: {
        Row: {
          acceptance_rate: number | null
          common_contexts: string[] | null
          created_at: string
          failed_patterns: Json | null
          id: string
          interaction_count: number | null
          last_interaction_at: string | null
          modification_rate: number | null
          peak_productivity_times: string[] | null
          preference_weights: Json | null
          preferred_epic_duration: number | null
          preferred_habit_difficulty: string | null
          preferred_habit_frequency: string | null
          successful_patterns: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acceptance_rate?: number | null
          common_contexts?: string[] | null
          created_at?: string
          failed_patterns?: Json | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          modification_rate?: number | null
          peak_productivity_times?: string[] | null
          preference_weights?: Json | null
          preferred_epic_duration?: number | null
          preferred_habit_difficulty?: string | null
          preferred_habit_frequency?: string | null
          successful_patterns?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acceptance_rate?: number | null
          common_contexts?: string[] | null
          created_at?: string
          failed_patterns?: Json | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          modification_rate?: number | null
          peak_productivity_times?: string[] | null
          preference_weights?: Json | null
          preferred_epic_duration?: number | null
          preferred_habit_difficulty?: string | null
          preferred_habit_frequency?: string | null
          successful_patterns?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_learning_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_preferences: {
        Row: {
          avoid_topics: string[] | null
          created_at: string | null
          detail_level: string | null
          formality: string | null
          id: string
          preferred_length: string | null
          response_style: string | null
          tone_preference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avoid_topics?: string[] | null
          created_at?: string | null
          detail_level?: string | null
          formality?: string | null
          id?: string
          preferred_length?: string | null
          response_style?: string | null
          tone_preference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avoid_topics?: string[] | null
          created_at?: string | null
          detail_level?: string | null
          formality?: string | null
          id?: string
          preferred_length?: string | null
          response_style?: string | null
          tone_preference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_calendar_connections: {
        Row: {
          access_token: string | null
          calendar_email: string | null
          calendar_id: string | null
          created_at: string | null
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          sync_enabled: boolean | null
          sync_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          calendar_email?: string | null
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          sync_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          calendar_email?: string | null
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          sync_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_challenges: {
        Row: {
          challenge_id: string | null
          created_at: string | null
          current_day: number | null
          end_date: string
          id: string
          start_date: string
          status: string | null
          user_id: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string | null
          current_day?: number | null
          end_date: string
          id?: string
          start_date?: string
          status?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string | null
          current_day?: number | null
          end_date?: string
          id?: string
          start_date?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companion: {
        Row: {
          body: number | null
          core_element: string
          created_at: string
          current_image_url: string | null
          current_mood: string | null
          current_stage: number
          current_xp: number
          eye_color: string | null
          favorite_color: string
          fur_color: string | null
          id: string
          image_regenerations_used: number
          inactive_days: number | null
          initial_image_url: string | null
          last_activity_date: string | null
          last_energy_update: string | null
          last_mood_update: string | null
          mind: number | null
          neglected_image_url: string | null
          soul: number | null
          spirit_animal: string
          story_tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: number | null
          core_element: string
          created_at?: string
          current_image_url?: string | null
          current_mood?: string | null
          current_stage?: number
          current_xp?: number
          eye_color?: string | null
          favorite_color: string
          fur_color?: string | null
          id?: string
          image_regenerations_used?: number
          inactive_days?: number | null
          initial_image_url?: string | null
          last_activity_date?: string | null
          last_energy_update?: string | null
          last_mood_update?: string | null
          mind?: number | null
          neglected_image_url?: string | null
          soul?: number | null
          spirit_animal: string
          story_tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: number | null
          core_element?: string
          created_at?: string
          current_image_url?: string | null
          current_mood?: string | null
          current_stage?: number
          current_xp?: number
          eye_color?: string | null
          favorite_color?: string
          fur_color?: string | null
          id?: string
          image_regenerations_used?: number
          inactive_days?: number | null
          initial_image_url?: string | null
          last_activity_date?: string | null
          last_energy_update?: string | null
          last_mood_update?: string | null
          mind?: number | null
          neglected_image_url?: string | null
          soul?: number | null
          spirit_animal?: string
          story_tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companion_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companion_skins: {
        Row: {
          acquired_at: string | null
          acquired_via: string | null
          id: string
          is_equipped: boolean | null
          skin_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string | null
          acquired_via?: string | null
          id?: string
          is_equipped?: boolean | null
          skin_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string | null
          acquired_via?: string | null
          id?: string
          is_equipped?: boolean | null
          skin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companion_skins_skin_id_fkey"
            columns: ["skin_id"]
            isOneToOne: false
            referencedRelation: "companion_skins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_companion_skins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cosmic_deep_dives: {
        Row: {
          action_insight: string | null
          challenges: string[]
          chart_synergy: string | null
          comfort_needs: string | null
          compatible_signs: string[]
          core_identity: string | null
          created_at: string
          daily_practice: string
          emotional_insight: string | null
          emotional_landscape: string | null
          emotional_triggers: string[] | null
          first_impressions: string | null
          for_date: string
          growth_areas: string[] | null
          id: string
          identity_insight: string | null
          in_relationships: string
          in_wellness: string
          in_work: string
          intuitive_gifts: string | null
          life_purpose: string | null
          love_insight: string | null
          mental_insight: string | null
          natural_strengths: string[] | null
          overview: string
          placement: string
          presentation_tips: string[] | null
          sign: string
          social_insight: string | null
          social_superpowers: string | null
          strengths: string[]
          tagline: string
          title: string
          todays_focus: string | null
          user_id: string
          your_aura: string | null
        }
        Insert: {
          action_insight?: string | null
          challenges?: string[]
          chart_synergy?: string | null
          comfort_needs?: string | null
          compatible_signs?: string[]
          core_identity?: string | null
          created_at?: string
          daily_practice: string
          emotional_insight?: string | null
          emotional_landscape?: string | null
          emotional_triggers?: string[] | null
          first_impressions?: string | null
          for_date: string
          growth_areas?: string[] | null
          id?: string
          identity_insight?: string | null
          in_relationships: string
          in_wellness: string
          in_work: string
          intuitive_gifts?: string | null
          life_purpose?: string | null
          love_insight?: string | null
          mental_insight?: string | null
          natural_strengths?: string[] | null
          overview: string
          placement: string
          presentation_tips?: string[] | null
          sign: string
          social_insight?: string | null
          social_superpowers?: string | null
          strengths?: string[]
          tagline: string
          title: string
          todays_focus?: string | null
          user_id: string
          your_aura?: string | null
        }
        Update: {
          action_insight?: string | null
          challenges?: string[]
          chart_synergy?: string | null
          comfort_needs?: string | null
          compatible_signs?: string[]
          core_identity?: string | null
          created_at?: string
          daily_practice?: string
          emotional_insight?: string | null
          emotional_landscape?: string | null
          emotional_triggers?: string[] | null
          first_impressions?: string | null
          for_date?: string
          growth_areas?: string[] | null
          id?: string
          identity_insight?: string | null
          in_relationships?: string
          in_wellness?: string
          in_work?: string
          intuitive_gifts?: string | null
          life_purpose?: string | null
          love_insight?: string | null
          mental_insight?: string | null
          natural_strengths?: string[] | null
          overview?: string
          placement?: string
          presentation_tips?: string[] | null
          sign?: string
          social_insight?: string | null
          social_superpowers?: string | null
          strengths?: string[]
          tagline?: string
          title?: string
          todays_focus?: string | null
          user_id?: string
          your_aura?: string | null
        }
        Relationships: []
      }
      user_daily_horoscopes: {
        Row: {
          cosmic_tip: string | null
          created_at: string | null
          energy_forecast: Json | null
          for_date: string
          horoscope_text: string
          id: string
          is_personalized: boolean
          placement_insights: Json | null
          user_id: string
          zodiac: string
        }
        Insert: {
          cosmic_tip?: string | null
          created_at?: string | null
          energy_forecast?: Json | null
          for_date?: string
          horoscope_text: string
          id?: string
          is_personalized?: boolean
          placement_insights?: Json | null
          user_id: string
          zodiac: string
        }
        Update: {
          cosmic_tip?: string | null
          created_at?: string | null
          energy_forecast?: Json | null
          for_date?: string
          horoscope_text?: string
          id?: string
          is_personalized?: boolean
          placement_insights?: Json | null
          user_id?: string
          zodiac?: string
        }
        Relationships: []
      }
      user_daily_pushes: {
        Row: {
          created_at: string
          daily_pep_talk_id: string
          delivered_at: string | null
          id: string
          scheduled_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_pep_talk_id: string
          delivered_at?: string | null
          id?: string
          scheduled_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_pep_talk_id?: string
          delivered_at?: string | null
          id?: string
          scheduled_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_pushes_daily_pep_talk_id_fkey"
            columns: ["daily_pep_talk_id"]
            isOneToOne: false
            referencedRelation: "daily_pep_talks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_quote_pushes: {
        Row: {
          created_at: string
          daily_quote_id: string
          delivered_at: string | null
          id: string
          scheduled_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_quote_id: string
          delivered_at?: string | null
          id?: string
          scheduled_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_quote_id?: string
          delivered_at?: string | null
          id?: string
          scheduled_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_quote_pushes_daily_quote_id_fkey"
            columns: ["daily_quote_id"]
            isOneToOne: false
            referencedRelation: "daily_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_epic_rewards: {
        Row: {
          epic_id: string | null
          id: string
          is_equipped: boolean | null
          reward_id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          epic_id?: string | null
          id?: string
          is_equipped?: boolean | null
          reward_id: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          epic_id?: string | null
          id?: string
          is_equipped?: boolean | null
          reward_id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_epic_rewards_epic_id_fkey"
            columns: ["epic_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_epic_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "epic_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_epic_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reflections: {
        Row: {
          ai_reply: string | null
          created_at: string
          id: string
          mood: string
          note: string | null
          reflection_date: string
          user_id: string
        }
        Insert: {
          ai_reply?: string | null
          created_at?: string
          id?: string
          mood: string
          note?: string | null
          reflection_date: string
          user_id: string
        }
        Update: {
          ai_reply?: string | null
          created_at?: string
          id?: string
          mood?: string
          note?: string | null
          reflection_date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_premium: boolean | null
          mentor_id: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          video_url: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          mentor_id?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          video_url: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          mentor_id?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_assets: {
        Row: {
          asset_url: string
          created_at: string | null
          id: string
          is_premium: boolean | null
          primary_topic: string | null
          role: string
          topics: string[] | null
        }
        Insert: {
          asset_url: string
          created_at?: string | null
          id?: string
          is_premium?: boolean | null
          primary_topic?: string | null
          role: string
          topics?: string[] | null
        }
        Update: {
          asset_url?: string
          created_at?: string | null
          id?: string
          is_premium?: boolean | null
          primary_topic?: string | null
          role?: string
          topics?: string[] | null
        }
        Relationships: []
      }
      visual_mentors: {
        Row: {
          created_at: string | null
          id: string
          mentor_id: string | null
          visual_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          visual_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          visual_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visual_mentors_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visual_mentors_visual_id_fkey"
            columns: ["visual_id"]
            isOneToOne: false
            referencedRelation: "visual_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_recaps: {
        Row: {
          created_at: string
          gratitude_themes: string[] | null
          id: string
          mentor_insight: string | null
          mentor_story: string | null
          mood_data: Json | null
          stats: Json | null
          user_id: string
          viewed_at: string | null
          week_end_date: string
          week_start_date: string
          win_highlights: string[] | null
        }
        Insert: {
          created_at?: string
          gratitude_themes?: string[] | null
          id?: string
          mentor_insight?: string | null
          mentor_story?: string | null
          mood_data?: Json | null
          stats?: Json | null
          user_id: string
          viewed_at?: string | null
          week_end_date: string
          week_start_date: string
          win_highlights?: string[] | null
        }
        Update: {
          created_at?: string
          gratitude_themes?: string[] | null
          id?: string
          mentor_insight?: string | null
          mentor_story?: string | null
          mood_data?: Json | null
          stats?: Json | null
          user_id?: string
          viewed_at?: string | null
          week_end_date?: string
          week_start_date?: string
          win_highlights?: string[] | null
        }
        Relationships: []
      }
      written_content: {
        Row: {
          created_at: string | null
          id: string
          is_premium: boolean | null
          mode: string
          primary_topic: string | null
          text_content: string
          topics: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_premium?: boolean | null
          mode: string
          primary_topic?: string | null
          text_content: string
          topics?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_premium?: boolean | null
          mode?: string
          primary_topic?: string | null
          text_content?: string
          topics?: string[] | null
        }
        Relationships: []
      }
      written_mentors: {
        Row: {
          created_at: string | null
          id: string
          mentor_id: string | null
          written_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          written_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mentor_id?: string | null
          written_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "written_mentors_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "written_mentors_written_id_fkey"
            columns: ["written_id"]
            isOneToOne: false
            referencedRelation: "written_content"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          companion_id: string
          created_at: string
          event_metadata: Json | null
          event_type: string
          id: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          companion_id: string
          created_at?: string
          event_metadata?: Json | null
          event_type: string
          id?: string
          user_id: string
          xp_earned: number
        }
        Update: {
          companion_id?: string
          created_at?: string
          event_metadata?: Json | null
          event_type?: string
          id?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "user_companion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zodiac_sign_content: {
        Row: {
          challenges: string[]
          compatible_signs: string[]
          created_at: string | null
          daily_practice: string
          id: string
          in_relationships: string
          in_wellness: string
          in_work: string
          overview: string
          placement: string
          sign: string
          strengths: string[]
          tagline: string
          title: string
        }
        Insert: {
          challenges?: string[]
          compatible_signs?: string[]
          created_at?: string | null
          daily_practice: string
          id?: string
          in_relationships: string
          in_wellness: string
          in_work: string
          overview: string
          placement: string
          sign: string
          strengths?: string[]
          tagline: string
          title: string
        }
        Update: {
          challenges?: string[]
          compatible_signs?: string[]
          created_at?: string | null
          daily_practice?: string
          id?: string
          in_relationships?: string
          in_wellness?: string
          in_work?: string
          overview?: string
          placement?: string
          sign?: string
          strengths?: string[]
          tagline?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      rhythm_tracks_with_scores: {
        Row: {
          audio_url: string | null
          bpm: number | null
          created_at: string | null
          difficulty_tier: string | null
          downvotes: number | null
          duration_seconds: number | null
          genre: string | null
          id: string | null
          is_active: boolean | null
          play_count: number | null
          prompt: string | null
          score: number | null
          storage_path: string | null
          upvotes: number | null
        }
        Relationships: []
      }
      user_achievement_stats: {
        Row: {
          bronze_count: number | null
          gold_count: number | null
          platinum_count: number | null
          silver_count: number | null
          total_achievements: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_referral_code_secure: {
        Args: { p_referral_code: string; p_user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      cleanup_old_influencer_logs: { Args: never; Returns: undefined }
      count_user_epics: { Args: { p_user_id: string }; Returns: number }
      create_companion_if_not_exists: {
        Args: {
          p_core_element: string
          p_current_image_url: string
          p_eye_color: string
          p_favorite_color: string
          p_fur_color: string
          p_initial_image_url: string
          p_spirit_animal: string
          p_story_tone: string
          p_user_id: string
        }
        Returns: {
          body: number
          core_element: string
          created_at: string
          current_image_url: string
          current_mood: string
          current_stage: number
          current_xp: number
          eye_color: string
          favorite_color: string
          fur_color: string
          id: string
          initial_image_url: string
          is_new: boolean
          last_energy_update: string
          last_mood_update: string
          mind: number
          soul: number
          spirit_animal: string
          story_tone: string
          updated_at: string
          user_id: string
        }[]
      }
      delete_user_account: { Args: { p_user_id: string }; Returns: undefined }
      find_community_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: {
          avatar_url: string
          description: string
          id: string
          is_public: boolean
          name: string
          theme_color: string
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      get_commission_rate: {
        Args: { p_plan: string; p_referral_code_id: string }
        Returns: number
      }
      get_next_evolution_threshold: {
        Args: { current_stage: number }
        Returns: number
      }
      get_user_display_info: {
        Args: { p_user_ids: string[] }
        Returns: {
          display_name: string
          faction: string
          user_id: string
        }[]
      }
      get_user_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_community_admin: {
        Args: { p_community_id: string; p_user_id: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { p_community_id: string; p_user_id: string }
        Returns: boolean
      }
      is_community_member_safe: {
        Args: { p_community_id: string; p_user_id: string }
        Returns: boolean
      }
      is_community_public: {
        Args: { p_community_id: string }
        Returns: boolean
      }
      is_service_role: { Args: never; Returns: boolean }
      join_community_by_id: { Args: { p_community_id: string }; Returns: Json }
      should_evolve: {
        Args: { current_stage: number; current_xp: number }
        Returns: boolean
      }
      validate_referral_code_public: {
        Args: { p_code: string }
        Returns: {
          code: string
          is_valid: boolean
          owner_type: string
        }[]
      }
      validate_referral_code_secure: {
        Args: { p_code: string }
        Returns: {
          code_id: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
