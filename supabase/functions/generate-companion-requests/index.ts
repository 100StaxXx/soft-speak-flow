import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";
import { clamp, pickUrgency, buildRequestRecord, computeDesiredRequestCount } from "../_shared/companionLife.ts";

interface GenerateRequestBody {
  maxRequests?: number;
}

const GENERATION_COOLDOWN_SECONDS = 20 * 60;

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await requireRequestAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const body = (await req.json().catch(() => ({}))) as GenerateRequestBody;
    const requestedMax = Number(body.maxRequests ?? 3);
    const maxRequests = clamp(Math.floor(Number.isFinite(requestedMax) ? requestedMax : 3), 1, 5);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, care_score, care_consistency, bond_level, request_fatigue")
      .eq("user_id", userId)
      .maybeSingle();

    if (companionError) throw companionError;
    if (!companion) {
      return new Response(JSON.stringify({ error: "Companion not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    const { data: existingPending, error: pendingError } = await supabase
      .from("companion_requests")
      .select("id, requested_at")
      .eq("user_id", userId)
      .eq("companion_id", companion.id)
      .in("status", ["pending", "accepted", "snoozed"])
      .or(`due_at.is.null,due_at.gte.${nowIso}`);

    if (pendingError) throw pendingError;

    const openCount = (existingPending ?? []).length;
    const slotsAvailable = Math.max(0, maxRequests - openCount);

    const latestPendingRequestedAt = (existingPending ?? [])
      .map((row: any) => row.requested_at as string | null)
      .filter((value): value is string => !!value)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

    if (latestPendingRequestedAt) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(latestPendingRequestedAt).getTime()) / 1000);
      if (elapsedSeconds < GENERATION_COOLDOWN_SECONDS) {
        return new Response(JSON.stringify({
          success: true,
          generated: 0,
          openCount,
          maxRequests,
          cooldownActive: true,
          cooldownSecondsRemaining: Math.max(0, GENERATION_COOLDOWN_SECONDS - elapsedSeconds),
          reason: "generation_cooldown",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (slotsAvailable === 0) {
      return new Response(JSON.stringify({
        success: true,
        generated: 0,
        openCount,
        maxRequests,
        cooldownActive: true,
        cooldownSecondsRemaining: 0,
        reason: "max_open_requests",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const careScore = clamp(Number(companion.care_score ?? 0.5), 0, 1);
    const careConsistency = clamp(Number(companion.care_consistency ?? 0.5), 0, 1);
    const requestFatigue = clamp(Number(companion.request_fatigue ?? 0), 0, 10);
    const bondLevel = clamp(Number(companion.bond_level ?? 1), 0, 99);

    const desiredCount = computeDesiredRequestCount({
      careScore,
      careConsistency,
      requestFatigue,
      slotsAvailable,
    });
    const baseSeed = `${companion.id}:${new Date().toISOString().slice(0, 10)}:${bondLevel}:${openCount}`;

    const rows = Array.from({ length: desiredCount }).map((_, index) => {
      const urgency = pickUrgency(careScore, requestFatigue, `${baseSeed}:urgency:${index}`, careConsistency);
      const dueHours = urgency === "critical"
        ? 2
        : urgency === "important"
          ? 5
          : careConsistency < 0.45
            ? 8
            : 12;
      const dueAt = new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString();
      return buildRequestRecord({
        userId,
        companionId: companion.id,
        urgency,
        index,
        baseSeed,
        dueAtIso: dueAt,
      });
    });

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("companion_requests")
        .insert(rows);

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({
      success: true,
      generated: rows.length,
      openCount: openCount + rows.length,
      maxRequests,
      cooldownActive: false,
      cooldownSecondsRemaining: 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-companion-requests]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
