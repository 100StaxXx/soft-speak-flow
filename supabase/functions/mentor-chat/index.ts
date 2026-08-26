import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import {
  checkRateLimit,
  logRateLimitedInvocation,
  RATE_LIMITS,
} from "../_shared/rateLimiter.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { resolveSupportedMentorSlug } from "../_shared/mentorRoster.ts";
import {
  CHRISTIAN_GUIDANCE_POLICY,
  enforceChristianGuidanceOutput,
} from "../_shared/christianGuidancePolicy.ts";
import { resolveUserProductMode } from "../_shared/productBoundary.ts";

const ChatSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000)
  })).max(20).optional(),
  mentorName: z.string().min(1).max(50),
  mentorTone: z.string().min(1).max(200),
  mentorSlug: z.string().max(50).optional(),
  comprehensiveMode: z.boolean().optional(),
  briefingContext: z.string().max(5000).optional(),
});

const DAILY_MESSAGE_LIMIT = 20;

function secondsUntilNextUtcDay(now = new Date()): number {
  const nextDay = new Date(now);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  nextDay.setUTCHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((nextDay.getTime() - now.getTime()) / 1000));
}

function parseRetryAfterSeconds(response: Response): number {
  const raw = response.headers.get("Retry-After")?.trim();
  if (!raw) return 60;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(300, Math.ceil(seconds));
  }

  const retryAt = Date.parse(raw);
  if (Number.isFinite(retryAt)) {
    return Math.min(300, Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)));
  }

  return 60;
}

async function getProviderErrorCode(response: Response): Promise<string | null> {
  try {
    const payload = await response.clone().json();
    const code = payload?.error?.code ?? payload?.error?.type ?? payload?.code;
    return typeof code === "string" && code.trim() ? code.trim() : null;
  } catch {
    return null;
  }
}

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

function getMentorPersonalityAdjustments(mentorSlug?: string | null): string {
  const resolved = resolveSupportedMentorSlug(mentorSlug);

  switch (resolved) {
    case "sage":
      return "Response shape: calm reframe -> one clear next step. Keep the response calm, concise, and grounded. Prioritize patient perspective over pressure. Never hype or scold.";
    case "lyra":
      return "Response shape: pattern diagnosis -> discerning question -> clear next move. Keep the response poised, perceptive, precise, and clarifying. Separate noise from what matters without claiming supernatural insight or certainty.";
    case "icon":
      return "Response shape: identity check -> standard -> aligned action. Keep the response composed, standards-driven, and elegant. Frame advice around alignment, identity, discernment, and boundaries. Avoid generic confidence hype.";
    case "charles":
      return "Response shape: useful callout -> tiny task -> no-drama exit. Keep the response short, blunt, and lightly snarky. Accountability should sting a little, but stay useful. Never mock pain, fear, grief, or vulnerability; only mock avoidance and excuses.";
    case "princess":
      return "Response shape: validation -> clear direction -> encouraging close. Keep the response warm, steady, and kind while still giving a real next step. Make room for rest and limits without turning consistency into spiritual worth.";
    case "operator":
      return "Response shape: objective -> realistic plan -> execution order. Keep the response precise, controlled, and practical. Emphasize wise stewardship, structure, and sustainable systems without equating productivity with worth.";
    case "rival":
      return "Response shape: challenge -> stakes -> courageous action. Keep the response direct, energetic, and demanding without contempt or shame. Use endurance and honest follow-through to drive action; challenge avoidance, never the user's dignity.";
    case "reign":
      return "Keep the response commanding, ambitious, and performance-focused.";
    default:
      return "";
  }
}

