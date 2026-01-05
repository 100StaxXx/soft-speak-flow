import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema with strict limits
const OrchestratorRequestSchema = z.object({
  input: z.string()
    .min(1, "Input is required")
    .max(2000, "Input must be less than 2000 characters")
    .transform(s => s.trim()),
  interactionType: z.enum(['classify', 'suggest_epic', 'adjust_plan', 'chat']),
  sessionId: z.string().uuid().optional(),
  additionalContext: z.record(z.unknown()).optional(),
});

interface EnrichedContext {
  activeEpics: Array<{ id: string; title: string; progress: number; daysRemaining: number; habitCount: number; storyType: string | null; themeColor: string | null }>;
  activeHabits: Array<{ id: string; title: string; currentStreak: number; difficulty: string; frequency: string; category: string | null }>;
  pendingQuestsCount: number;
  currentStreaks: { maxHabitStreak: number; dailyTaskStreak: number };
  completionRates: { thisWeek: number; thisMonth: number };
  averageHabitsPerDay: number;
  preferredDifficulty: string;
  preferredEpicDuration: number;
  preferredHabitFrequency: string;
  commonContexts: string[];
  preferenceWeights: Record<string, Record<string, number>>;
  tonePreference: string | null;
  atEpicLimit: boolean;
  overloaded: boolean;
  suggestedWorkload: 'light' | 'normal' | 'heavy';
  recentCompletedEpics: number;
  recentAbandonedEpics: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse and validate input
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = OrchestratorRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error('[ai-orchestrator] Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { input, interactionType, sessionId, additionalContext } = parseResult.data;

    // Check rate limit for AI orchestrator calls
    const rateLimitResult = await checkRateLimit(
      supabase,
      userId,
      'ai-orchestrator',
      RATE_LIMITS['ai-orchestrator'] || { maxCalls: 100, windowHours: 24 }
    );

    if (!rateLimitResult.allowed) {
      console.warn(`[ai-orchestrator] Rate limit exceeded for user ${userId}`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    console.log(`Orchestrator request: type=${interactionType}, input="${input.substring(0, 50)}..."`);

    // Step 1: Enrich context by calling the enrich-user-context function
    let enrichedContext: EnrichedContext | null = null;
    try {
      const contextResponse = await fetch(`${supabaseUrl}/functions/v1/enrich-user-context`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });
      
      if (contextResponse.ok) {
        enrichedContext = await contextResponse.json();
        console.log(`Context enriched: ${enrichedContext?.activeEpics.length} epics, ${enrichedContext?.activeHabits.length} habits`);
      } else {
        console.warn('Failed to enrich context, proceeding without it');
      }
    } catch (e) {
      console.warn('Error enriching context:', e);
    }

    // Step 2: Route to appropriate handler based on interaction type
    let aiResponse: Record<string, unknown> = {};
    let detectedIntent: string | null = null;

    switch (interactionType) {
      case 'classify': {
        // Call classify-task-intent with enriched context
        const classifyResponse = await fetch(`${supabaseUrl}/functions/v1/classify-task-intent`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input,
            userContext: enrichedContext ? {
              activeEpicCount: enrichedContext.activeEpics.length,
              activeHabitCount: enrichedContext.activeHabits.length,
              atEpicLimit: enrichedContext.atEpicLimit,
              overloaded: enrichedContext.overloaded,
              suggestedWorkload: enrichedContext.suggestedWorkload,
              preferredDifficulty: enrichedContext.preferredDifficulty,
              preferredEpicDuration: enrichedContext.preferredEpicDuration,
              commonContexts: enrichedContext.commonContexts,
            } : undefined,
          }),
        });

        if (classifyResponse.ok) {
          aiResponse = await classifyResponse.json();
          detectedIntent = (aiResponse as any).intent || null;
          
          // Add capacity warnings to response
          if (enrichedContext) {
            (aiResponse as any).capacityWarnings = {
              atEpicLimit: enrichedContext.atEpicLimit,
              overloaded: enrichedContext.overloaded,
              suggestedWorkload: enrichedContext.suggestedWorkload,
            };
            
            // If suggesting an epic but at limit, add warning
            if (detectedIntent === 'epic' && enrichedContext.atEpicLimit) {
              (aiResponse as any).warning = 'You already have 2 active epics. Consider completing one before starting another.';
            }
          }
        } else {
          const errorText = await classifyResponse.text();
          throw new Error(`Classification failed: ${errorText}`);
        }
        break;
      }

