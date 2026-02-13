import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

interface AdvanceBody {
  choiceKey?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await requireRequestAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const body = (await req.json().catch(() => ({}))) as AdvanceBody;
    const choiceKey = body.choiceKey ?? "steady";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, bond_level, routine_stability_score, request_fatigue")
      .eq("user_id", userId)
      .maybeSingle();

    if (companionError) throw companionError;
    if (!companion) {
      return new Response(JSON.stringify({ error: "Companion not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("companion_campaign_nodes")
      .select("id, node_key, chapter_index, title, summary, unlock_rules, branch_outcomes, ambient_theme")
      .order("chapter_index", { ascending: true });

    if (nodesError) throw nodesError;
    if (!nodes || nodes.length === 0) {
      return new Response(JSON.stringify({ error: "Campaign nodes unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingProgress, error: progressError } = await supabase
      .from("companion_campaign_progress")
      .select("id, current_node_id, current_chapter, unlocked_node_ids, completed_node_ids, choice_history")
      .eq("user_id", userId)
      .eq("companion_id", companion.id)
      .maybeSingle();

    if (progressError) throw progressError;

    const progress = existingProgress ?? {
      id: null,
      current_node_id: null,
      current_chapter: 0,
      unlocked_node_ids: [],
      completed_node_ids: [],
      choice_history: [],
    };

    const unlockedNodeIds = new Set<string>((progress.unlocked_node_ids as string[] | null) ?? []);
    const completedNodeIds = new Set<string>((progress.completed_node_ids as string[] | null) ?? []);

    const currentNode = nodes.find((node) => node.id === progress.current_node_id) ?? null;

    const evaluateNodeEligibility = (node: any) => {
      const rules = (node.unlock_rules ?? {}) as Record<string, number>;
      const minBond = Number(rules.min_bond_level ?? 0);
      const minStability = Number(rules.min_routine_stability_score ?? 0);
      const maxStability = Number(rules.max_routine_stability_score ?? 999);
      const minFatigue = Number(rules.min_request_fatigue ?? 0);
      const maxFatigue = Number(rules.max_request_fatigue ?? 999);

      const bond = Number(companion.bond_level ?? 0);
      const stability = Number(companion.routine_stability_score ?? 0);
      const fatigue = Number(companion.request_fatigue ?? 0);
      const blockedReasons: string[] = [];

      if (bond < minBond) blockedReasons.push(`min_bond_level:${minBond}`);
      if (stability < minStability) blockedReasons.push(`min_routine_stability_score:${minStability}`);
      if (stability > maxStability) blockedReasons.push(`max_routine_stability_score:${maxStability}`);
      if (fatigue < minFatigue) blockedReasons.push(`min_request_fatigue:${minFatigue}`);
      if (fatigue > maxFatigue) blockedReasons.push(`max_request_fatigue:${maxFatigue}`);

      return {
        eligible: blockedReasons.length === 0,
        blockedReasons,
      };
    };

    let nextNode = null as (typeof nodes[number] | null);

    if (!currentNode) {
      nextNode = nodes.find((node) => node.chapter_index === 1 && evaluateNodeEligibility(node).eligible) ?? nodes[0];
    } else {
      completedNodeIds.add(currentNode.id);

      const branchOutcomes = (currentNode.branch_outcomes ?? {}) as Record<string, string>;
      const targetKey = branchOutcomes[choiceKey];
      if (targetKey) {
        const requestedNode = nodes.find((node) => node.node_key === targetKey) ?? null;
        if (requestedNode) {
          const targetEligibility = evaluateNodeEligibility(requestedNode);
          if (targetEligibility.eligible) {
            nextNode = requestedNode;
          } else {
            return new Response(JSON.stringify({
              success: true,
              progressed: false,
              reason: "Branch requirements not met",
              choiceKey,
              nodeKey: requestedNode.node_key,
              blockedReasons: targetEligibility.blockedReasons,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      if (!nextNode) {
        nextNode = nodes.find((node) => {
          if (node.chapter_index <= currentNode.chapter_index) return false;
          return evaluateNodeEligibility(node).eligible;
        }) ?? null;
      }
    }

    if (!nextNode) {
      const unmetNode = nodes
        .filter((node) => !currentNode || node.chapter_index > currentNode.chapter_index)
        .map((node) => ({ node, status: evaluateNodeEligibility(node) }))
        .find((entry) => !entry.status.eligible) ?? null;

      return new Response(JSON.stringify({
        success: true,
        progressed: false,
        reason: "No eligible next chapter yet",
        nextBlockedNodeKey: unmetNode?.node.node_key ?? null,
        blockedReasons: unmetNode?.status.blockedReasons ?? [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    unlockedNodeIds.add(nextNode.id);

    const choiceHistory = Array.isArray(progress.choice_history) ? progress.choice_history : [];
    const recap = {
      chapter: Number(nextNode.chapter_index ?? 0),
      title: nextNode.title,
      summary: nextNode.summary,
      ambientTheme: nextNode.ambient_theme ?? null,
      branchLabel: choiceKey,
    };

    choiceHistory.push({
      at: new Date().toISOString(),
      fromNodeId: currentNode?.id ?? null,
      toNodeId: nextNode.id,
      choiceKey,
      recap,
    });

    const payload = {
      user_id: userId,
      companion_id: companion.id,
      current_node_id: nextNode.id,
      current_chapter: nextNode.chapter_index,
      unlocked_node_ids: Array.from(unlockedNodeIds),
      completed_node_ids: Array.from(completedNodeIds),
      choice_history: choiceHistory,
      last_advanced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (progress.id) {
      const { error: updateError } = await supabase
        .from("companion_campaign_progress")
        .update(payload)
        .eq("id", progress.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("companion_campaign_progress")
        .insert(payload);

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({
      success: true,
      progressed: true,
      node: {
        id: nextNode.id,
        nodeKey: nextNode.node_key,
        chapter: nextNode.chapter_index,
        title: nextNode.title,
        summary: nextNode.summary,
      },
      recap,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[advance-companion-campaign]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
