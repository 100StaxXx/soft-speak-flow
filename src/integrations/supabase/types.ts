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
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          difficulty: string | null
          id: string
          task_date: string
          task_text: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          task_date?: string
          task_text: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string
          task_date?: string
          task_text?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
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
        }
        Insert: {
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
        }
        Update: {
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
          current_stage: number
          current_xp: number
          eye_color: string | null
          favorite_color: string
          fur_color: string | null
          id: string
          last_energy_update: string | null
          mind: number | null
          soul: number | null
          spirit_animal: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: number | null
          core_element: string
          created_at?: string
          current_image_url?: string | null
          current_stage?: number
          current_xp?: number
          eye_color?: string | null
          favorite_color: string
          fur_color?: string | null
          id?: string
          last_energy_update?: string | null
          mind?: number | null
          soul?: number | null
          spirit_animal: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: number | null
          core_element?: string
          created_at?: string
          current_image_url?: string | null
          current_stage?: number
          current_xp?: number
          eye_color?: string | null
          favorite_color?: string
          fur_color?: string | null
          id?: string
          last_energy_update?: string | null
          mind?: number | null
          soul?: number | null
          spirit_animal?: string
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
