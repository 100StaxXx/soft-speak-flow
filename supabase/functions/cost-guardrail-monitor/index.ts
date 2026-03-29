import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireServiceRoleAuth } from "../_shared/auth.ts";
import {
  createCostGuardrailSupabaseClient,
  detectCostAnomalies,
  emitCostAlert,
  getCurrentCostPeriodStart,
} from "../_shared/costGuardrails.ts";

const PAGE_SIZE = 1000;

type CostEventSample = {
  endpoint_key: string;
  estimated_cost_usd: number | string | null;
  created_at: string;
};

async function loadRecentCostEvents() {
  const supabase = createCostGuardrailSupabaseClient();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const events: CostEventSample[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("cost_events")
      .select("endpoint_key, estimated_cost_usd, created_at")
      .gte("created_at", fourteenDaysAgo)
      .gt("estimated_cost_usd", 0)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as CostEventSample[];
    events.push(...rows);

    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  return { supabase, events };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireServiceRoleAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    const now = new Date();
    const periodStart = getCurrentCostPeriodStart(now);
    const { supabase, events } = await loadRecentCostEvents();
    const anomalies = detectCostAnomalies(
      events.map((event) => ({
        endpointKey: event.endpoint_key,
        estimatedCostUsd: Number(event.estimated_cost_usd ?? 0),
        createdAt: event.created_at,
      })),
      now,
    );

    let emitted = 0;
    for (const anomaly of anomalies) {
      const bucket = anomaly.window === "hour"
        ? now.toISOString().slice(0, 13)
        : now.toISOString().slice(0, 10);

      const wasInserted = await emitCostAlert({
        supabase,
        periodStart,
        scopeType: "endpoint",
        scopeKey: anomaly.endpointKey,
        alertType: "anomaly",
        currentEstimatedCostUsd: anomaly.recentSpendUsd,
        message: anomaly.message,
        dedupeKey: `${periodStart}:anomaly:${anomaly.endpointKey}:${anomaly.window}:${bucket}`,
        metadata: {
          window: anomaly.window,
          recent_spend_usd: anomaly.recentSpendUsd,
          baseline_spend_usd: anomaly.baselineSpendUsd,
          multiplier: anomaly.multiplier,
          delta_usd: anomaly.deltaUsd,
        },
      });

      if (wasInserted) {
        emitted += 1;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked_at: now.toISOString(),
        anomalies_detected: anomalies.length,
        alerts_emitted: emitted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[cost-guardrail-monitor] Failed to run monitor", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
