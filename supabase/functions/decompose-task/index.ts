import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { buildTaskBreakdownSuggestions } from "../_shared/taskDecomposition.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "ai.standard",
      endpointName: "decompose-task",
      allowServiceRole: false,
    });
    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }
    const { auth, supabase, requestId: protectedRequestId } = protectedRequest;
    requestId = protectedRequestId;

    const { taskTitle, taskDescription } = await req.json();

    if (!taskTitle) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_INPUT",
        error: "Task title is required",
        requestId,
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "decompose-task",
      featureKey: "ai_planner_text",
      userId: auth.userId,
      requestId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["text"],
      providers: ["openai"],
      metadata: {
        task_title_length: String(taskTitle).length,
        has_description: Boolean(taskDescription),
      },
    });

    console.log('Calling OpenAI to decompose task:', taskTitle);
    const subtasks = await buildTaskBreakdownSuggestions({
      fetchImpl: guardedFetch,
      openAIApiKey: OPENAI_API_KEY,
      taskTitle,
      taskDescription,
    });

    return new Response(
      JSON.stringify({ subtasks }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error('Error in decompose-task:', error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Request could not be processed right now",
      requestId,
    });
  }
});
