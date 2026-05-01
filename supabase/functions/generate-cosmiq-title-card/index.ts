import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { type RequestAuth, requireRequestAuth } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { resolveCosmiqTitleCard } from "../_shared/cosmiqTitleCard.ts";
import { validateCompanionStatAnalysis } from "../../../src/shared/companionStatAnalysis.ts";
import {
  getOnboardingVisualPersonaFromTags,
  ONBOARDING_VISUAL_PERSONA_QUESTION_ID,
} from "../../../src/shared/onboardingVisualPersona.ts";

interface GenerateCosmiqTitleCardDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  resolveCosmiqTitleCard: typeof resolveCosmiqTitleCard;
}

const defaultDeps: GenerateCosmiqTitleCardDeps = {
  authenticate: requireRequestAuth,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseKey);
  },
  fetchImpl: fetch,
  resolveCosmiqTitleCard,
};

const ANALYSIS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseAnalysisDate = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !ANALYSIS_DATE_PATTERN.test(value)) {
    throw new Error("analysisDate must use YYYY-MM-DD format");
  }
  return value;
};

interface QuestionnaireResponseRow {
  answer_tags: string[] | null;
}

export async function handleGenerateCosmiqTitleCard(
  req: Request,
  deps: GenerateCosmiqTitleCardDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await deps.authenticate(req, corsHeaders);
    if (auth instanceof Response) return auth;
    if (auth.isServiceRole) {
      return new Response(JSON.stringify({ error: "User authentication required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let analysisDate: string | null = null;
    try {
      analysisDate = parseAnalysisDate(body?.analysisDate);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Invalid analysisDate" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const forceRefresh = body?.forceRefresh === true;

    const supabase = deps.createSupabaseClient();
    let analysisQuery = supabase
      .from("companion_stat_analyses")
      .select("payload, analysis_date")
      .eq("user_id", auth.userId);

    if (analysisDate) {
      analysisQuery = analysisQuery.eq("analysis_date", analysisDate);
    } else {
      analysisQuery = analysisQuery.order("analysis_date", { ascending: false }).limit(1);
    }

    const { data: analysisRow, error: analysisError } = await analysisQuery.maybeSingle();
    if (analysisError) throw analysisError;

    if (!analysisRow?.payload) {
      return new Response(
        JSON.stringify({ error: "Analysis not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: visualPersonaRow, error: visualPersonaError } = await supabase
      .from("questionnaire_responses")
      .select("answer_tags")
      .eq("user_id", auth.userId)
      .eq("question_id", ONBOARDING_VISUAL_PERSONA_QUESTION_ID)
      .maybeSingle();

    if (visualPersonaError) throw visualPersonaError;
    const visualPersona = getOnboardingVisualPersonaFromTags(
      (visualPersonaRow as QuestionnaireResponseRow | null)?.answer_tags,
    );

    const analysisValidation = validateCompanionStatAnalysis(analysisRow.payload);
    if (!analysisValidation.ok) {
      return new Response(
        JSON.stringify({ error: "Stored analysis is invalid", details: analysisValidation.error }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const card = await deps.resolveCosmiqTitleCard({
      supabase,
      userId: auth.userId,
      analysis: analysisValidation.data,
      visualPersona,
      forceRefresh,
      fetchImpl: deps.fetchImpl,
    });

    return new Response(JSON.stringify({ card }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-cosmiq-title-card:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateCosmiqTitleCard(req));
}
