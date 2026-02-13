import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

interface SnapshotBody {
  visibility?: "friends" | "private" | "public";
  headline?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await requireRequestAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const body = (await req.json().catch(() => ({}))) as SnapshotBody;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, spirit_animal, current_stage, current_mood, bond_level, routine_stability_score, current_emotional_arc, habitat_theme")
      .eq("user_id", userId)
      .maybeSingle();

    if (companionError) throw companionError;
    if (!companion) {
      return new Response(JSON.stringify({ error: "Companion not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: habitat } = await supabase
      .from("companion_habitat_state")
      .select("biome, ambiance, quality_tier, decor_slots")
      .eq("user_id", userId)
      .eq("companion_id", companion.id)
      .maybeSingle();

    const { data: campaignProgress } = await supabase
      .from("companion_campaign_progress")
      .select("current_chapter, current_node_id")
      .eq("user_id", userId)
      .eq("companion_id", companion.id)
      .maybeSingle();

    const payload = {
      companion: {
        spiritAnimal: companion.spirit_animal,
        stage: companion.current_stage,
        mood: companion.current_mood,
        bondLevel: companion.bond_level,
        emotionalArc: companion.current_emotional_arc,
        routineStability: companion.routine_stability_score,
      },
      habitat: habitat ?? {
        biome: companion.habitat_theme ?? "cosmic_nest",
        ambiance: "serene",
        quality_tier: "medium",
        decor_slots: {},
      },
      campaign: campaignProgress ?? {
        current_chapter: 0,
        current_node_id: null,
      },
      publishedAt: new Date().toISOString(),
    };

    const defaultHeadline = `${companion.spirit_animal} reached an emotional arc milestone`;

    const { data: snapshot, error: snapshotError } = await supabase
      .from("companion_social_snapshots")
      .insert({
        user_id: userId,
        companion_id: companion.id,
        snapshot_type: "daily",
        headline: body.headline?.trim() || defaultHeadline,
        snapshot_payload: payload,
        visibility: body.visibility ?? "friends",
        published_at: new Date().toISOString(),
      })
      .select("id, headline, visibility, published_at")
      .single();

    if (snapshotError) throw snapshotError;

    return new Response(JSON.stringify({ success: true, snapshot }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[publish-companion-snapshot]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
