import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireRequestAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UserAction = "accepted" | "modified" | "rejected";
type PreferenceWeights = Record<string, Record<string, number>>;
type JsonRecord = Record<string, unknown>;

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumberRecord(value: unknown): Record<string, number> {
  const source = asObject(value);
  return Object.entries(source).reduce<Record<string, number>>((acc, [key, rawValue]) => {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      acc[key] = rawValue;
    }
    return acc;
  }, {});
}

function asPreferenceWeights(value: unknown): PreferenceWeights {
  const source = asObject(value);
  return {
    story_type: asNumberRecord(source.story_type),
    theme_color: asNumberRecord(source.theme_color),
    categories: asNumberRecord(source.categories),
  };
}

async function getLearningProfile(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_ai_learning")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function updateLearningFromAction(
  supabase: any,
  userId: string,
  action: UserAction,
) {
  const learning = await getLearningProfile(supabase, userId);
  const currentCount = Number(learning?.interaction_count ?? 0);
  const currentAcceptanceRate = Number(learning?.acceptance_rate ?? 0);
  const currentModificationRate = Number(learning?.modification_rate ?? 0);
  const nextCount = currentCount + 1;

  const nextAcceptanceRate = action === "accepted"
    ? ((currentAcceptanceRate * currentCount) + 100) / nextCount
    : (currentAcceptanceRate * currentCount) / nextCount;
  const nextModificationRate = action === "modified"
    ? ((currentModificationRate * currentCount) + 100) / nextCount
    : (currentModificationRate * currentCount) / nextCount;

  await supabase
    .from("user_ai_learning")
    .upsert({
      user_id: userId,
      interaction_count: nextCount,
      acceptance_rate: Math.round(nextAcceptanceRate * 100) / 100,
      modification_rate: Math.round(nextModificationRate * 100) / 100,
      last_interaction_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });
}

async function updatePreferenceWeights(
  supabase: any,
  userId: string,
  payload: JsonRecord,
) {
  const learning = await getLearningProfile(supabase, userId);
  const currentWeights = asPreferenceWeights(learning?.preference_weights);
  const successfulPatterns = asNumberRecord(learning?.successful_patterns);
  const failedPatterns = asNumberRecord(learning?.failed_patterns);
  const commonContexts = asStringArray(learning?.common_contexts);

  const storyType = typeof payload.storyType === "string" ? payload.storyType : undefined;
  const themeColor = typeof payload.themeColor === "string" ? payload.themeColor : undefined;
  const category = typeof payload.category === "string" ? payload.category : undefined;
  const epicDuration = typeof payload.epicDuration === "number" ? payload.epicDuration : undefined;
  const habitDifficulty = typeof payload.habitDifficulty === "string" ? payload.habitDifficulty : undefined;
  const habitFrequency = typeof payload.habitFrequency === "string" ? payload.habitFrequency : undefined;
  const wasSuccessful = payload.wasSuccessful === true;

  const weightDelta = wasSuccessful ? 1 : -0.5;

  if (storyType) {
    currentWeights.story_type[storyType] = (currentWeights.story_type[storyType] || 0) + weightDelta;
  }

  if (themeColor) {
    currentWeights.theme_color[themeColor] = (currentWeights.theme_color[themeColor] || 0) + weightDelta;
  }

  if (category && !commonContexts.includes(category)) {
    commonContexts.push(category);
  }

  const patternKey = `${storyType || "none"}_${epicDuration || 30}_${habitDifficulty || "medium"}`;
  if (wasSuccessful) {
    successfulPatterns[patternKey] = (successfulPatterns[patternKey] || 0) + 1;
  } else {
    failedPatterns[patternKey] = (failedPatterns[patternKey] || 0) + 1;
  }

  const updates: JsonRecord = {
    user_id: userId,
    preference_weights: currentWeights,
    successful_patterns: successfulPatterns,
    failed_patterns: failedPatterns,
    common_contexts: commonContexts.slice(-20),
    updated_at: new Date().toISOString(),
  };

  if (wasSuccessful) {
    if (epicDuration) updates.preferred_epic_duration = epicDuration;
    if (habitDifficulty) updates.preferred_habit_difficulty = habitDifficulty;
    if (habitFrequency) updates.preferred_habit_frequency = habitFrequency;
  }

  await supabase
    .from("user_ai_learning")
    .upsert(updates, { onConflict: "user_id" });
}

