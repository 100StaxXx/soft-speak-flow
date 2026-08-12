export interface WeeklyRecap {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  mood_data: {
    morning: Array<{ date: string; mood: string }>;
    evening: Array<{ date: string; mood: string }>;
    trend: "improving" | "stable" | "declining";
  };
  gratitude_themes: string[];
  win_highlights: string[];
  stats: {
    checkIns: number;
    reflections: number;
    quests: number;
    habits: number;
  };
  mentor_insight: string | null;
  mentor_story: string | null;
  created_at: string;
  viewed_at: string | null;
}
