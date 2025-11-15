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
      challenges: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          duration_days: number
          id: string
          mentor_id: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          duration_days: number
          id?: string
          mentor_id?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          duration_days?: number
          id?: string
          mentor_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          is_featured: boolean
          is_premium: boolean | null
          mentor_id: string | null
          quote: string
          tags: string[] | null
          title: string
        }
        Insert: {
          audio_url: string
          category: string
          created_at?: string
          description: string
          id?: string
          is_featured?: boolean
          is_premium?: boolean | null
          mentor_id?: string | null
          quote: string
          tags?: string[] | null
          title: string
        }
        Update: {
          audio_url?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_featured?: boolean
          is_premium?: boolean | null
          mentor_id?: string | null
          quote?: string
          tags?: string[] | null
          title?: string
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
          email: string | null
          id: string
          is_premium: boolean | null
          preferences: Json | null
          selected_mentor_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          is_premium?: boolean | null
          preferences?: Json | null
          selected_mentor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_premium?: boolean | null
          preferences?: Json | null
          selected_mentor_id?: string | null
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
          id: string
          is_premium: boolean | null
          mentor_id: string | null
          tags: string[] | null
          text: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_premium?: boolean | null
          mentor_id?: string | null
          tags?: string[] | null
          text: string
        }
        Update: {
          author?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
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
          completed: boolean | null
          created_at: string | null
          end_date: string
          id: string
          is_active: boolean | null
          start_date: string
          user_id: string
        }
        Insert: {
          challenge_id?: string | null
          completed?: boolean | null
          created_at?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          start_date?: string
          user_id: string
        }
        Update: {
          challenge_id?: string | null
          completed?: boolean | null
          created_at?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          start_date?: string
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