async function trackDailyPlanOutcome(
  supabase: any,
  userId: string,
  payload: JsonRecord,
) {
  const learning = await getLearningProfile(supabase, userId);
  const successfulPatterns = asNumberRecord(learning?.successful_patterns);
  const failedPatterns = asNumberRecord(learning?.failed_patterns);
  const energyByHour = asNumberRecord(learning?.energy_by_hour);
  const dayPatterns = asNumberRecord(learning?.day_of_week_patterns);

  const outcome = typeof payload.outcome === "string" ? payload.outcome : "skipped";
  const metadata = asObject(payload.metadata);
  const isSuccess = outcome === "completed";
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  const actualCompletionTime = typeof metadata.actualCompletionTime === "string" ? metadata.actualCompletionTime : null;
  const scheduledTime = typeof metadata.scheduledTime === "string" ? metadata.scheduledTime : null;
  const category = typeof metadata.category === "string" ? metadata.category : null;
  const difficulty = typeof metadata.difficulty === "string" ? metadata.difficulty : null;

  if (actualCompletionTime && isSuccess) {
    const hour = actualCompletionTime.split(":")[0];
    energyByHour[hour] = (energyByHour[hour] || 50) + 5;
  } else if (scheduledTime && !isSuccess) {
    const hour = scheduledTime.split(":")[0];
    energyByHour[hour] = Math.max(0, (energyByHour[hour] || 50) - 5);
  }

  const currentDayTotal = (dayPatterns[`${dayOfWeek}_total`] || 0) + 1;
  const currentDaySuccess = (dayPatterns[`${dayOfWeek}_success`] || 0) + (isSuccess ? 1 : 0);
  dayPatterns[`${dayOfWeek}_total`] = currentDayTotal;
  dayPatterns[`${dayOfWeek}_success`] = currentDaySuccess;
  dayPatterns[dayOfWeek] = Math.round((currentDaySuccess / currentDayTotal) * 100);

  if (category) {
    const categoryKey = `category_${category}`;
    if (isSuccess) {
      successfulPatterns[categoryKey] = (successfulPatterns[categoryKey] || 0) + 1;
    } else {
      failedPatterns[categoryKey] = (failedPatterns[categoryKey] || 0) + 1;
    }
  }

  if (difficulty) {
    const difficultyKey = `difficulty_${difficulty}`;
    if (isSuccess) {
      successfulPatterns[difficultyKey] = (successfulPatterns[difficultyKey] || 0) + 1;
    } else {
      failedPatterns[difficultyKey] = (failedPatterns[difficultyKey] || 0) + 1;
    }
  }

  await supabase
    .from("user_ai_learning")
    .upsert({
      user_id: userId,
      successful_patterns: successfulPatterns,
      failed_patterns: failedPatterns,
      energy_by_hour: energyByHour,
      day_of_week_patterns: dayPatterns,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const requestAuth = await requireRequestAuth(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    const rawBody = await req.json().catch(() => ({}));
    const body = asObject(rawBody);
    const action = typeof body.action === "string" ? body.action : "";

    switch (action) {
      case "track_interaction": {
        const interactionType = typeof body.interactionType === "string" ? body.interactionType : "";
        const userAction = body.userAction;

        if (!interactionType || (userAction !== "accepted" && userAction !== "modified" && userAction !== "rejected")) {
          return new Response(JSON.stringify({ error: "Invalid interaction payload" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("ai_interactions")
          .insert({
            user_id: requestAuth.userId,
            interaction_type: interactionType,
            input_text: typeof body.inputText === "string" ? body.inputText : null,
            detected_intent: typeof body.detectedIntent === "string" ? body.detectedIntent : null,
            ai_response: body.aiResponse ?? null,
            user_action: userAction,
            modifications: body.modifications ?? null,
          });

        await updateLearningFromAction(supabase, requestAuth.userId, userAction);
        break;
      }

      case "update_preferences":
        await updatePreferenceWeights(supabase, requestAuth.userId, body);
        break;

      case "track_daily_plan_outcome":
        await trackDailyPlanOutcome(supabase, requestAuth.userId, body);
        break;

      default:
        return new Response(JSON.stringify({ error: "Unsupported action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("record-ai-interaction error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
