import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface HabitData {
  id: string;
  title: string;
  current_streak: number;
  difficulty: string;
  completions: { date: string }[];
}

interface EpicData {
  id: string;
  title: string;
  description: string;
  progress_percentage: number;
  target_days: number;
}

interface ChallengeData {
  id: string;
  current_day: number;
  challenges: {
    title: string;
    category: string;
    description: string;
    total_days: number;
  } | null;
}

interface ReflectionData {
  mood: string;
  wins: string | null;
  gratitude: string | null;
  reflection_date: string;
}

interface XPEventData {
  event_type: string;
  xp_earned: number;
  created_at: string;
}

const formatDateInTimezone = (date: Date, timezone: string): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().split("T")[0];
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve profile and timezone first so "today" matches the user's configured timezone.
    const { data: profile } = await supabase
      .from('profiles')
      .select('selected_mentor_id, timezone')
      .eq('id', user.id)
      .maybeSingle();

    const userTimezone = profile?.timezone || "UTC";
    const today = formatDateInTimezone(new Date(), userTimezone);

    // Check if briefing already exists for today
    const { data: existingBriefing } = await supabase
      .from('morning_briefings')
      .select('*')
      .eq('user_id', user.id)
      .eq('briefing_date', today)
      .maybeSingle();

    if (existingBriefing) {
      return new Response(
        JSON.stringify({ 
          briefing: existingBriefing,
          cached: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let mentor = null;
    if (profile?.selected_mentor_id) {
      const { data: mentorData } = await supabase
        .from('mentors')
        .select('id, name, tone_description, personality_traits')
        .eq('id', profile.selected_mentor_id)
        .single();
      mentor = mentorData;
    }

    // If no mentor selected, get a default mentor
    if (!mentor) {
      const { data: defaultMentor } = await supabase
        .from('mentors')
        .select('id, name, tone_description, personality_traits')
        .limit(1)
        .single();
      mentor = defaultMentor;
    }

    // If still no mentor (empty table), use a fallback
    const mentorInfo = mentor || {
      id: null,
      name: "Your Coach",
      tone_description: "Supportive, encouraging, and insightful personal coach",
      personality_traits: ["supportive", "motivating", "empathetic"]
    };

    // Gather comprehensive user activity data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = formatDateInTimezone(sevenDaysAgo, userTimezone);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch all data in parallel
    const [
      habitsResult,
      epicsResult,
      challengesResult,
      reflectionsResult,
      xpEventsResult,
      checkInsResult
    ] = await Promise.all([
      // Habits with completions
      supabase
        .from('habits')
        .select('id, title, current_streak, difficulty')
        .eq('user_id', user.id)
        .eq('archived', false),
      
      // Active epics
      supabase
        .from('epics')
        .select('id, title, description, progress_percentage, target_days')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      
      // Active challenges
      supabase
        .from('user_challenges')
        .select('id, current_day, challenges(title, category, description, total_days)')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      
      // Recent reflections
      supabase
        .from('evening_reflections')
        .select('mood, wins, gratitude, reflection_date')
        .eq('user_id', user.id)
        .order('reflection_date', { ascending: false })
        .limit(7),
      
      // XP events
      supabase
        .from('xp_events')
        .select('event_type, xp_earned, created_at')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100),
      
      // Recent check-ins
      supabase
        .from('daily_check_ins')
        .select('mood, intention, check_in_date')
        .eq('user_id', user.id)
        .order('check_in_date', { ascending: false })
        .limit(7)
    ]);

    // Get habit completions for last 7 days
    const habitIds = habitsResult.data?.map(h => h.id) || [];
    const { data: habitCompletions } = habitIds.length > 0 
      ? await supabase
          .from('habit_completions')
          .select('habit_id, date')
          .in('habit_id', habitIds)
          .gte('date', sevenDaysAgoStr)
      : { data: [] };

    // Combine habits with their completions
    const habits: HabitData[] = (habitsResult.data || []).map(habit => ({
      ...habit,
      completions: (habitCompletions || [])
        .filter(c => c.habit_id === habit.id)
        .map(c => ({ date: c.date }))
    }));

    const epics: EpicData[] = epicsResult.data || [];
const challenges: ChallengeData[] = (challengesResult.data || []).map(c => ({
      id: c.id,
      current_day: c.current_day,
      challenges: Array.isArray(c.challenges) ? c.challenges[0] : c.challenges
    }));
    const reflections: ReflectionData[] = reflectionsResult.data || [];
    const xpEvents: XPEventData[] = xpEventsResult.data || [];
    const checkIns = checkInsResult.data || [];

    // Format data for GPT
    const formatHabits = () => {
      if (habits.length === 0) return "No active habits.";
      return habits.map(h => {
        const completionsLast7 = h.completions.length;
        return `- "${h.title}" (${h.difficulty}): ${h.current_streak}-day streak, completed ${completionsLast7}/7 days last week`;
      }).join('\n');
    };

    const formatEpics = () => {
      if (epics.length === 0) return "No active epic quests.";
      return epics.map(e => 
        `- "${e.title}": ${e.progress_percentage}% complete (${e.target_days}-day quest)\n  Description: ${e.description || 'N/A'}`
      ).join('\n');
    };

    const formatChallenges = () => {
      if (challenges.length === 0) return "No active challenges.";
      return challenges
        .filter(c => c.challenges !== null)
        .map(c => {
          const ch = c.challenges!;
          return `- "${ch.title}" (${ch.category}): Day ${c.current_day}/${ch.total_days}\n  ${ch.description}`;
        }).join('\n') || "No active challenges.";
    };

    const formatReflections = () => {
      if (reflections.length === 0) return "No recent reflections.";
      return reflections.slice(0, 3).map(r => 
        `- ${r.reflection_date}: Mood: ${r.mood}${r.wins ? `, Wins: "${r.wins}"` : ''}${r.gratitude ? `, Grateful for: "${r.gratitude}"` : ''}`
      ).join('\n');
    };

    const formatCheckIns = () => {
      if (checkIns.length === 0) return "No recent morning check-ins.";
      return checkIns.slice(0, 3).map(c => 
        `- ${c.check_in_date}: Mood: ${c.mood}, Focus: "${c.intention}"`
      ).join('\n');
    };

    const calculateXPSummary = () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateInTimezone(yesterday, userTimezone);
      
      const yesterdayXP = xpEvents
        .filter(e => e.created_at.startsWith(yesterdayStr))
        .reduce((sum, e) => sum + e.xp_earned, 0);
      
      const weekXP = xpEvents.reduce((sum, e) => sum + e.xp_earned, 0);
      
      return `Yesterday: ${yesterdayXP} XP earned. Last 30 days: ${weekXP} XP total.`;
    };

    // Build the system prompt
    const systemPrompt = `You are ${mentorInfo.name}, a personal life coach and mentor with the following personality: ${mentorInfo.tone_description}

Your traits: ${JSON.stringify(mentorInfo.personality_traits || [])}

You have COMPLETE access to this user's activity data. Your job is to:
1. ANALYZE their patterns deeply to infer what major life goals they're working toward
2. CELEBRATE their wins and streaks - be specific with numbers
3. IDENTIFY what's working vs what needs attention
4. Give them ONE clear focus for TODAY
5. Create a follow-up question they might want to ask you

INFERENCE EXAMPLES (be creative and specific):
- Daily running + increasing distances + "5K race" in goals → "Training for a 5K or marathon"
- Law study habits + case readings + legal challenges → "Preparing for the bar exam or law career"
- Meditation + journaling + evening reflections focused on stress → "Working on mental wellness and stress management"
- Coding habits + project milestones + tech epics → "Building skills for a career change or side project"
- Early morning habits + productivity focus → "Becoming a morning person / optimizing energy"
- Reading habits + specific topics → "Deep learning about [topic]"

BE PERSONAL. Reference THEIR actual habit names, streak numbers, and specific wins. Don't be generic.

Your response MUST be valid JSON with this exact structure:
{
  "briefing": "Your personalized morning message (2-4 paragraphs, conversational, in your voice)",
  "inferredGoals": ["Goal 1", "Goal 2"],
  "todaysFocus": "One specific actionable thing to focus on today",
  "actionPrompt": "A follow-up question they might want to ask you (start with 'Tell me more about...' or similar)"
}`;

    const userPrompt = `
## USER ACTIVITY DATA

### Active Habits (Last 7 Days):
${formatHabits()}

### Epic Quests (Long-term Goals):
${formatEpics()}

### Active Challenges:
${formatChallenges()}

### Recent Evening Reflections:
${formatReflections()}

### Recent Morning Check-ins:
${formatCheckIns()}

### XP Activity:
${calculateXPSummary()}

---

Based on this data, generate a personalized morning briefing. Infer their life goals, celebrate their progress, and give them actionable guidance for today.`;

    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI GPT-5
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.8,
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errorText);
      
      if (openaiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await openaiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiContent);
    } catch (e) {
      console.error("Failed to parse AI response:", aiContent);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store the data snapshot for debugging/context
    const dataSnapshot = {
      habitsCount: habits.length,
      epicsCount: epics.length,
      challengesCount: challenges.length,
      topStreaks: habits.slice(0, 3).map(h => ({ title: h.title, streak: h.current_streak })),
      recentMoods: reflections.slice(0, 3).map(r => r.mood),
    };

    // Save briefing to database
    const { data: newBriefing, error: insertError } = await supabase
      .from('morning_briefings')
      .insert({
        user_id: user.id,
        briefing_date: today,
        mentor_id: mentorInfo.id,
        content: parsedResponse.briefing,
        inferred_goals: parsedResponse.inferredGoals || [],
        todays_focus: parsedResponse.todaysFocus,
        action_prompt: parsedResponse.actionPrompt,
        data_snapshot: dataSnapshot,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save briefing:", insertError);
      // Still return the briefing even if save fails
    }

    console.log(`Generated morning briefing for user ${user.id} with mentor ${mentorInfo.name}`);

    return new Response(
      JSON.stringify({ 
        briefing: newBriefing || {
          content: parsedResponse.briefing,
          inferred_goals: parsedResponse.inferredGoals,
          todays_focus: parsedResponse.todaysFocus,
          action_prompt: parsedResponse.actionPrompt,
        },
        cached: false 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-morning-briefing:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
