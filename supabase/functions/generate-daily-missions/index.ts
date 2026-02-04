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

const CATEGORY_GUIDELINES = `**MISSION CATEGORIES:**

1. **Connection Mission** (Good Human Day)
   Purpose: light positive interaction.
   Approved patterns:
   - "Text someone you appreciate and let them know why."
   - "Send a simple check-in message to a friend or family member."
   - "Give someone a small compliment today."
   - "Express gratitude to someone who helped you recently."
   - "Really listen to someone today without thinking about your response."
   XP: 5-10
   Difficulty: easy

2. **Quick Win Mission** (Momentum Builder)
   Purpose: create an instant sense of progress or order. Should take 1-5 minutes.
   Approved patterns:
   - "Do one tiny task you've been avoiding."
   - "Organize one small area for two minutes."
   - "Take care of something that will take less than five minutes."
   - "Make your bed to start the day with a win."
   - "Throw away or delete one thing you no longer need."
   - "Reply to one message you've been putting off."
   XP: 5-10
   Difficulty: easy or medium

3. **Identity Mission** (Discipline & Future Self)
   Purpose: something that reinforces the person they want to become.
   These can be larger or all-day missions.
   Approved patterns:
   - "Complete all your quests today."
   - "Plan tomorrow before you go to bed."
   - "Schedule something you've been putting off."
   - "Take one action your future self would thank you for."
   - "Act for two minutes as the most disciplined version of yourself."
   XP: 10-15
   Difficulty: medium or hard

4. **Wellness Mission** (Self-Care & Body)
   Purpose: physical and mental well-being check-ins.
   Approved patterns:
   - "Take 3 deep breaths and notice how you feel."
   - "Drink a full glass of water mindfully."
   - "Stretch your body for 60 seconds."
   - "Take a short walk, even just around your space."
   - "Check and correct your posture right now."
   - "Take a 5-minute break from all screens."
   XP: 5-10
   Difficulty: easy

5. **Gratitude Mission** (Appreciation & Reflection)
   Purpose: cultivate appreciation and positive mindset.
   Approved patterns:
   - "Write down one thing you're grateful for today."
   - "Notice one beautiful thing around you right now."
   - "Thank your body for something it does well."
   - "Appreciate one simple pleasure in your day."
   - "Thank your past self for one decision they made."
   XP: 5-10
   Difficulty: easy

6. **Growth Mission** (Learning & Challenge)
   Purpose: expand knowledge and comfort zone.
   Approved patterns:
   - "Learn one new word or fact today."
   - "Try something small outside your comfort zone."
   - "Ask one question you've been curious about."
   - "Read one article or chapter about something new."
   - "Practice a skill you want to improve for 5 minutes."
   XP: 10-15
   Difficulty: medium or hard`;

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
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

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: 'daily_missions',
      userId: userId,
      variables: {
        missionCount: 3,
        userStreak: streak,
        userContext,
        categoryGuidelines: CATEGORY_GUIDELINES,
        requiredCategories: themeDay.categories
      }
    });

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
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
