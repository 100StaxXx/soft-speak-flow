import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  formatDateInTimezone,
  getEffectiveDailyDate,
  getLocalDateOffsetInTimezone,
} from "../_shared/effectiveDailyDate.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  CHRISTIAN_GUIDANCE_POLICY,
  enforceChristianGuidanceOutput,
  validateChristianGuidanceOutput,
} from "../_shared/christianGuidancePolicy.ts";
import { resolveUserProductMode } from "../_shared/productBoundary.ts";

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
  additional_reflection: string | null;
  tomorrow_adjustment: string | null;
  gratitude: string | null;
  reflection_date: string;
}

interface XPEventData {
  event_type: string;
  xp_earned: number;
  created_at: string;
}

const toTrimmedStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toStringArray = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value];

  return values
    .map(toTrimmedStringOrNull)
    .filter((item): item is string => item !== null);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "ai.standard",
      endpointName: "generate-morning-briefing",
      allowServiceRole: false,
    });
    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }
    const { auth, supabase, requestId: protectedRequestId } = protectedRequest;
    requestId = protectedRequestId;
    const user = { id: auth.userId };
    const productMode = await resolveUserProductMode(supabase, user.id);
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-morning-briefing",
      featureKey: "ai_morning_briefing",
      userId: user.id,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["text"],
      providers: ["openai"],
    });

    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      return createSafeErrorResponse(req, {
        status: 500,
        code: "AI_NOT_CONFIGURED",
        error: "AI service not configured",
        requestId,
      });
    }

    // Resolve profile and timezone first so "today" matches the user's configured timezone.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('selected_mentor_id, timezone')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load profile for morning briefing:", profileError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "PROFILE_READ_FAILED",
        error: "Failed to load profile",
        requestId,
      });
    }

    const userTimezone = profile?.timezone || "UTC";
    const today = getEffectiveDailyDate(userTimezone);

    // Check if briefing already exists for today
    const { data: existingBriefing, error: existingBriefingError } = await supabase
      .from('morning_briefings')
      .select('*')
      .eq('user_id', user.id)
      .eq('briefing_date', today)
      .maybeSingle();

    if (existingBriefingError) {
      console.error("Failed to check existing morning briefing:", existingBriefingError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "BRIEFING_LOOKUP_FAILED",
        error: "Failed to check existing morning briefing",
        requestId,
      });
    }

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
      const { data: mentorData, error: mentorError } = await supabase
        .from(productMode === "graceward" ? "graceward_guides" : "mentors")
        .select('id, name, tone_description, personality_traits')
        .eq('id', profile.selected_mentor_id)
        .maybeSingle();
      if (mentorError) {
        console.warn("Selected mentor lookup failed; falling back to default mentor:", mentorError);
      }
      mentor = mentorData;
    }

    // If no mentor selected, get a default mentor
    if (!mentor) {
      const { data: defaultMentor, error: defaultMentorError } = await supabase
        .from(productMode === "graceward" ? "graceward_guides" : "mentors")
        .select('id, name, tone_description, personality_traits')
        .limit(1)
        .maybeSingle();
      if (defaultMentorError) {
        console.warn("Default mentor lookup failed; using hardcoded fallback mentor:", defaultMentorError);
      }
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
    const sevenDaysAgoStr = getLocalDateOffsetInTimezone(userTimezone, -7);

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
        .select('mood, wins, additional_reflection, tomorrow_adjustment, gratitude, reflection_date')
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

    [
      { source: "habits", error: habitsResult.error },
      { source: "epics", error: epicsResult.error },
      { source: "challenges", error: challengesResult.error },
      { source: "reflections", error: reflectionsResult.error },
      { source: "xp_events", error: xpEventsResult.error },
      { source: "daily_check_ins", error: checkInsResult.error },
    ].forEach(({ source, error }) => {
      if (error) {
        console.warn(`Morning briefing ${source} query failed:`, error);
      }
    });

    // Get habit completions for last 7 days
    const habitIds = habitsResult.data?.map(h => h.id) || [];
    const { data: habitCompletions, error: habitCompletionsError } = habitIds.length > 0
      ? await supabase
          .from('habit_completions')
          .select('habit_id, date')
          .in('habit_id', habitIds)
          .gte('date', sevenDaysAgoStr)
      : { data: [], error: null };

    if (habitCompletionsError) {
      console.warn("Morning briefing habit_completions query failed:", habitCompletionsError);
    }

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
      return reflections
        .slice(0, 3)
        .map((r) => {
          const parts = [
            `Mood: ${r.mood}`,
            r.wins ? `What went well: "${r.wins}"` : null,
            r.additional_reflection ? `Additional reflection: "${r.additional_reflection}"` : null,
            r.tomorrow_adjustment ? `Tomorrow adjustment: "${r.tomorrow_adjustment}"` : null,
            r.gratitude ? `Gratitude: "${r.gratitude}"` : null,
          ].filter(Boolean) as string[];

          return [`- ${r.reflection_date}`, ...parts.map((part) => `  ${part}`)].join('\n');
        })
        .join('\n');
    };

    const formatCheckIns = () => {
      if (checkIns.length === 0) return "No recent morning check-ins.";
      return checkIns.slice(0, 3).map(c => 
        `- ${c.check_in_date}: Mood: ${c.mood}, Focus: "${c.intention}"`
      ).join('\n');
    };

    const calculateXPSummary = () => {
      const yesterdayStr = getLocalDateOffsetInTimezone(userTimezone, -1);

      const yesterdayXP = xpEvents
        .filter(
          (e) => formatDateInTimezone(new Date(e.created_at), userTimezone) === yesterdayStr,
        )
        .reduce((sum, e) => sum + e.xp_earned, 0);

      const weekXP = xpEvents.reduce((sum, e) => sum + e.xp_earned, 0);

      return `Yesterday: ${yesterdayXP} XP earned. Last 30 days: ${weekXP} XP total.`;
    };

    // Build a product-specific system prompt. Guide copy and faith policy must
    // never cross into Cosmiq's planning experience.
    const productPolicy = productMode === "graceward"
      ? `You are Graceward's AI morning reflection assistant. You are software, not a pastor, human mentor, or spiritual authority.\n\n${CHRISTIAN_GUIDANCE_POLICY}`
      : `You are Cosmiq's clearly identified AI planning and reflection guide. You are software, not a human mentor or professional adviser. Do not introduce Scripture, prayer, theology, or Graceward's faith framing. Do not make medical, mental-health, legal, or financial claims.`;
    const systemPrompt = `${productPolicy}

Communication style: ${mentorInfo.tone_description}

Use only the activity data supplied below. Your job is to:
1. Summarize observable patterns without claiming hidden knowledge or sensitive traits
2. Notice effort, rest, and returns without treating streaks or output as ${productMode === "graceward" ? "spiritual worth" : "personal worth"}
3. Name what appears workable and what may need gentler scope
4. Offer ONE optional, concrete focus for today
5. Create a follow-up reflection question

Any suggested goal must be framed as a possibility grounded in explicit activity names, not as a fact about the user's identity, faith, health, calling, or private motives.

Be specific where helpful, but do not shame missed work or make certainty claims.

Your response MUST be valid JSON with this exact structure:
{
  "briefing": "A grounded morning reflection (2-3 short paragraphs)",
  "inferredGoals": ["Possible goal grounded in explicit activity"],
  "todaysFocus": "One small optional action for today",
  "actionPrompt": "One open reflection question"
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

Based only on this data, generate a grounded morning reflection. Describe possible goals cautiously, notice progress without scoring the person's worth, and offer one humane focus for today.`;

    // Call OpenAI GPT-5
    const openaiResponse = await guardedFetch("https://api.openai.com/v1/chat/completions", {
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
        return createSafeErrorResponse(req, {
          status: 429,
          code: "RATE_LIMIT_EXCEEDED",
          error: "Rate limit exceeded, please try again later.",
          requestId,
        });
      }
      
      return createSafeErrorResponse(req, {
        status: 500,
        code: "AI_PROVIDER_ERROR",
        error: "AI service error",
        requestId,
      });
    }

    const aiData = await openaiResponse.json();
    const aiContent = aiData?.choices?.[0]?.message?.content;

    if (typeof aiContent !== "string" || aiContent.trim().length === 0) {
      console.error("OpenAI returned an empty morning briefing response:", aiData);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "AI_RESPONSE_EMPTY",
        error: "AI service returned an empty response",
        requestId,
      });
    }
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiContent);
    } catch (e) {
      console.error("Failed to parse AI response:", aiContent);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "AI_RESPONSE_PARSE_FAILED",
        error: "Failed to parse AI response",
        requestId,
      });
    }

    if (
      typeof parsedResponse?.briefing !== "string" ||
      parsedResponse.briefing.trim().length === 0
    ) {
      console.error("AI response missing briefing field:", parsedResponse);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "AI_RESPONSE_INVALID_SHAPE",
        error: "AI response did not include a briefing",
        requestId,
      });
    }

    const sanitizedBriefing = productMode === "graceward"
      ? enforceChristianGuidanceOutput(parsedResponse.briefing.trim())
      : parsedResponse.briefing.trim();
    const sanitizedInferredGoals = toStringArray(parsedResponse.inferredGoals)
      .filter((goal) => productMode !== "graceward" || validateChristianGuidanceOutput(goal).safe)
      .slice(0, 3);
    const rawTodaysFocus = toTrimmedStringOrNull(parsedResponse.todaysFocus);
    const sanitizedTodaysFocus = rawTodaysFocus
      ? (productMode === "graceward"
        ? enforceChristianGuidanceOutput(rawTodaysFocus, {
          fallback: "Choose one small action that serves what matters most today.",
        })
        : rawTodaysFocus)
      : null;
    const rawActionPrompt = toTrimmedStringOrNull(parsedResponse.actionPrompt);
    const sanitizedActionPrompt = rawActionPrompt
      ? (productMode === "graceward"
        ? enforceChristianGuidanceOutput(rawActionPrompt, {
          fallback: "What is one small, honest step I can take today?",
        })
        : rawActionPrompt)
      : null;

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
        content: sanitizedBriefing,
        inferred_goals: sanitizedInferredGoals,
        todays_focus: sanitizedTodaysFocus,
        action_prompt: sanitizedActionPrompt,
        data_snapshot: dataSnapshot,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505" || insertError.code === "PGRST409") {
        const { data: existingRow, error: existingRowError } = await supabase
          .from('morning_briefings')
          .select('*')
          .eq('user_id', user.id)
          .eq('briefing_date', today)
          .maybeSingle();

        if (existingRow) {
          return new Response(
            JSON.stringify({
              briefing: existingRow,
              cached: true
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existingRowError) {
          console.error("Failed to recover existing briefing after insert conflict:", existingRowError);
        }
      }

      console.error("Failed to save briefing:", insertError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "BRIEFING_PERSIST_FAILED",
        error: "Failed to save morning briefing",
        requestId,
      });
    }

    if (!newBriefing) {
      console.error("Failed to save briefing: No briefing row returned after insert");
      return createSafeErrorResponse(req, {
        status: 500,
        code: "BRIEFING_PERSIST_FAILED",
        error: "Failed to save morning briefing",
        requestId,
      });
    }

    console.log(`Generated morning briefing for user ${user.id} with mentor ${mentorInfo.name}`);

    return new Response(
      JSON.stringify({ 
        briefing: newBriefing,
        cached: false 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error in generate-morning-briefing:", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Request could not be processed right now",
      requestId,
    });
  }
});