      case 'suggest_epic': {
        // Call generate-epic-suggestions with preferences
        const suggestResponse = await fetch(`${supabaseUrl}/functions/v1/generate-epic-suggestions`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input,
            userPreferences: enrichedContext ? {
              preferredDuration: enrichedContext.preferredEpicDuration,
              preferredDifficulty: enrichedContext.preferredDifficulty,
              preferredFrequency: enrichedContext.preferredHabitFrequency,
              commonContexts: enrichedContext.commonContexts,
              preferenceWeights: enrichedContext.preferenceWeights,
              suggestedWorkload: enrichedContext.suggestedWorkload,
            } : undefined,
            ...additionalContext,
          }),
        });

        if (suggestResponse.ok) {
          aiResponse = await suggestResponse.json();
          detectedIntent = 'epic';
        } else {
          const errorText = await suggestResponse.text();
          throw new Error(`Epic suggestion failed: ${errorText}`);
        }
        break;
      }

      case 'adjust_plan': {
        // Call adjust-epic-plan
        const adjustResponse = await fetch(`${supabaseUrl}/functions/v1/adjust-epic-plan`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...additionalContext,
            userContext: enrichedContext ? {
              completionRate: enrichedContext.completionRates.thisWeek,
              overloaded: enrichedContext.overloaded,
              suggestedWorkload: enrichedContext.suggestedWorkload,
            } : undefined,
          }),
        });

        if (adjustResponse.ok) {
          aiResponse = await adjustResponse.json();
          detectedIntent = 'adjustment';
        } else {
          const errorText = await adjustResponse.text();
          throw new Error(`Plan adjustment failed: ${errorText}`);
        }
        break;
      }

      case 'chat': {
        // For now, just return enriched context for chat scenarios
        // This can be expanded to call mentor-chat with context
        aiResponse = {
          message: 'Chat routing not yet implemented',
          context: enrichedContext,
        };
        detectedIntent = 'chat';
        break;
      }

      default:
        throw new Error(`Unknown interaction type: ${interactionType}`);
    }

    const responseTime = Date.now() - startTime;

    // Step 3: Log the interaction for learning
    const contextSnapshot = enrichedContext ? {
      activeEpicCount: enrichedContext.activeEpics.length,
      activeHabitCount: enrichedContext.activeHabits.length,
      completionRate: enrichedContext.completionRates.thisWeek,
      atEpicLimit: enrichedContext.atEpicLimit,
      overloaded: enrichedContext.overloaded,
    } : null;

    const { error: logError } = await supabase
      .from('ai_interactions')
      .insert({
        user_id: userId,
        interaction_type: interactionType,
        input_text: input,
        detected_intent: detectedIntent,
        ai_response: aiResponse,
        context_snapshot: contextSnapshot,
        session_id: sessionId || null,
        response_time_ms: responseTime,
      });

    if (logError) {
      console.warn('Failed to log interaction:', logError);
    }

    // Step 4: Update user_ai_learning (increment interaction count)
    // First try to update existing record
    const { data: existingLearning } = await supabase
      .from('user_ai_learning')
      .select('interaction_count')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingLearning) {
      await supabase
        .from('user_ai_learning')
        .update({
          interaction_count: (existingLearning.interaction_count || 0) + 1,
          last_interaction_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('user_ai_learning')
        .insert({
          user_id: userId,
          interaction_count: 1,
          last_interaction_at: new Date().toISOString(),
        });
    }

    console.log(`Orchestrator completed in ${responseTime}ms`);

    return new Response(
      JSON.stringify({
        ...aiResponse,
        enrichedContext: enrichedContext ? {
          atEpicLimit: enrichedContext.atEpicLimit,
          overloaded: enrichedContext.overloaded,
          suggestedWorkload: enrichedContext.suggestedWorkload,
          activeEpicCount: enrichedContext.activeEpics.length,
          activeHabitCount: enrichedContext.activeHabits.length,
        } : null,
        sessionId: sessionId || crypto.randomUUID(),
        responseTimeMs: responseTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Orchestrator error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
