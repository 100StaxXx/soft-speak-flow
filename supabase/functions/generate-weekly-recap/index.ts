import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyAbuseProtection, createSafeErrorResponse, getClientIpAddress } from "../_shared/abuseProtection.ts";
import { getMentorNarrativeProfile } from "../_shared/mentorNarrativeProfiles.ts";
import { errorResponse, type RequestAuth, requireRequestAuth } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";

interface GenerateWeeklyRecapDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  applyAbuseProtectionFn?: typeof applyAbuseProtection;
}

const defaultDeps: GenerateWeeklyRecapDeps = {
  authenticate: requireRequestAuth,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseKey);
  },
  fetchImpl: fetch,
  applyAbuseProtectionFn: applyAbuseProtection,
};

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPreviousWeekBoundaries() {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - daysToMonday);

  const weekStart = new Date(currentMonday);
  weekStart.setDate(currentMonday.getDate() - 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    weekStartStr: formatLocalDate(weekStart),
    weekEndStr: formatLocalDate(weekEnd),
  };
}

export function resolveWeeklyRecapScope(
  requestAuth: RequestAuth,
  _requestedUserId?: string | null,
): { userId: string } | { status: number; error: string } {
  if (requestAuth.isServiceRole) {
    return { status: 403, error: "User authentication required" };
  }

  return { userId: requestAuth.userId };
}

