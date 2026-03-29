import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitConfig {
  maxCalls: number;
  windowHours: number;
}

export interface RateLimitResult {
  allowed: boolean;
  available: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

interface RateLimitLogEntry {
  userId: string;
  templateKey: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  validationPassed?: boolean;
  validationErrors?: unknown;
  modelUsed?: string;
  responseTimeMs?: number | null;
  tokensUsed?: number | null;
}

const RATE_LIMIT_KEY_ALIASES: Record<string, string[]> = {
  "activity-comment": ["activity-comment", "activity_comment"],
  "ai-orchestrator": ["ai-orchestrator", "ai_orchestrator"],
  "adjust-epic-plan": ["adjust-epic-plan", "adjust_epic_plan"],
  "adjust-saved-daily-plan": ["adjust-saved-daily-plan", "adjust_saved_daily_plan"],
  "daily-plan-adjustment": ["daily-plan-adjustment", "adjust-saved-daily-plan", "adjust_saved_daily_plan"],
  "daily-plan-generation": ["daily-plan-generation", "generate-daily-plan", "generate_daily_plan", "generate-smart-daily-plan", "generate_smart_daily_plan"],
  "check-in-response": ["check-in-response", "generate-check-in-response", "check_in_response"],
  "classify-task-intent": ["classify-task-intent", "classify_task_intent"],
  "companion-evolution": ["companion-evolution", "companion_evolution"],
  "companion-image": ["companion-image", "companion_image"],
  "daily-missions": ["daily-missions", "daily_missions"],
  "decompose-task": ["decompose-task", "decompose_task"],
  "detect-promotion-opportunities": ["detect-promotion-opportunities", "detect_promotion_opportunities"],
  "evening-response": ["evening-response", "evening_response", "generate-evening-response"],
  "evolution-card": ["evolution-card", "evolution_card"],
  "evolution-voice": ["evolution-voice", "evolution_voice"],
  "generate-cosmic-postcard": ["generate-cosmic-postcard", "generate_cosmic_postcard"],
  "generate-cosmic-postcard-test": ["generate-cosmic-postcard-test", "generate_cosmic_postcard_test"],
  "generate-daily-plan": ["generate-daily-plan", "generate_daily_plan"],
  "generate-epic-narrative-seed": ["generate-epic-narrative-seed", "generate_epic_narrative_seed"],
  "generate-epic-suggestions": ["generate-epic-suggestions", "generate_epic_suggestions"],
  "generate-journey-path": ["generate-journey-path", "generate_journey_path"],
  "journey-path": ["journey-path", "generate-journey-path", "generate_journey_path"],
  "generate-journey-schedule": ["generate-journey-schedule", "generate_journey_schedule"],
  "generate-morning-briefing": ["generate-morning-briefing", "generate_morning_briefing"],
  "generate-lesson": ["generate-lesson", "generate_lesson"],
  "generate-quotes": ["generate-quotes", "generate_quotes"],
  "generate-reflection-reply": ["generate-reflection-reply", "generate_reflection_reply"],
  "generate-sample-card": ["generate-sample-card", "generate_sample_card"],
  "generate-smart-daily-plan": ["generate-smart-daily-plan", "generate_smart_daily_plan"],
  "generate-weekly-recap": ["generate-weekly-recap", "generate_weekly_recap", "weekly-recap"],
  "mentor-audio": ["mentor-audio", "mentor_audio"],
  "mentor-chat": ["mentor-chat", "mentor_chat"],
  "pep-talk-generation": ["pep-talk-generation", "generate-complete-pep-talk", "complete-pep-talk"],
  "task-intelligence": ["task-intelligence", "decompose-task", "decompose_task", "classify-task-intent", "classify_task_intent"],
  "weekly-insights": ["weekly-insights", "weekly_insights", "generate-weekly-insights"],
};

/**
 * Standard rate limits for different AI operations
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "adjust-epic-plan": { maxCalls: 20, windowHours: 24 },
  "adjust-saved-daily-plan": { maxCalls: 20, windowHours: 24 },
  "daily-plan-adjustment": { maxCalls: 15, windowHours: 24 },
  "daily-plan-generation": { maxCalls: 10, windowHours: 24 },
  // Expensive operations
  "companion-evolution": { maxCalls: 5, windowHours: 24 },
  "companion-image": { maxCalls: 10, windowHours: 24 },
  "generate-cosmic-postcard": { maxCalls: 10, windowHours: 24 },
  "generate-cosmic-postcard-test": { maxCalls: 10, windowHours: 24 },
  "generate-journey-path": { maxCalls: 10, windowHours: 24 },
  "journey-path": { maxCalls: 5, windowHours: 24 },
  "generate-sample-card": { maxCalls: 10, windowHours: 24 },
  "evolution-card": { maxCalls: 10, windowHours: 24 },

  // Medium cost operations
  "classify-task-intent": { maxCalls: 20, windowHours: 24 },
  "decompose-task": { maxCalls: 20, windowHours: 24 },
  "task-intelligence": { maxCalls: 50, windowHours: 24 },
  "detect-promotion-opportunities": { maxCalls: 20, windowHours: 24 },
  "pep-talk-generation": { maxCalls: 20, windowHours: 24 },
  "mentor-audio": { maxCalls: 15, windowHours: 24 },
  "evolution-voice": { maxCalls: 10, windowHours: 24 },
  "weekly-insights": { maxCalls: 10, windowHours: 24 },
  "evening-response": { maxCalls: 20, windowHours: 24 },
  "generate-daily-plan": { maxCalls: 20, windowHours: 24 },
  "generate-epic-narrative-seed": { maxCalls: 20, windowHours: 24 },
  "generate-epic-suggestions": { maxCalls: 20, windowHours: 24 },
  "generate-journey-schedule": { maxCalls: 20, windowHours: 24 },
  "generate-morning-briefing": { maxCalls: 20, windowHours: 24 },
  "generate-reflection-reply": { maxCalls: 20, windowHours: 24 },
  "generate-smart-daily-plan": { maxCalls: 20, windowHours: 24 },
  "generate-weekly-recap": { maxCalls: 3, windowHours: 24 },

  // AI orchestrator and general AI operations
  "ai-orchestrator": { maxCalls: 100, windowHours: 24 },
  "generate-quotes": { maxCalls: 20, windowHours: 24 },
  "generate-lesson": { maxCalls: 10, windowHours: 24 },

  // Light operations
  "daily-missions": { maxCalls: 10, windowHours: 24 },
  "check-in-response": { maxCalls: 20, windowHours: 24 },
  "mentor-chat": { maxCalls: 50, windowHours: 24 },
  "activity-comment": { maxCalls: 20, windowHours: 24 },
};

function createUnavailableRateLimitResult(config: RateLimitConfig, resetAt: Date): RateLimitResult {
  return {
    allowed: false,
    available: false,
    remaining: 0,
    limit: config.maxCalls,
    resetAt,
  };
}

export function canonicalizeRateLimitKey(functionName: string): string {
  const normalized = functionName.trim();
  if (!normalized) return normalized;

  const lowercase = normalized.toLowerCase();
  const sharedBuckets = [
    "daily-plan-adjustment",
    "daily-plan-generation",
    "journey-path",
    "task-intelligence",
  ];

  for (const canonicalKey of sharedBuckets) {
    const aliases = RATE_LIMIT_KEY_ALIASES[canonicalKey] ?? [];
    if (aliases.some((alias) => alias.toLowerCase() === lowercase)) {
      return canonicalKey;
    }
  }

  for (const [canonicalKey, aliases] of Object.entries(RATE_LIMIT_KEY_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === lowercase)) {
      return canonicalKey;
    }
  }

  return lowercase.replace(/_/g, "-");
}

export function getRateLimitMatchKeys(functionName: string): string[] {
  const canonicalKey = canonicalizeRateLimitKey(functionName);
  const aliases = RATE_LIMIT_KEY_ALIASES[canonicalKey] ?? [canonicalKey];
  return Array.from(new Set([canonicalKey, ...aliases]));
}

/**
 * Rate limiter for AI endpoint calls.
 * Tracks usage in ai_rate_limit_log so quota is consumed even for endpoints
 * that do not emit validation rows.
 */
export async function checkRateLimit(
  supabase: SupabaseClient | any,
  userId: string,
  functionName: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - config.windowHours);

