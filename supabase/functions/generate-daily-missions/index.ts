import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MissionTemplate {
  type: string;
  text: string;
  xp: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  autoComplete: boolean;
  progressTarget?: number;
  chainMissions?: string[];
}

const MISSION_TEMPLATES: MissionTemplate[] = [
  // Habits
  { type: "habit_complete_1", text: "Complete 1 habit today", xp: 5, difficulty: 'easy', category: 'habits', autoComplete: true, progressTarget: 1 },
  { type: "habit_complete_3", text: "Complete 3 habits today", xp: 15, difficulty: 'medium', category: 'habits', autoComplete: true, progressTarget: 3, chainMissions: ['bonus_habit_streak'] },
  { type: "habit_complete_5", text: "Complete 5 habits today", xp: 25, difficulty: 'hard', category: 'habits', autoComplete: true, progressTarget: 5 },
  { type: "all_habits", text: "Complete all your habits", xp: 30, difficulty: 'hard', category: 'habits', autoComplete: true, chainMissions: ['bonus_perfect_day'] },
  { type: "habit_early_bird", text: "Complete a habit before 9 AM", xp: 10, difficulty: 'medium', category: 'habits', autoComplete: true },
  { type: "habit_night_owl", text: "Complete a habit after 8 PM", xp: 10, difficulty: 'medium', category: 'habits', autoComplete: true },
  
  // Wellness
  { type: "check_in_morning", text: "Complete your morning check-in", xp: 8, difficulty: 'easy', category: 'wellness', autoComplete: true },
  { type: "mood_log", text: "Log your mood 3 times today", xp: 12, difficulty: 'medium', category: 'wellness', autoComplete: true, progressTarget: 3 },
  { type: "reflection_write", text: "Write a reflection note", xp: 10, difficulty: 'easy', category: 'wellness', autoComplete: true },
  { type: "reflection_detailed", text: "Write a detailed reflection (100+ words)", xp: 20, difficulty: 'hard', category: 'wellness', autoComplete: true },
  
  // Learning
  { type: "pep_talk_listen", text: "Listen to today's pep talk", xp: 8, difficulty: 'easy', category: 'learning', autoComplete: true },
  { type: "pep_talk_full", text: "Listen to full pep talk (100%)", xp: 15, difficulty: 'medium', category: 'learning', autoComplete: true },
  { type: "mentor_chat_start", text: "Start a conversation with your mentor", xp: 10, difficulty: 'easy', category: 'learning', autoComplete: true },
  { type: "mentor_chat_deep", text: "Have an extended chat (5+ messages)", xp: 25, difficulty: 'hard', category: 'learning', autoComplete: true, progressTarget: 5 },
  { type: "library_explore", text: "Browse the library", xp: 5, difficulty: 'easy', category: 'learning', autoComplete: true },
  
  // Social
  { type: "quote_favorite", text: "Save a quote to favorites", xp: 5, difficulty: 'easy', category: 'social', autoComplete: true },
  { type: "quote_share", text: "Share an inspiring quote", xp: 10, difficulty: 'medium', category: 'social', autoComplete: true },
  { type: "pep_talk_share", text: "Share a pep talk", xp: 12, difficulty: 'medium', category: 'social', autoComplete: true },
  
  // Growth
  { type: "companion_visit", text: "Visit your companion", xp: 5, difficulty: 'easy', category: 'growth', autoComplete: true },
  { type: "companion_interact", text: "Interact with companion 3 times", xp: 15, difficulty: 'medium', category: 'growth', autoComplete: true, progressTarget: 3 },
  { type: "challenge_join", text: "Start or continue a challenge", xp: 15, difficulty: 'medium', category: 'growth', autoComplete: true },
  { type: "challenge_complete_day", text: "Complete today's challenge", xp: 20, difficulty: 'hard', category: 'growth', autoComplete: true },
  { type: "streak_maintain", text: "Maintain your habit streak", xp: 10, difficulty: 'medium', category: 'growth', autoComplete: true },
  { type: "profile_update", text: "Update your profile", xp: 5, difficulty: 'easy', category: 'growth', autoComplete: false },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, forceRegenerate = false } = await req.json();
    const today = new Date().toISOString().split('T')[0];

    // Check if missions already exist for today
    const { data: existing } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today);

    if (existing && existing.length > 0 && !forceRegenerate) {
      return new Response(
        JSON.stringify({ missions: existing, generated: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile and history for personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_habit_streak, preferences')
      .eq('id', userId)
      .single();

    const { data: habits } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const habitCount = habits?.length || 0;
    const streak = profile?.current_habit_streak || 0;

    // Smart mission selection based on user data
    let selectedTemplates: MissionTemplate[] = [];
    
    // Always include 1 easy mission
    const easyMissions = MISSION_TEMPLATES.filter(m => m.difficulty === 'easy');
    selectedTemplates.push(easyMissions[Math.floor(Math.random() * easyMissions.length)]);
    
    // Add 1-2 medium missions
    const mediumMissions = MISSION_TEMPLATES.filter(m => m.difficulty === 'medium');
    selectedTemplates.push(mediumMissions[Math.floor(Math.random() * mediumMissions.length)]);
    
    // Personalized 3rd mission
    if (streak >= 7) {
      // High streak users get harder missions
      const hardMissions = MISSION_TEMPLATES.filter(m => m.difficulty === 'hard');
      selectedTemplates.push(hardMissions[Math.floor(Math.random() * hardMissions.length)]);
    } else {
      // New users get another easy/medium
      const mixedMissions = MISSION_TEMPLATES.filter(m => m.difficulty !== 'hard');
      selectedTemplates.push(mixedMissions[Math.floor(Math.random() * mixedMissions.length)]);
    }

    // Adjust habit missions based on actual habit count
    selectedTemplates = selectedTemplates.map(mission => {
      if (mission.type.startsWith('habit_complete_')) {
        const target = mission.progressTarget || 1;
        if (target > habitCount && habitCount > 0) {
          // Adjust to realistic target
          return {
            ...mission,
            text: `Complete ${habitCount} habit${habitCount > 1 ? 's' : ''} today`,
            progressTarget: habitCount,
            xp: habitCount * 5
          };
        }
      }
      return mission;
    });

    // Insert missions
    const missionsToInsert = selectedTemplates.map(m => ({
      user_id: userId,
      mission_type: m.type,
      mission_text: m.text,
      xp_reward: m.xp,
      mission_date: today,
      difficulty: m.difficulty,
      category: m.category,
      auto_complete: m.autoComplete,
      progress_target: m.progressTarget || 1,
      progress_current: 0,
      is_bonus: false,
    }));

    const { data: created, error } = await supabase
      .from('daily_missions')
      .insert(missionsToInsert)
      .select();

    if (error) throw error;

    console.log(`Generated ${created.length} missions for user ${userId}`);

    return new Response(
      JSON.stringify({ missions: created, generated: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating missions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