export async function handleGenerateWeeklyRecap(
  req: Request,
  deps: GenerateWeeklyRecapDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  let requestId: string = crypto.randomUUID();

  try {
    const requestAuth = await deps.authenticate(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    const body = await req.json().catch(() => ({}));
    const requestedUserId = typeof body?.userId === "string" ? body.userId : null;
    const recapScope = resolveWeeklyRecapScope(requestAuth, requestedUserId);
    if ("status" in recapScope) {
      return errorResponse(recapScope.status, recapScope.error, corsHeaders);
    }

    const userId = recapScope.userId;
    const supabase = deps.createSupabaseClient();
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-weekly-recap",
      featureKey: "ai_planner_text",
      userId,
    });
    const guardedFetch = costGuardrails.wrapFetch(deps.fetchImpl);
    await costGuardrails.enforceAccess({
      capabilities: ["text"],
      providers: ["openai"],
    });
    const { weekStartStr, weekEndStr } = getPreviousWeekBoundaries();

    console.log(`Generating recap for ${userId}: ${weekStartStr} to ${weekEndStr}`);

    const { data: existingRecap, error: existingRecapError } = await supabase
      .from("weekly_recaps")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start_date", weekStartStr)
      .maybeSingle();

    if (existingRecapError) {
      console.error("Failed to fetch existing recap:", existingRecapError);
      return errorResponse(500, "Failed to load recap", corsHeaders);
    }

    if (existingRecap) {
      return new Response(JSON.stringify({ success: true, recap: existingRecap, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof supabase.rpc === "function") {
      const abuseResult = await (deps.applyAbuseProtectionFn ?? applyAbuseProtection)(req, supabase, {
        profileKey: "ai.standard",
        endpointName: "generate-weekly-recap",
        userId,
        requestId,
        ipAddress: getClientIpAddress(req),
      });
      if (abuseResult instanceof Response) {
        return abuseResult;
      }
      requestId = abuseResult.requestId;
    }

    const { data: checkIns } = await supabase
      .from("daily_check_ins")
      .select("check_in_date, mood, intention")
      .eq("user_id", userId)
      .eq("check_in_type", "morning")
      .gte("check_in_date", weekStartStr)
      .lte("check_in_date", weekEndStr);

    const { data: reflections } = await supabase
      .from("evening_reflections")
      .select("reflection_date, mood, wins, additional_reflection, tomorrow_adjustment, gratitude")
      .eq("user_id", userId)
      .gte("reflection_date", weekStartStr)
      .lte("reflection_date", weekEndStr);

    const { data: quests } = await supabase
      .from("daily_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("task_date", weekStartStr)
      .lte("task_date", weekEndStr);

    const { data: habits } = await supabase
      .from("habit_completions")
      .select("id")
      .eq("user_id", userId)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr);

    const morningMoods = (checkIns || []).map((checkIn: any) => ({
      date: checkIn.check_in_date,
      mood: checkIn.mood || "okay",
    }));

    const eveningMoods = (reflections || []).map((reflection: any) => ({
      date: reflection.reflection_date,
      mood: reflection.mood,
    }));

    const allMoods = [...morningMoods, ...eveningMoods].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const moodScore: Record<string, number> = {
      great: 5,
      good: 4,
      okay: 3,
      low: 2,
      rough: 1,
      energized: 5,
      calm: 4,
      anxious: 2,
      grateful: 5,
      motivated: 5,
    };

    let trend: "improving" | "stable" | "declining" = "stable";
    if (allMoods.length >= 4) {
      const firstHalf = allMoods.slice(0, Math.floor(allMoods.length / 2));
      const secondHalf = allMoods.slice(Math.floor(allMoods.length / 2));

      const firstAvg = firstHalf.reduce((sum, mood) => sum + (moodScore[mood.mood] || 3), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, mood) => sum + (moodScore[mood.mood] || 3), 0) / secondHalf.length;

      if (secondAvg - firstAvg > 0.5) {
        trend = "improving";
      } else if (firstAvg - secondAvg > 0.5) {
        trend = "declining";
      }
    }

    const wins = (reflections || [])
      .filter((reflection: any) => reflection.wins)
      .map((reflection: any) => reflection.wins as string);

    const gratitudeText = (reflections || [])
      .filter((reflection: any) => reflection.gratitude)
      .map((reflection: any) => reflection.gratitude as string)
      .join(" ");

    const commonThemes = ["family", "friends", "health", "work", "nature", "rest", "progress", "support", "love", "peace"];
    const gratitudeThemes = commonThemes.filter((theme) => gratitudeText.toLowerCase().includes(theme));

    const stats = {
      checkIns: checkIns?.length || 0,
      reflections: reflections?.length || 0,
      quests: quests?.length || 0,
      habits: habits?.length || 0,
    };

    const totalActivity = stats.checkIns + stats.reflections + stats.quests + stats.habits;
    if (totalActivity === 0) {
      console.log(`Skipping recap for ${userId}: no activity this week`);
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        message: "No activity to recap",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let mentorInsight = null;
    let mentorStory = null;
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (openAIApiKey && (stats.checkIns > 0 || stats.reflections > 0)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("selected_mentor_id")
        .eq("id", userId)
        .single();

      let mentorName = "Your Mentor";
      let narrativeProfile = getMentorNarrativeProfile("eli");

      if (profile?.selected_mentor_id) {
        const { data: mentor } = await supabase
          .from("mentors")
          .select("name, slug, tone_description")
          .eq("id", profile.selected_mentor_id)
          .single();

        if (mentor) {
          mentorName = mentor.name;
          narrativeProfile = getMentorNarrativeProfile(mentor.slug) || narrativeProfile;
        }
      }

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const moodJourneyEntries: string[] = [];
      const moodsByDate = new Map<string, { morning?: string; evening?: string }>();

      morningMoods.forEach((mood: { date: string; mood: string }) => {
        if (!moodsByDate.has(mood.date)) {
          moodsByDate.set(mood.date, {});
        }
        moodsByDate.get(mood.date)!.morning = mood.mood;
      });

      eveningMoods.forEach((mood: { date: string; mood: string }) => {
        if (!moodsByDate.has(mood.date)) {
          moodsByDate.set(mood.date, {});
        }
        moodsByDate.get(mood.date)!.evening = mood.mood;
      });

      const sortedDates = Array.from(moodsByDate.keys()).sort();
      sortedDates.forEach((date) => {
        const dayName = dayNames[new Date(date).getDay()];
        const moods = moodsByDate.get(date)!;
        const parts: string[] = [];
        if (moods.morning) parts.push(`morning: ${moods.morning}`);
        if (moods.evening) parts.push(`evening: ${moods.evening}`);
        if (parts.length > 0) {
          moodJourneyEntries.push(`${dayName}: ${parts.join(" -> ")}`);
        }
      });

      const moodJourneyText = moodJourneyEntries.length > 0
        ? moodJourneyEntries.join("\n")
        : "No mood entries this week";

      const intentions = (checkIns || [])
        .filter((checkIn: any) => checkIn.intention)
        .map((checkIn: any) => checkIn.intention as string);
      const intentionsText = intentions.length > 0 ? intentions.join("; ") : null;

      const fullGratitudeEntries = (reflections || [])
        .filter((reflection: any) => reflection.gratitude)
        .map((reflection: any) => reflection.gratitude as string);
      const gratitudeTextFull = fullGratitudeEntries.length > 0 ? fullGratitudeEntries.join("; ") : null;

      const additionalReflectionEntries = (reflections || [])
        .filter((reflection: any) => reflection.additional_reflection)
        .map((reflection: any) => reflection.additional_reflection as string);
      const additionalReflectionText = additionalReflectionEntries.length > 0
        ? additionalReflectionEntries.join("; ")
        : null;

      const tomorrowAdjustmentEntries = (reflections || [])
        .filter((reflection: any) => reflection.tomorrow_adjustment)
        .map((reflection: any) => reflection.tomorrow_adjustment as string);
      const tomorrowAdjustmentText = tomorrowAdjustmentEntries.length > 0
        ? tomorrowAdjustmentEntries.join("; ")
        : null;

      const allWins = wins.length > 0 ? wins.join("; ") : null;
      const expectedWeeklyEntries = 7;
      const missedCheckIns = Math.max(0, expectedWeeklyEntries - stats.checkIns);
      const missedReflections = Math.max(0, expectedWeeklyEntries - stats.reflections);

      const storyPrompt = `You are ${mentorName}. Write a concise weekly recap that is easy to consume and grounded in behavior.

YOUR VOICE & STYLE:
${narrativeProfile?.narrativeVoice || "Warm and supportive"}

YOUR SPEECH PATTERNS:
${narrativeProfile?.speechPatterns?.map((pattern) => `- ${pattern}`).join("\n") || "- Speaks with warmth and encouragement"}

YOUR WISDOM STYLE:
${narrativeProfile?.wisdomStyle || "Supportive guidance"}

---

WEEK DATA:

Mood flow by day:
${moodJourneyText}
Overall trend: ${trend}

Morning intentions:
${intentionsText || "No intentions logged"}

Wins shared:
${allWins || "No wins logged"}

Other reflections shared:
${additionalReflectionText || "No additional reflections logged"}

Tomorrow adjustments named:
${tomorrowAdjustmentText || "No tomorrow adjustments logged"}

Gratitude shared:
${gratitudeTextFull || "No gratitude logged"}

Stats:
- Check-ins completed: ${stats.checkIns}
- Reflections completed: ${stats.reflections}
- Quests completed: ${stats.quests}
- Habit completions: ${stats.habits}
- Missed morning check-ins: ${missedCheckIns}
- Missed evening reflections: ${missedReflections}

---

WRITING REQUIREMENTS:
- Total length must be 90 to 150 words
- Use 2 to 4 short paragraphs
- Plain text only
- No headings, bullet points, or numbered lists
- Separate paragraphs with a blank line
- Use a blended tone: include both follow-through and gaps in a natural flow
- Keep language direct and concrete; reference real week data
- Mention missed check-ins and missed reflections naturally
- Light warmth is allowed (up to 1-2 mild encouraging lines), but avoid heavy fluff
- Avoid poetic language, metaphors, or dramatic scene setting
- Final sentence should give one clear focus for next week`;

      try {
        const aiResponse = await guardedFetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAIApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are ${mentorName}, a concise mentor. Address the user as "you". Write plain-text recap paragraphs that are readable, behavior-specific, and balanced between encouragement and accountability.`,
              },
              { role: "user", content: storyPrompt },
            ],
            max_tokens: 320,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const generatedRecap = aiData.choices?.[0]?.message?.content?.trim();
          mentorStory = generatedRecap || null;
          mentorInsight = generatedRecap ? generatedRecap.slice(0, 500).trim() : null;
        } else {
          console.error("AI response not ok:", await aiResponse.text());
        }
      } catch (error) {
        console.error("AI generation failed:", error);
      }
    }

    const recapInsert = {
      user_id: userId,
      week_start_date: weekStartStr,
      week_end_date: weekEndStr,
      mood_data: {
        morning: morningMoods,
        evening: eveningMoods,
        trend,
      },
      gratitude_themes: gratitudeThemes,
      win_highlights: wins.slice(0, 5),
      stats,
      mentor_insight: mentorInsight,
      mentor_story: mentorStory,
    };

    const { data: recap, error: insertError } = await supabase
      .from("weekly_recaps")
      .insert(recapInsert)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert recap:", insertError);

      const { data: racedRecap } = await supabase
        .from("weekly_recaps")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start_date", weekStartStr)
        .maybeSingle();

      if (racedRecap) {
        return new Response(JSON.stringify({ success: true, recap: racedRecap, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return errorResponse(500, "Failed to create recap", corsHeaders);
    }

    return new Response(JSON.stringify({ success: true, recap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error in generate-weekly-recap:", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Request could not be processed right now",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateWeeklyRecap(req));
}
