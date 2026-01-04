import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const ChatSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000)
  })).max(20).optional(),
  mentorName: z.string().min(1).max(50),
  mentorTone: z.string().min(1).max(200),
  comprehensiveMode: z.boolean().optional(),
  briefingContext: z.string().max(5000).optional(),
});

const DAILY_MESSAGE_LIMIT = 20;

// Analyze user communication patterns for adaptive learning
interface CommunicationAnalysis {
  length: number;
  wordCount: number;
  hasEmoji: boolean;
  isQuestion: boolean;
  isFormal: boolean;
  isDetailed: boolean;
  hasExclamation: boolean;
}

function analyzeUserCommunication(message: string): CommunicationAnalysis {
  const words = message.trim().split(/\s+/);
  const informalPatterns = /\b(hey|yeah|nah|gonna|wanna|lol|haha|omg|btw|idk|tbh|rn|u|ur|pls|thx)\b/i;
  
  return {
    length: message.length,
    wordCount: words.length,
    hasEmoji: /\p{Emoji}/u.test(message),
    isQuestion: message.includes('?'),
    isFormal: !informalPatterns.test(message) && /^[A-Z]/.test(message),
    isDetailed: words.length > 20 || message.includes(','),
    hasExclamation: message.includes('!'),
  };
}

// Update user communication preferences based on message analysis
async function updateCommunicationLearning(
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  analysis: CommunicationAnalysis
): Promise<void> {
  try {
    // Create a service role client for updating preferences
    const adminClient = createClient(supabaseUrl, supabaseKey);
    
    // Fetch existing preferences
    const { data: existing } = await adminClient
      .from('user_ai_preferences')
      .select('avg_message_length, message_count, uses_emojis, prefers_formal_language, prefers_direct_answers, engagement_patterns')
      .eq('user_id', userId)
      .maybeSingle();

    const currentCount = (existing as any)?.message_count || 0;
    const newCount = currentCount + 1;
    
    // Calculate rolling averages
    const currentAvgLength = (existing as any)?.avg_message_length || 0;
    const newAvgLength = Math.round((currentAvgLength * currentCount + analysis.length) / newCount);
    
    // Determine preferences with confidence thresholds (only update after enough data)
    const engagementPatterns = (existing as any)?.engagement_patterns || {};
    const emojiCount = (engagementPatterns.emoji_messages || 0) + (analysis.hasEmoji ? 1 : 0);
    const formalCount = (engagementPatterns.formal_messages || 0) + (analysis.isFormal ? 1 : 0);
    const questionCount = (engagementPatterns.question_messages || 0) + (analysis.isQuestion ? 1 : 0);
    const detailedCount = (engagementPatterns.detailed_messages || 0) + (analysis.isDetailed ? 1 : 0);
    
    const updatedPatterns = {
      ...engagementPatterns,
      emoji_messages: emojiCount,
      formal_messages: formalCount,
      question_messages: questionCount,
      detailed_messages: detailedCount,
    };

    // Only set preferences after 5+ messages for confidence
    const usesEmojis = newCount >= 5 ? (emojiCount / newCount) > 0.3 : null;
    const prefersFormal = newCount >= 5 ? (formalCount / newCount) > 0.5 : null;
    const prefersDirectAnswers = newCount >= 5 ? (questionCount / newCount) > 0.6 : null;

    // Upsert preferences
    await adminClient
      .from('user_ai_preferences')
      .upsert({
        user_id: userId,
        avg_message_length: newAvgLength,
        message_count: newCount,
        uses_emojis: usesEmojis,
        prefers_formal_language: prefersFormal,
        prefers_direct_answers: prefersDirectAnswers,
        engagement_patterns: updatedPatterns,
        learning_updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id' });

    console.log(`Updated communication learning for user ${userId}: avg_length=${newAvgLength}, count=${newCount}`);
  } catch (error) {
    // Non-blocking - don't fail the chat if learning update fails
    console.error('Failed to update communication learning:', error);
  }
}

/**
 * Extract scheduling-relevant signals from chat messages
 */
interface SchedulingSignals {
  chatHour: number;
  dayOfWeek: number;
  mentionsEnergy: 'low' | 'high' | null;
  mentionsOverwhelm: boolean;
  mentionsWorkStyle: string | null;
}

function extractSchedulingSignals(message: string): SchedulingSignals {
  const lowerMsg = message.toLowerCase();
  const now = new Date();
  
  let mentionsEnergy: 'low' | 'high' | null = null;
  if (/tired|exhausted|low energy|drained|burnt out|sleepy|fatigued/.test(lowerMsg)) {
    mentionsEnergy = 'low';
  } else if (/energized|pumped|ready|motivated|fired up|great|amazing|productive/.test(lowerMsg)) {
    mentionsEnergy = 'high';
  }
  
  const mentionsOverwhelm = /overwhelm|too much|can't handle|stressed|behind|swamped|drowning/.test(lowerMsg);
  
  let mentionsWorkStyle: string | null = null;
  if (/9.?to.?5|office hours|work hours|day job|corporate/.test(lowerMsg)) {
    mentionsWorkStyle = 'traditional';
  } else if (/night owl|late night|evening person|work late|midnight/.test(lowerMsg)) {
    mentionsWorkStyle = 'entrepreneur';
  } else if (/morning person|early bird|start early|wake up early/.test(lowerMsg)) {
    mentionsWorkStyle = 'traditional';
  } else if (/flexible|my own hours|whenever|freelance/.test(lowerMsg)) {
    mentionsWorkStyle = 'flexible';
  }
  
  return {
    chatHour: now.getHours(),
    dayOfWeek: now.getDay(),
    mentionsEnergy,
    mentionsOverwhelm,
    mentionsWorkStyle,
  };
}

/**
 * Send scheduling signals to pattern analyzer (non-blocking)
 */
async function sendSchedulingSignals(
  supabaseUrl: string,
  authHeader: string,
  message: string
): Promise<void> {
  try {
    const signals = extractSchedulingSignals(message);
    
    // Only send if there's something meaningful to learn
    if (signals.mentionsEnergy || signals.mentionsOverwhelm || signals.mentionsWorkStyle) {
      await fetch(`${supabaseUrl}/functions/v1/analyze-user-patterns`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'mentor_chat_signal',
          data: signals
        })
      });
    }
  } catch (error) {
    // Non-blocking - don't fail the chat
    console.error('Failed to send scheduling signals:', error);
  }
}

