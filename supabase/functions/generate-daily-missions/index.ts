import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeneratedMission {
  mission: string;
  xp: number;
  category: string;
  difficulty?: string;
}

// Theme days configuration - matches frontend
const THEME_DAYS: Record<number, { name: string; emoji: string; categories: string[] }> = {
  0: { name: "Reset Sunday", emoji: "🌅", categories: ['identity', 'wellness', 'growth'] },
  1: { name: "Momentum Monday", emoji: "🚀", categories: ['quick_win', 'growth', 'identity'] },
  2: { name: "Connection Tuesday", emoji: "💜", categories: ['connection', 'gratitude', 'wellness'] },
  3: { name: "Wellness Wednesday", emoji: "🧘", categories: ['wellness', 'gratitude', 'quick_win'] },
  4: { name: "Gratitude Thursday", emoji: "✨", categories: ['gratitude', 'connection', 'identity'] },
  5: { name: "Future Friday", emoji: "🔮", categories: ['identity', 'growth', 'quick_win'] },
  6: { name: "Soul Saturday", emoji: "🌟", categories: ['wellness', 'gratitude', 'connection'] },
};

// Bonus mission templates based on streak milestones
const BONUS_MISSIONS: Record<string, { text: string; xp: number; category: string; difficulty: string }> = {
  streak_3: { text: "Keep your momentum going - share your progress with someone", xp: 10, category: 'connection', difficulty: 'easy' },
  streak_7: { text: "Streak Master: Reflect on what's helped you stay consistent", xp: 12, category: 'growth', difficulty: 'medium' },
  streak_14: { text: "Two weeks strong! Do something kind for yourself today", xp: 12, category: 'wellness', difficulty: 'easy' },
  streak_30: { text: "30-day legend! Write a note to your future self", xp: 15, category: 'identity', difficulty: 'medium' },
};

const CATEGORY_GUIDELINES = `**MISSION CATEGORIES — Use these as creative direction, NOT templates to copy:**

1. **Connection** — Light positive human interaction. Could be: reaching out, active listening, appreciating someone, small acts of kindness. Think beyond texting — maybe it's making eye contact, learning someone's name, asking a real question. XP: 5-10, Difficulty: easy

2. **Quick Win** — Instant sense of progress in 1-5 minutes. Could be: clearing clutter, replying to something, fixing a tiny annoyance, organizing one shelf, deleting old photos. Get specific — "clean out your wallet" beats "organize something." XP: 5-10, Difficulty: easy/medium

3. **Identity** — Reinforces the person they want to become. Bigger, all-day vibes. Could be: planning ahead, acting as their future self for an hour, making a decision they've been avoiding, writing a personal rule. XP: 10-15, Difficulty: medium/hard

4. **Wellness** — Physical and mental well-being. Could be: breathwork, hydration, posture, stretching, sensory grounding, screen breaks, cold water on face, sunlight exposure. Get creative with body awareness. XP: 5-10, Difficulty: easy

5. **Gratitude** — Appreciation and positive reframing. Could be: thanking someone specific, noticing beauty, writing about a challenge that taught you something, appreciating a body part, savoring a meal. XP: 5-10, Difficulty: easy

6. **Growth** — Learning and comfort-zone expansion. Be SPECIFIC: "Look up why we dream," "Find out what the capital of a random country is," "Learn one word in a language you don't speak," "Watch a 2-min video about how something is made." Never say "learn something new" — always say WHAT to learn. XP: 10-15, Difficulty: medium/hard

**CREATIVE RULES:**
- Each mission MUST feel distinct from the others — vary the verb, the object, and the framing
- Use concrete, specific language (not vague "do something nice")
- Surprise the user — missions should feel like a fresh idea, not a checklist
- Never start two missions with the same word
- Growth missions MUST include a specific topic or question to explore`;

// Category-specific XP and difficulty validation
const CATEGORY_RULES: Record<string, { xpRange: [number, number]; difficulties: string[] }> = {
  connection: { xpRange: [5, 10], difficulties: ['easy'] },
  quick_win: { xpRange: [5, 10], difficulties: ['easy', 'medium'] },
  identity: { xpRange: [10, 15], difficulties: ['medium', 'hard'] },
  wellness: { xpRange: [5, 10], difficulties: ['easy'] },
  gratitude: { xpRange: [5, 10], difficulties: ['easy'] },
  growth: { xpRange: [10, 15], difficulties: ['medium', 'hard'] },
};

