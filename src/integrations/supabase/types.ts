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
          companion_id: string
          created_at: string
          epic_id: string | null
          generated_at: string
          id: string
          image_url: string
          location_description: string
          location_name: string
          milestone_percent: number
          user_id: string
        }
        Insert: {
          caption?: string | null
          companion_id: string
          created_at?: string
          epic_id?: string | null
          generated_at?: string
          id?: string
          image_url: string
          location_description: string
          location_name: string
          milestone_percent: number
          user_id: string
        }
        Update: {
          caption?: string | null
          companion_id?: string
          created_at?: string
          epic_id?: string | null
          generated_at?: string
          id?: string
          image_url?: string
          location_description?: string
          location_name?: string
          milestone_percent?: number
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
          category: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          difficulty: string | null
          estimated_duration: number | null
          id: string
          is_bonus: boolean | null
          is_main_quest: boolean | null
          is_recurring: boolean | null
          parent_template_id: string | null
          recurrence_days: number[] | null
          recurrence_pattern: string | null
          reminder_enabled: boolean | null
          reminder_minutes_before: number | null
          reminder_sent: boolean | null
          scheduled_time: string | null
          task_date: string
          task_text: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          category?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          estimated_duration?: number | null
          id?: string
          is_bonus?: boolean | null
          is_main_quest?: boolean | null
          is_recurring?: boolean | null
          parent_template_id?: string | null
          recurrence_days?: number[] | null
          recurrence_pattern?: string | null
          reminder_enabled?: boolean | null
          reminder_minutes_before?: number | null
          reminder_sent?: boolean | null
          scheduled_time?: string | null
          task_date?: string
          task_text: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          category?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          estimated_duration?: number | null
          id?: string
          is_bonus?: boolean | null
          is_main_quest?: boolean | null
          is_recurring?: boolean | null
          parent_template_id?: string | null
          recurrence_days?: number[] | null
          recurrence_pattern?: string | null
          reminder_enabled?: boolean | null
          reminder_minutes_before?: number | null
          reminder_sent?: boolean | null
          scheduled_time?: string | null
          task_date?: string
          task_text?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
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
          target_days: number
          theme_color: string | null
          title: string
          updated_at: string | null
          user_id: string
          xp_reward: number
        }
        Insert: {
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
          target_days?: number
          theme_color?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          xp_reward?: number
        }
        Update: {
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
          target_days?: number
          theme_color?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          xp_reward?: number
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
      guild_rivalries: {
        Row: {
          created_at: string | null
          epic_id: string
          id: string
          rival_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          epic_id: string
          id?: string
          rival_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          epic_id?: string
          id?: string
          rival_id?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string | null
          epic_id: string
          id: string
          is_read: boolean | null
          message_key: string
          recipient_id: string
          sender_id: string
          shout_type: string
        }
        Insert: {
          created_at?: string | null
          epic_id: string
          id?: string
          is_read?: boolean | null
          message_key: string
          recipient_id: string
          sender_id: string
          shout_type: string
        }
        Update: {
          created_at?: string | null
          epic_id?: string
          id?: string
          is_read?: boolean | null
          message_key?: string
          recipient_id?: string
          sender_id?: string
          shout_type?: string
        }
        Relationships: [
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
          difficulty: string | null
          frequency: string
          id: string
          is_active: boolean | null
          longest_streak: number | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          custom_days?: number[] | null
          difficulty?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          longest_streak?: number | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          custom_days?: number[] | null
          difficulty?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          longest_streak?: number | null
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
          read_at?: string | null
          user_id?: string
          voice_url?: string | null
        }
        Relationships: []
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
      profiles: {
        Row: {
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
          id: string
          is_premium: boolean | null
          last_encounter_quest_count: number | null
          last_streak_freeze_used: string | null
          last_weekly_encounter: string | null
          longest_habit_streak: number | null
          mars_sign: string | null
          mercury_sign: string | null
          moon_sign: string | null
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
          timezone: string | null
          total_quests_completed: number | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          venus_sign: string | null
          zodiac_sign: string | null
        }
        Insert: {
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
          id: string
          is_premium?: boolean | null
          last_encounter_quest_count?: number | null
          last_streak_freeze_used?: string | null
          last_weekly_encounter?: string | null
          longest_habit_streak?: number | null
          mars_sign?: string | null
          mercury_sign?: string | null
          moon_sign?: string | null
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
          timezone?: string | null
          total_quests_completed?: number | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          venus_sign?: string | null
          zodiac_sign?: string | null
        }
        Update: {
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
          id?: string
          is_premium?: boolean | null
          last_encounter_quest_count?: number | null
          last_streak_freeze_used?: string | null
          last_weekly_encounter?: string | null
          longest_habit_streak?: number | null
          mars_sign?: string | null
          mercury_sign?: string | null
          moon_sign?: string | null
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
          total_conversions?: number | null
          total_revenue?: number | null
          total_signups?: number | null
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
          id: string
          paid_at: string | null
          payout_type: string
          paypal_payer_id: string | null
          paypal_transaction_id: string | null
          referee_id: string
          referral_code_id: string | null
          referrer_id: string
          rejected_at: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          apple_transaction_id?: string | null
          approved_at?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          payout_type: string
          paypal_payer_id?: string | null
          paypal_transaction_id?: string | null
          referee_id: string
          referral_code_id?: string | null
          referrer_id: string
          rejected_at?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          apple_transaction_id?: string | null
          approved_at?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          payout_type?: string
          paypal_payer_id?: string | null
          paypal_transaction_id?: string | null
          referee_id?: string
          referral_code_id?: string | null
          referrer_id?: string
          rejected_at?: string | null
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
      shout_push_log: {
        Row: {
          epic_id: string
          id: string
          recipient_id: string
          sender_id: string
          sent_at: string
        }
        Insert: {
          epic_id: string
          id?: string
          recipient_id: string
          sender_id: string
          sent_at?: string
        }
        Update: {
          epic_id?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          sent_at?: string
        }
        Relationships: [
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
      subscriptions: {
        Row: {
          cancel_at: string | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          plan: string
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
          id?: string
          plan: string
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
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      generate_referral_code: { Args: never; Returns: string }
      get_next_evolution_threshold: {
        Args: { current_stage: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_service_role: { Args: never; Returns: boolean }
      should_evolve: {
        Args: { current_stage: number; current_xp: number }
        Returns: boolean
      }
      validate_referral_code: {
        Args: { p_code: string }
        Returns: {
          code: string
          id: string
          is_active: boolean
          owner_type: string
          owner_user_id: string
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
