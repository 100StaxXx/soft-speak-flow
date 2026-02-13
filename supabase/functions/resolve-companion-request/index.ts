import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";
import { clamp } from "../_shared/companionLife.ts";

type ResolveAction = "accept" | "complete" | "decline" | "snooze";

interface ResolveBody {
  requestId?: string;
  action?: ResolveAction;
  actionNote?: string;
}

const ACTION_TO_STATUS: Record<ResolveAction, string> = {
  accept: "accepted",
  complete: "completed",
  decline: "declined",
  snooze: "snoozed",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await requireRequestAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const body = (await req.json().catch(() => ({}))) as ResolveBody;
    const requestId = body.requestId;
    const action = body.action;

    if (!requestId || !action || !(action in ACTION_TO_STATUS)) {
      return new Response(JSON.stringify({ error: "requestId and valid action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: request, error: requestError } = await supabase
      .from("companion_requests")
      .select("id, user_id, companion_id, status, title, request_type, urgency, consequence_hint")
      .eq("id", requestId)
      .eq("user_id", userId)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = ACTION_TO_STATUS[action];
    const resolvedAt = action === "accept" || action === "snooze" ? null : new Date().toISOString();

    const { error: updateError } = await supabase
      .from("companion_requests")
      .update({
        status,
        resolved_at: resolvedAt,
        response_style: action,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .eq("user_id", userId);

    if (updateError) throw updateError;

    const impactByAction: Record<ResolveAction, { bondDelta: number; fatigueDelta: number; interactionsDelta: number }> = {
      accept: { bondDelta: 1, fatigueDelta: 0, interactionsDelta: 1 },
      complete: { bondDelta: 2, fatigueDelta: -1, interactionsDelta: 1 },
      decline: { bondDelta: -1, fatigueDelta: 2, interactionsDelta: 0 },
      snooze: { bondDelta: 0, fatigueDelta: 1, interactionsDelta: 0 },
    };

    const impact = impactByAction[action];

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, bond_level, request_fatigue, total_interactions")
      .eq("id", request.companion_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (companionError) throw companionError;

    if (companion) {
      const nextBond = Math.max(0, Number(companion.bond_level ?? 0) + impact.bondDelta);
      const nextFatigue = clamp(Number(companion.request_fatigue ?? 0) + impact.fatigueDelta, 0, 10);
      const nextInteractions = Math.max(0, Number(companion.total_interactions ?? 0) + impact.interactionsDelta);

      const { error: companionUpdateError } = await supabase
        .from("user_companion")
        .update({
          bond_level: nextBond,
          request_fatigue: nextFatigue,
          total_interactions: nextInteractions,
          last_interaction_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", companion.id)
        .eq("user_id", userId);

      if (companionUpdateError) throw companionUpdateError;
    }

    const { error: historyError } = await supabase
      .from("companion_request_history")
      .insert({
        request_id: request.id,
        user_id: userId,
        companion_id: request.companion_id,
        action,
        action_note: body.actionNote ?? null,
        impact_summary: impact,
      });

    if (historyError) throw historyError;

    if (action === "complete" || action === "decline") {
      const memoryType = action === "complete" ? "special_moment" : "challenge";
      const emotion = action === "complete" ? "gratitude" : "concern";
      const memoryTitle = action === "complete"
        ? `Completed: ${request.title}`
        : `Declined: ${request.title}`;
      const memoryDescription = action === "complete"
        ? `Resolved companion request (${request.request_type}) with successful follow-through.`
        : `Declined companion request (${request.request_type}); tension may increase if this pattern repeats.`;

      const { error: memoryError } = await supabase
        .from("companion_memories")
        .insert({
          user_id: userId,
          companion_id: request.companion_id,
          memory_type: memoryType,
          memory_context: {
            title: memoryTitle,
            description: memoryDescription,
            emotion,
            details: {
              requestType: request.request_type,
              urgency: request.urgency,
              action,
              consequenceHint: request.consequence_hint ?? null,
            },
          },
          memory_date: new Date().toISOString().slice(0, 10),
          referenced_count: 0,
        });

      if (memoryError) {
        console.warn("[resolve-companion-request] memory insert skipped", memoryError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, requestId: request.id, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[resolve-companion-request]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
