import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";
import { clamp } from "../_shared/companionLife.ts";

interface CompleteRitualBody {
  dailyRitualId?: string;
  ritualDefCode?: string;
  ritualDate?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await requireRequestAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const body = (await req.json().catch(() => ({}))) as CompleteRitualBody;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ritualDate = body.ritualDate ?? new Date().toISOString().slice(0, 10);

    let dailyRitual: {
      id: string;
      user_id: string;
      companion_id: string;
      ritual_def_id: string;
      status: string;
    } | null = null;

    if (body.dailyRitualId) {
      const { data, error } = await supabase
        .from("companion_daily_rituals")
        .select("id, user_id, companion_id, ritual_def_id, status")
        .eq("id", body.dailyRitualId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      dailyRitual = data;
    } else if (body.ritualDefCode) {
      const { data: def, error: defError } = await supabase
        .from("companion_ritual_defs")
        .select("id")
        .eq("code", body.ritualDefCode)
        .maybeSingle();
      if (defError) throw defError;
      if (!def) {
        return new Response(JSON.stringify({ error: "Ritual definition not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: companion, error: companionError } = await supabase
        .from("user_companion")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (companionError) throw companionError;
      if (!companion) {
        return new Response(JSON.stringify({ error: "Companion not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("companion_daily_rituals")
        .select("id, user_id, companion_id, ritual_def_id, status")
        .eq("user_id", userId)
        .eq("companion_id", companion.id)
        .eq("ritual_def_id", def.id)
        .eq("ritual_date", ritualDate)
        .maybeSingle();
      if (error) throw error;
      dailyRitual = data;
    }

    if (!dailyRitual) {
      return new Response(JSON.stringify({ error: "Ritual instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dailyRitual.status === "completed") {
      return new Response(JSON.stringify({ success: true, alreadyCompleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ritualDef, error: ritualDefError } = await supabase
      .from("companion_ritual_defs")
      .select("title, ritual_type, base_bond_delta, base_care_delta")
      .eq("id", dailyRitual.ritual_def_id)
      .single();

    if (ritualDefError) throw ritualDefError;

    const completionTime = new Date().toISOString();

    const { error: ritualUpdateError } = await supabase
      .from("companion_daily_rituals")
      .update({
        status: "completed",
        completed_at: completionTime,
        completion_context: {
          completedAt: completionTime,
          source: "complete-companion-ritual",
        },
        updated_at: completionTime,
      })
      .eq("id", dailyRitual.id)
      .eq("user_id", userId);

    if (ritualUpdateError) throw ritualUpdateError;

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, bond_level, care_score, care_consistency, total_interactions")
      .eq("id", dailyRitual.companion_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (companionError) throw companionError;

    if (companion) {
      const nextBond = Math.max(0, Number(companion.bond_level ?? 0) + Number(ritualDef.base_bond_delta ?? 1));
      const nextCare = clamp(Number(companion.care_score ?? 0.5) + Number(ritualDef.base_care_delta ?? 0.02), 0, 1);
      const nextConsistency = clamp(Number(companion.care_consistency ?? 0.5) + 0.01, 0, 1);
      const nextInteractions = Math.max(0, Number(companion.total_interactions ?? 0) + 1);

      const { error: companionUpdateError } = await supabase
        .from("user_companion")
        .update({
          bond_level: nextBond,
          care_score: nextCare,
          care_consistency: nextConsistency,
          total_interactions: nextInteractions,
          last_interaction_at: completionTime,
          updated_at: completionTime,
        })
        .eq("id", companion.id)
        .eq("user_id", userId);

      if (companionUpdateError) throw companionUpdateError;

      const { error: memoryError } = await supabase
        .from("companion_memories")
        .insert({
          user_id: userId,
          companion_id: companion.id,
          memory_type: "special_moment",
          memory_context: {
            title: ritualDef.title,
            description: `Completed ${ritualDef.title} (${ritualDef.ritual_type})`,
            emotion: "gratitude",
            details: {
              ritualType: ritualDef.ritual_type,
              bondDelta: ritualDef.base_bond_delta,
              careDelta: ritualDef.base_care_delta,
            },
          },
          memory_date: ritualDate,
          referenced_count: 0,
        });

      if (memoryError) {
        console.warn("[complete-companion-ritual] memory insert skipped", memoryError.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ritualId: dailyRitual.id,
      completedAt: completionTime,
      ritualTitle: ritualDef.title,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[complete-companion-ritual]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
