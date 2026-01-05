import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitConfig {
  maxCalls: number;
  windowHours: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Rate limiter for AI endpoint calls
 * Tracks usage in ai_output_validation_log table
 */
export async function checkRateLimit(
  supabase: any,
  userId: string,
  functionName: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - config.windowHours);

  const resetAt = new Date();
  resetAt.setHours(resetAt.getHours() + config.windowHours);

  try {
    // Count recent calls from this user for this function
    const { count, error } = await supabase
      .from('ai_output_validation_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('template_key', functionName)
      .gte('created_at', windowStart.toISOString());

    if (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow request if we can't check
      return {
        allowed: true,
        remaining: config.maxCalls,
        resetAt
      };
    }

    const callCount = count || 0;
    const remaining = Math.max(0, config.maxCalls - callCount);

    return {
      allowed: callCount < config.maxCalls,
      remaining,
      resetAt
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if we can't check
    return {
      allowed: true,
      remaining: config.maxCalls,
      resetAt
    };
  }
}

/**
 * Standard rate limits for different AI operations
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Expensive operations
  'companion-evolution': { maxCalls: 5, windowHours: 24 },
  'companion-image': { maxCalls: 10, windowHours: 24 },
  'evolution-card': { maxCalls: 10, windowHours: 24 },
  
  // Medium cost operations
  'pep-talk-generation': { maxCalls: 20, windowHours: 24 },
  'mentor-audio': { maxCalls: 15, windowHours: 24 },
  'evolution-voice': { maxCalls: 15, windowHours: 24 },
  
  // AI orchestrator and general AI operations
  'ai-orchestrator': { maxCalls: 100, windowHours: 24 },
  'generate-quotes': { maxCalls: 20, windowHours: 24 },
  'generate-lesson': { maxCalls: 10, windowHours: 24 },
  
  // Light operations
  'daily-missions': { maxCalls: 10, windowHours: 24 },
  'check-in-response': { maxCalls: 20, windowHours: 24 },
  'mentor-chat': { maxCalls: 50, windowHours: 24 },
  'activity-comment': { maxCalls: 30, windowHours: 24 },
};

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `You've reached the limit for this action. Please try again later.`,
      remaining: result.remaining,
      resetAt: result.resetAt.toISOString(),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': '3600', // 1 hour
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': result.resetAt.toISOString(),
      }
    }
  );
}
