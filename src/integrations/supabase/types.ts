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
      epics: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
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
          birthdate: string | null
          created_at: string | null
          current_habit_streak: number | null
          daily_push_enabled: boolean | null
          daily_push_time: string | null
          daily_push_window: string | null
          daily_quote_push_enabled: boolean | null
          daily_quote_push_time: string | null
          daily_quote_push_window: string | null
          email: string | null
          id: string
          is_premium: boolean | null
          longest_habit_streak: number | null
          onboarding_completed: boolean | null
          onboarding_data: Json | null
          onboarding_step: string | null
          preferences: Json | null
          selected_mentor_id: string | null
          timezone: string | null
          updated_at: string | null
          zodiac_sign: string | null
        }
        Insert: {
          birthdate?: string | null
          created_at?: string | null
          current_habit_streak?: number | null
          daily_push_enabled?: boolean | null
          daily_push_time?: string | null
          daily_push_window?: string | null
          daily_quote_push_enabled?: boolean | null
          daily_quote_push_time?: string | null
          daily_quote_push_window?: string | null
          email?: string | null
          id: string
          is_premium?: boolean | null
          longest_habit_streak?: number | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          onboarding_step?: string | null
          preferences?: Json | null
          selected_mentor_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          birthdate?: string | null
          created_at?: string | null
          current_habit_streak?: number | null
          daily_push_enabled?: boolean | null
          daily_push_time?: string | null
          daily_push_window?: string | null
          daily_quote_push_enabled?: boolean | null
          daily_quote_push_time?: string | null
          daily_quote_push_window?: string | null
          email?: string | null
          id?: string
          is_premium?: boolean | null
          longest_habit_streak?: number | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          onboarding_step?: string | null
          preferences?: Json | null
          selected_mentor_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          zodiac_sign?: string | null
        }
        Relationships: [
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
          initial_image_url: string | null
          last_energy_update: string | null
          last_mood_update: string | null
          mind: number | null
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
          initial_image_url?: string | null
          last_energy_update?: string | null
          last_mood_update?: string | null
          mind?: number | null
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
          initial_image_url?: string | null
          last_energy_update?: string | null
          last_mood_update?: string | null
          mind?: number | null
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
          core_element: string
          created_at: string
          current_image_url: string
          current_stage: number
          current_xp: number
          eye_color: string
          favorite_color: string
          fur_color: string
          id: string
          initial_image_url: string
          is_new: boolean
          spirit_animal: string
          story_tone: string
          updated_at: string
          user_id: string
        }[]
      }
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