// Get the applicable bonus mission based on streak
function getStreakBonus(streak: number): { key: string; mission: typeof BONUS_MISSIONS[string] } | null {
  if (streak >= 30) return { key: 'streak_30', mission: BONUS_MISSIONS.streak_30 };
  if (streak >= 14) return { key: 'streak_14', mission: BONUS_MISSIONS.streak_14 };
  if (streak >= 7) return { key: 'streak_7', mission: BONUS_MISSIONS.streak_7 };
  if (streak >= 3) return { key: 'streak_3', mission: BONUS_MISSIONS.streak_3 };
  return null;
}

// Timezone utility - calculate effective date with 2 AM reset
const RESET_HOUR = 2;

function getEffectiveMissionDate(userTimezone: string): string {
  const now = new Date();
  const tz = userTimezone || 'UTC';
  
  // Get local hour in user's timezone
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      hour12: false, 
      timeZone: tz 
    }).format(now)
  );
  
  // Get the date in user's timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz
  });
  
  // If before reset hour, use previous day's date
  if (localHour < RESET_HOUR) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return dateFormatter.format(yesterday);
  }
  
  return dateFormatter.format(now);
}

function getEffectiveDayOfWeek(userTimezone: string): number {
  const now = new Date();
  const tz = userTimezone || 'UTC';
  
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      hour12: false, 
      timeZone: tz 
    }).format(now)
  );
  
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: tz
  });
  
  let targetDate = now;
  if (localHour < RESET_HOUR) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - 1);
  }
  
  const dayName = dayFormatter.format(targetDate);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  
  return dayMap[dayName] ?? 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authenticate the user first
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use authenticated user's ID - ignore any userId in request body
    const userId = user.id;

    // Service role client for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { forceRegenerate = false } = await req.json().catch(() => ({}));

    // Rate limiting check
    const rateLimit = await checkRateLimit(supabase, userId, 'daily-missions', RATE_LIMITS['daily-missions']);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, corsHeaders);
    }

    // Get user's timezone from profile for 2 AM reset logic
    const { data: profileForTz } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle();

    const userTimezone = profileForTz?.timezone || 'UTC';
    const today = getEffectiveMissionDate(userTimezone);
    const dayOfWeek = getEffectiveDayOfWeek(userTimezone);
    const themeDay = THEME_DAYS[dayOfWeek];
    
    console.log(`User timezone: ${userTimezone}, effective date: ${today}, day: ${dayOfWeek} (${themeDay.name})`);

    // Check if missions already exist for today
    const { data: existing } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today);

    if (existing && existing.length > 0 && !forceRegenerate) {
      return new Response(
        JSON.stringify({ missions: existing, generated: false, theme: themeDay }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_habit_streak')
      .eq('id', userId)
      .maybeSingle();

    const streak = profile?.current_habit_streak || 0;

    // Fetch recent mission history (last 7 days) for deduplication
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const [recentMissionsResult, activeEpicsResult, activeHabitsResult] = await Promise.all([
      supabase
        .from('daily_missions')
        .select('mission_text')
        .eq('user_id', userId)
        .gte('mission_date', sevenDaysAgoStr)
        .neq('mission_date', today),
      supabase
        .from('epics')
        .select('title')
        .eq('user_id', userId)
        .eq('status', 'active'),
      supabase
        .from('habits')
        .select('title')
        .eq('user_id', userId)
        .is('archived_at', null),
    ]);

    const recentMissions = (recentMissionsResult.data || []).map(m => m.mission_text);
    const activeGoals = [
      ...(activeEpicsResult.data || []).map(e => e.title),
      ...(activeHabitsResult.data || []).map(h => h.title),
    ];

    console.log(`Context: ${recentMissions.length} recent missions, ${activeGoals.length} active goals`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log(`Generating AI missions for user ${userId} (streak: ${streak}, theme: ${themeDay.name})`);

    // Build personalized prompt using template system
    const promptBuilder = new PromptBuilder(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let userContext = `Today is ${themeDay.name} ${themeDay.emoji}. Generate one mission from each of these categories: ${themeDay.categories.join(', ')}.`;
    if (streak > 0) {
      userContext += ` The user has a ${streak} day streak - acknowledge their consistency!`;
    } else {
      userContext += ' Make them encouraging to help build momentum.';
    }

    // Build recent history block for dedup
    const recentHistoryBlock = recentMissions.length > 0
      ? `\n\nThe user has seen these missions in the last 7 days — generate COMPLETELY DIFFERENT ones. Do not repeat or closely paraphrase any of these:\n${recentMissions.map(m => `- "${m}"`).join('\n')}`
      : '';

    // Build active goals context
    const activeGoalsBlock = activeGoals.length > 0
      ? `\n\nThe user is currently working on these goals/habits: ${activeGoals.join(', ')}. You may optionally reference one of these to make a mission feel personal — but don't force it.`
      : '';

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: 'daily_missions',
      userId: userId,
      variables: {
        missionCount: 3,
        userStreak: streak,
        userContext: userContext + recentHistoryBlock + activeGoalsBlock,
        categoryGuidelines: CATEGORY_GUIDELINES,
        requiredCategories: themeDay.categories
      }
    });

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`Failed to generate missions with AI: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices[0].message.content;
    
    console.log('AI response:', generatedText);

    // Parse AI response
    let missions: GeneratedMission[];
    try {
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      missions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedText);
      throw new Error('Invalid AI response format');
    }

    // Validate output with category-specific rules
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(missions);

    // Additional category-specific validation
    const categoryErrors: string[] = [];
    for (const mission of missions) {
      const category = mission.category?.toLowerCase();
      const rules = CATEGORY_RULES[category];
      
      if (rules) {
        const [minXp, maxXp] = rules.xpRange;
        if (mission.xp < minXp || mission.xp > maxXp) {
          categoryErrors.push(`${category} mission XP should be ${minXp}-${maxXp}, got ${mission.xp}`);
        }
        if (mission.difficulty && !rules.difficulties.includes(mission.difficulty)) {
          categoryErrors.push(`${category} mission difficulty should be ${rules.difficulties.join('/')}, got ${mission.difficulty}`);
        }
      }
      
      // Check mission text length (max 80 chars)
      if (mission.mission && mission.mission.length > 80) {
        categoryErrors.push(`Mission text too long: ${mission.mission.length} chars (max 80)`);
      }
    }

    // Log validation results
    const responseTime = Date.now() - startTime;
    const allErrors = [...validationResult.errors, ...categoryErrors];
    await supabase
      .from('ai_output_validation_log')
      .insert({
        user_id: userId,
        template_key: 'daily_missions',
        input_data: { streak, userContext, themeDay: themeDay.name },
        output_data: { missions },
        validation_passed: allErrors.length === 0,
        validation_errors: allErrors.length > 0 ? allErrors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    if (allErrors.length > 0) {
      console.warn('Validation warnings (proceeding anyway):', allErrors);
    }

    console.log('Parsed missions:', missions);

    // Determine auto_complete based on category
    const getAutoComplete = (category: string, missionText: string): boolean => {
      const lowerText = missionText.toLowerCase();
      if (lowerText.includes('complete all your quests') || 
          lowerText.includes('complete all your habits') ||
          lowerText.includes('complete all habits')) {
        return true;
      }
      return false;
    };

    // Map to database format - base missions
    const missionsToInsert = missions.map((m) => ({
      user_id: userId,
      mission_date: today,
      mission_text: m.mission,
      mission_type: m.category || 'general',
      category: m.category || 'general',
      xp_reward: m.xp || 10,
      difficulty: m.difficulty || 'medium',
      auto_complete: getAutoComplete(m.category, m.mission),
      completed: false,
      progress_target: 1,
      progress_current: 0,
      is_bonus: false,
    }));

    // Add streak bonus mission if applicable
    const streakBonus = getStreakBonus(streak);
    if (streakBonus) {
      console.log(`Adding streak bonus mission: ${streakBonus.key}`);
      missionsToInsert.push({
        user_id: userId,
        mission_date: today,
        mission_text: streakBonus.mission.text,
        mission_type: `bonus_${streakBonus.key}`,
        category: `bonus_${streakBonus.key}`, // Unique category to avoid conflict with base missions
        xp_reward: streakBonus.mission.xp,
        difficulty: streakBonus.mission.difficulty,
        auto_complete: false,
        completed: false,
        progress_target: 1,
        progress_current: 0,
        is_bonus: true,
      });
    }

    // Delete existing missions if force regenerating
    if (forceRegenerate && existing && existing.length > 0) {
      await supabase
        .from('daily_missions')
        .delete()
        .eq('user_id', userId)
        .eq('mission_date', today);
    }

    // Insert missions - use upsert to handle race conditions
    // Unique constraint is on (user_id, mission_date, category)
    const { error: insertError } = await supabase
      .from('daily_missions')
      .upsert(missionsToInsert, { 
        onConflict: 'user_id,mission_date,category',
        ignoreDuplicates: true 
      });

    if (insertError) {
      console.error('Error inserting missions:', insertError);
      throw insertError;
    }

    // Fetch the actual missions
    const { data: created, error: fetchError } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today);

    if (fetchError) {
      console.error('Error fetching missions:', fetchError);
      throw fetchError;
    }

    console.log(`Generated ${created?.length || 0} missions for user ${userId} (${themeDay.name})`);

    return new Response(
      JSON.stringify({ missions: created, generated: true, theme: themeDay }),
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