/**
 * Sanitize error messages for client responses
 * Logs full error server-side, returns generic message to client
 */
function sanitizeError(error: unknown): string {
  // Log full error details server-side for debugging
  console.error("Full error details:", error);
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Configuration errors - generic message
    if (msg.includes("api_key") || msg.includes("not configured")) {
      return "Service temporarily unavailable";
    }
    
    // Auth errors - safe to indicate
    if (msg.includes("unauthorized") || msg.includes("invalid token")) {
      return "Unauthorized";
    }
  }
  
  // Generic error for everything else
  return "An error occurred. Please try again.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(req);

  try {
    // Get authenticated user
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

    // Validate input
    const body = await req.json();
    const validation = ChatSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message, conversationHistory, mentorName, mentorTone, comprehensiveMode, briefingContext } = validation.data;

    // Analyze user communication for learning (non-blocking)
    const communicationAnalysis = analyzeUserCommunication(message);
    
    // Build additional context for comprehensive mode
    let additionalContext = '';
    if (briefingContext) {
      additionalContext += `\n\nTODAY'S MORNING BRIEFING (you gave the user this earlier):\n${briefingContext}\n`;
    }
    if (comprehensiveMode) {
      additionalContext += '\nThe user wants comprehensive, data-aware guidance. Reference their activities and goals.';
    }
    // Check rate limit using shared rateLimiter
    const rateLimitCheck = await checkRateLimit(
      supabase,
      user.id,
      'mentor-chat',
      RATE_LIMITS['mentor-chat']
    );

    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck, corsHeaders);
    }

    // Enforce server-side daily cap regardless of client state
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: messagesToday, error: dailyCountError } = await supabase
      .from('mentor_chats')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', startOfDay.toISOString());

    if (dailyCountError) {
      throw dailyCountError;
    }

    if ((messagesToday || 0) >= DAILY_MESSAGE_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "Daily limit reached",
          message: `You've reached today's mentor chat limit (${DAILY_MESSAGE_LIMIT} messages). Come back tomorrow for more guidance!`,
          limit: DAILY_MESSAGE_LIMIT
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build personalized prompt using template system
    const promptBuilder = new PromptBuilder(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Build context history from conversation
    const contextualInfo = conversationHistory && conversationHistory.length > 0
      ? `Recent conversation context:\n${conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}`
      : '';

    const { systemPrompt: baseSystemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: 'mentor_chat',
      userId: user.id,
      variables: {
        mentorName,
        mentorTone,
        userMessage: message,
        contextualInfo: contextualInfo + additionalContext,
        personalityAdjustments: '',
        maxSentences: 4
      }
    });

    const systemPrompt = baseSystemPrompt;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: userPrompt }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Validate output
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(assistantMessage);

    // Log validation results
    const responseTime = Date.now() - startTime;
    await supabase
      .from('ai_output_validation_log')
      .insert({
        user_id: user.id,
        template_key: 'mentor_chat',
        input_data: { message, mentorName, mentorTone },
        output_data: { response: assistantMessage },
        validation_passed: validationResult.isValid,
        validation_errors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    if (!validationResult.isValid) {
      console.warn('Validation failed:', validator.getValidationSummary(validationResult));
    }

    // Update communication learning in background (non-blocking)
    updateCommunicationLearning(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      user.id,
      communicationAnalysis
    );

    // Send scheduling-relevant signals to pattern analyzer (non-blocking)
    sendSchedulingSignals(
      Deno.env.get("SUPABASE_URL") ?? "",
      authHeader,
      message
    );

    return new Response(
      JSON.stringify({ 
        response: assistantMessage,
        dailyLimit: DAILY_MESSAGE_LIMIT,
        messagesUsed: (messagesToday || 0) + 1
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in mentor-chat function:", error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
