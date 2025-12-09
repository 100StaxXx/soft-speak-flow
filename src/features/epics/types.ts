/**
 * Epics feature types
 */

export interface Epic {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  target_days: number;
  start_date: string;
  end_date: string | null;
  completed_at: string | null;
  progress_percentage: number | null;
  xp_reward: number;
  theme_color: string | null;
  is_public: boolean | null;
  invite_code: string | null;
  discord_channel_id: string | null;
  discord_invite_url: string | null;
  discord_ready: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EpicTemplate {
  id: string;
  name: string;
  description: string;
  difficulty_tier: string;
  target_days: number;
  theme_color: string;
  habits: any;
  badge_icon: string | null;
  badge_name: string | null;
  is_featured: boolean | null;
  popularity_count: number | null;
  created_at: string | null;
}