export async function handleMentorChat(req: Request) {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "ai.standard",
      endpointName: "mentor-chat",
      blockedMessage: "Too many AI requests. Please try again later.",
      metadata: {
        flow: "mentor_chat",
      },
    });

    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }

    if (!authHeader) {
      return createSafeErrorResponse(req, {
        status: 401,
        code: "UNAUTHORIZED",
        error: "Unauthorized",
        requestId: protectedRequest.requestId,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const userId = protectedRequest.auth.userId;
    const supabaseAdmin = protectedRequest.supabase;
    const productMode = await resolveUserProductMode(supabaseAdmin, userId);
    const productName = productMode === "graceward" ? "Graceward" : "Cosmiq";

    const costGuardrails = createCostGuardrailSession({
      supabase: supabaseAdmin,
      endpointKey: "mentor-chat",
      featureKey: "ai_mentor_chat",
      userId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["text"],
      providers: ["openai"],
    });

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

    const {
      message,
      conversationHistory,
      mentorName,
      mentorTone,
      mentorSlug,
      comprehensiveMode,
      briefingContext,
    } = validation.data;

    // Analyze user communication for learning (non-blocking)
    const communicationAnalysis = analyzeUserCommunication(message);
    
    const personalityAdjustments = getMentorPersonalityAdjustments(mentorSlug);

    // Build additional context for comprehensive mode
    let additionalContext = '';
    if (briefingContext) {
      additionalContext += `\n\nCONNECTED DAILY CONTEXT FROM ${productName.toUpperCase()}:\n${briefingContext}\nUse this only when it helps the current request. Refer to remembered choices naturally, without claiming human memory.\n`;
    }
    if (comprehensiveMode) {
      additionalContext += '\nThe user wants comprehensive, data-aware guidance. Reference their activities and goals.';
    }
    // Enforce server-side daily cap regardless of client state
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: messagesToday, error: dailyCountError } = await supabase
      .from('mentor_chats')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', startOfDay.toISOString());

    if (dailyCountError) {
      throw dailyCountError;
    }

    if ((messagesToday || 0) >= DAILY_MESSAGE_LIMIT) {
      const retryAfterSeconds = secondsUntilNextUtcDay();
      return new Response(
        JSON.stringify({
          error: "Daily limit reached",
          code: "DAILY_GUIDE_LIMIT_REACHED",
          message: `You've reached today's Guide conversation limit (${DAILY_MESSAGE_LIMIT} messages). Come back tomorrow for more reflection and planning.`,
          limit: DAILY_MESSAGE_LIMIT,
          messagesUsed: DAILY_MESSAGE_LIMIT,
          retryable: false,
          retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }

    const rateLimit = await checkRateLimit(
      supabaseAdmin,
      userId,
      "mentor-chat",
      RATE_LIMITS["mentor-chat"],
    );
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.min(
        3600,
        Math.max(60, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)),
      );
      return new Response(
        JSON.stringify({
          error: "Guide temporarily unavailable",
          code: "GUIDE_REQUEST_LIMITED",
          message: "Live Guide replies are temporarily busy. Please try again shortly.",
          retryable: true,
          retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
          },
        },
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
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
      userId,
      variables: {
        mentorName,
        mentorTone,
        userMessage: message,
        contextualInfo: contextualInfo + additionalContext,
        personalityAdjustments,
        maxSentences: 4
      }
    });

    const guideRoleContext = productMode === "graceward"
      ? `DAILY WAY GUIDE ROLE:
- ${mentorName} is an original fictional Guide profile inside Graceward, not a historical person, pastor, clergy member, or spiritual authority.
- You are Graceward's AI reflection and planning assistant using ${mentorName}'s communication style. Never claim to literally be ${mentorName}.
- Preserve the Guide's tone while keeping Scripture central and presenting every suggested practice as optional.`
      : `COSMIQ GUIDE ROLE:
- ${mentorName} is an original fictional Guide profile inside Cosmiq, not a real person or professional authority.
- You are Cosmiq's AI planning, reflection, and personal-growth assistant using ${mentorName}'s communication style. Never claim to literally be ${mentorName}.
- Keep guidance practical and optional. Never import Graceward branding, Scripture, prayer, theology, or claims about spiritual standing unless the user explicitly raises their own beliefs.`;

    const systemPrompt = `${baseSystemPrompt}\n\n${guideRoleContext}${
      productMode === "graceward" ? `\n\n${CHRISTIAN_GUIDANCE_POLICY}` : ""
    }`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: userPrompt }
    ];

    const response = await guardedFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfterSeconds = parseRetryAfterSeconds(response);
        const providerCode = await getProviderErrorCode(response);
        console.warn("Guide provider rate limited", {
          requestId: protectedRequest.requestId,
          providerCode,
          retryAfterSeconds,
        });
        return new Response(
          JSON.stringify({
            error: "Guide temporarily unavailable",
            code: "GUIDE_PROVIDER_RATE_LIMITED",
            message: "Live Guide replies are temporarily busy. Please try again in a moment.",
            retryable: true,
            retryAfterSeconds,
            upstreamStatus: 429,
          }),
          {
            status: 503,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(retryAfterSeconds),
            },
          }
        );
      }
      if (response.status === 402) {
        console.error("Guide provider billing unavailable", {
          requestId: protectedRequest.requestId,
        });
        return new Response(
          JSON.stringify({
            error: "Guide temporarily unavailable",
            code: "GUIDE_PROVIDER_UNAVAILABLE",
            message: "Live Guide replies are temporarily unavailable. Please try again later.",
            retryable: true,
            upstreamStatus: 402,
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Guide temporarily unavailable",
          code: "GUIDE_PROVIDER_UNAVAILABLE",
          message: "Live Guide replies are temporarily unavailable. Please try again later.",
          retryable: true,
          upstreamStatus: response.status,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawAssistantMessage = data.choices[0].message.content;
    const assistantMessage = productMode === "graceward"
      ? enforceChristianGuidanceOutput(rawAssistantMessage)
      : rawAssistantMessage;

    // Validate output
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(assistantMessage);

    // Log validation results
    const responseTime = Date.now() - startTime;
    await logRateLimitedInvocation(supabase, {
      userId,
      templateKey: 'mentor-chat',
      inputData: { message, mentorName, mentorTone, promptTemplateKey: 'mentor_chat' },
      outputData: { response: assistantMessage },
      validationPassed: validationResult.isValid,
      validationErrors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
      modelUsed: 'google/gemini-2.5-flash',
      responseTimeMs: responseTime
    });

    if (!validationResult.isValid) {
      console.warn('Validation failed:', validator.getValidationSummary(validationResult));
    }

    // Update communication learning in background (non-blocking)
    updateCommunicationLearning(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      userId,
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
        messagesUsed: (messagesToday || 0) + 1,
        responderMentorSlug: resolveSupportedMentorSlug(mentorSlug),
        openerMentorSlug: null,
        routingReason: resolveSupportedMentorSlug(mentorSlug) ? "direct_mentor_request" : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error in mentor-chat function:", error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  Deno.serve((req) => handleMentorChat(req));
}