  const resetAt = new Date();
  resetAt.setHours(resetAt.getHours() + config.windowHours);

  const matchKeys = getRateLimitMatchKeys(functionName);

  try {
    const { count, error } = await supabase
      .from("ai_rate_limit_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("function_key", matchKeys)
      .gte("created_at", windowStart.toISOString());

    if (error) {
      console.error("Rate limit check error:", error);
      return createUnavailableRateLimitResult(config, resetAt);
    }

    const callCount = count || 0;
    if (callCount >= config.maxCalls) {
      return {
        allowed: false,
        available: true,
        remaining: 0,
        limit: config.maxCalls,
        resetAt,
      };
    }

    const { error: insertError } = await supabase
      .from("ai_rate_limit_log")
      .insert({
        user_id: userId,
        function_key: canonicalizeRateLimitKey(functionName),
      });

    if (insertError) {
      console.error("Rate limit usage log error:", insertError);
      return createUnavailableRateLimitResult(config, resetAt);
    }

    return {
      allowed: true,
      available: true,
      remaining: Math.max(0, config.maxCalls - (callCount + 1)),
      limit: config.maxCalls,
      resetAt,
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return createUnavailableRateLimitResult(config, resetAt);
  }
}

export async function logRateLimitedInvocation(
  supabase: SupabaseClient | any,
  entry: RateLimitLogEntry,
): Promise<void> {
  const canonicalKey = canonicalizeRateLimitKey(entry.templateKey);

  const { error } = await supabase
    .from("ai_output_validation_log")
    .insert({
      user_id: entry.userId,
      template_key: canonicalKey,
      input_data: entry.inputData ?? {},
      output_data: entry.outputData ?? {},
      validation_passed: entry.validationPassed ?? true,
      validation_errors: entry.validationErrors ?? null,
      model_used: entry.modelUsed ?? "unknown",
      response_time_ms: entry.responseTimeMs ?? null,
      tokens_used: entry.tokensUsed ?? null,
    });

  if (error) {
    console.error(`Failed to log AI invocation for ${canonicalKey}:`, error);
  }
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>) {
  if (!result.available) {
    return new Response(
      JSON.stringify({
        error: "Rate limit unavailable",
        message: "Rate limiting is temporarily unavailable. Please try again shortly.",
        limit: result.limit,
        resetAt: result.resetAt.toISOString(),
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60",
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.resetAt.toISOString(),
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: "You've reached the limit for this action. Please try again later.",
      remaining: result.remaining,
      limit: result.limit,
      resetAt: result.resetAt.toISOString(),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": "3600",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": result.resetAt.toISOString(),
      },
    },
  );
}
