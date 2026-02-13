import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import type {
  CompanionCampaignBranchTarget,
  CompanionCampaignChoice,
  CompanionCampaignNode,
  CompanionCampaignProgress,
  CompanionCampaignRecapCard,
  CompanionHabitatItem,
  CompanionHabitatState,
  CompanionLifeSnapshot,
  CompanionRequestAnalytics,
  CompanionRequestCadence,
  CompanionRequest,
  CompanionRitual,
  CompanionRitualDef,
  CompanionSocialSnapshot,
  RequestEscalationLevel,
  RequestStatus,
} from "@/types/companionLife";
import { clamp, computeDayTick } from "@/utils/companionLifeEngine";

interface EdgeResponse<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

interface DayTickResult {
  success: boolean;
  ritualDate: string;
  ritualCount: number;
  currentEmotionalArc: string;
  routineStabilityScore: number;
  requestFatigue: number;
}

interface GenerateRequestsResult {
  success: boolean;
  generated: number;
  openCount: number;
  maxRequests?: number;
  cooldownActive?: boolean;
  cooldownSecondsRemaining?: number;
  reason?: string;
}

interface RequestResolvePayload {
  requestId: string;
  action: "accept" | "complete" | "decline" | "snooze";
}

interface HabitatAppearancePayload {
  biome?: string;
  ambiance?: string;
  qualityTier?: "high" | "medium" | "low";
}

interface EquipHabitatItemPayload {
  itemId: string;
  slot: "foreground" | "midground" | "background" | string;
}

interface RequestMetricsRow {
  status: RequestStatus;
  requested_at: string | null;
  resolved_at: string | null;
}

const defaultHabitatState: CompanionHabitatState = {
  biome: "cosmic_nest",
  ambiance: "serene",
  qualityTier: "medium",
  decorSlots: {
    foreground: null,
    midground: null,
    background: null,
  },
  unlockedThemes: ["cosmic_nest"],
  lastSceneState: {},
};

const STARTER_HABITAT_ITEMS = [
  {
    itemKey: "starter_starlit_lanterns",
    itemName: "Starlit Lanterns",
    slot: "foreground",
    rarity: "common",
    unlockSource: "starter_pack",
    metadata: { glow: "soft", color: "cyan" },
  },
  {
    itemKey: "starter_crystal_arch",
    itemName: "Crystal Arch",
    slot: "midground",
    rarity: "common",
    unlockSource: "starter_pack",
    metadata: { tone: "violet" },
  },
  {
    itemKey: "starter_aurora_skydome",
    itemName: "Aurora Skydome",
    slot: "background",
    rarity: "common",
    unlockSource: "starter_pack",
    metadata: { gradient: "aurora" },
  },
] as const;

const MAX_OPEN_REQUESTS = 3;

const isMissingRelationError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("does not exist") || message.toLowerCase().includes("relation");
};

const db = supabase as unknown as {
  from: (table: string) => any;
  functions: {
    invoke: (name: string, params?: { body?: unknown }) => Promise<EdgeResponse>;
  };
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const evaluateCampaignBranchEligibility = (
  unlockRules: Record<string, unknown>,
  companion: ReturnType<typeof useCompanion>["companion"],
): { eligible: boolean; blockedReasons: string[] } => {
  const blockedReasons: string[] = [];
  const companionBond = Number(companion?.bond_level ?? 0);
  const companionStability = Number(companion?.routine_stability_score ?? 0);
  const companionFatigue = Number(companion?.request_fatigue ?? 0);

  const minBondLevel = toFiniteNumber(unlockRules.min_bond_level);
  if (minBondLevel !== null && companionBond < minBondLevel) {
    blockedReasons.push(`Bond ${companionBond.toFixed(1)}/${minBondLevel.toFixed(1)} required`);
  }

  const minStability = toFiniteNumber(unlockRules.min_routine_stability_score);
  if (minStability !== null && companionStability < minStability) {
    blockedReasons.push(`Stability ${Math.round(companionStability)}/${Math.round(minStability)} required`);
  }

  const maxStability = toFiniteNumber(unlockRules.max_routine_stability_score);
  if (maxStability !== null && companionStability > maxStability) {
    blockedReasons.push(`Stability must stay at or below ${Math.round(maxStability)}`);
  }

  const minFatigue = toFiniteNumber(unlockRules.min_request_fatigue);
  if (minFatigue !== null && companionFatigue < minFatigue) {
    blockedReasons.push(`Fatigue ${companionFatigue.toFixed(1)}/${minFatigue.toFixed(1)} required`);
  }

  const maxFatigue = toFiniteNumber(unlockRules.max_request_fatigue);
  if (maxFatigue !== null && companionFatigue > maxFatigue) {
    blockedReasons.push(`Fatigue must stay at or below ${maxFatigue.toFixed(1)}`);
  }

  return {
    eligible: blockedReasons.length === 0,
    blockedReasons,
  };
};

export const useCompanionLife = () => {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);

  const lifeSnapshot = useMemo<CompanionLifeSnapshot>(() => {
    const fallback = computeDayTick({
      careScore: Number(companion?.care_score ?? 0.5),
      careConsistency: Number(companion?.care_consistency ?? 0.5),
      routineStabilityScore: Number(companion?.routine_stability_score ?? 50),
      requestFatigue: Number(companion?.request_fatigue ?? 0),
      isDormant: Boolean(companion?.dormant_since),
    });

    return {
      currentEmotionalArc: companion?.current_emotional_arc || fallback.emotionalArc,
      routineStabilityScore: Number(companion?.routine_stability_score ?? fallback.routineStabilityScore),
      requestFatigue: Number(companion?.request_fatigue ?? fallback.requestFatigue),
    };
  }, [companion]);

  const ritualsQuery = useQuery<CompanionRitual[]>({
    queryKey: ["companion-life-rituals", user?.id, companion?.id, today],
    enabled: !!user?.id && !!companion?.id,
    queryFn: async () => {
      if (!user?.id || !companion?.id) return [];

      try {
        const { data, error } = await db
          .from("companion_daily_rituals")
          .select(`
            id,
            ritual_date,
            status,
            urgency,
            completed_at,
            completion_context,
            ritual_def_id,
            companion_ritual_defs (
              id,
              code,
              title,
              description,
              ritual_type,
              base_bond_delta,
              base_care_delta,
              cooldown_hours
            )
          `)
          .eq("user_id", user.id)
          .eq("companion_id", companion.id)
          .eq("ritual_date", today)
          .order("created_at", { ascending: true });

        if (error) throw error;

        return (data ?? []).map((row: any) => {
          const defRow = row.companion_ritual_defs as any;
          const ritualDef: CompanionRitualDef | null = defRow
            ? {
                id: defRow.id,
                code: defRow.code,
                title: defRow.title,
                description: defRow.description,
                ritualType: defRow.ritual_type,
                baseBondDelta: Number(defRow.base_bond_delta ?? 1),
                baseCareDelta: Number(defRow.base_care_delta ?? 0.02),
                cooldownHours: Number(defRow.cooldown_hours ?? 0),
              }
            : null;

          return {
            id: row.id,
            ritualDate: row.ritual_date,
            status: row.status,
            urgency: row.urgency,
            completedAt: row.completed_at,
            completionContext: row.completion_context ?? {},
            ritualDefId: row.ritual_def_id,
            ritualDef,
          };
        });
      } catch (error) {
        if (!isMissingRelationError(error)) {
          console.warn("Failed to fetch companion rituals", error);
        }
        return [];
      }
    },
    staleTime: 30_000,
  });

  const requestsQuery = useQuery<CompanionRequest[]>({
    queryKey: ["companion-life-requests", user?.id, companion?.id],
    enabled: !!user?.id && !!companion?.id,
    queryFn: async () => {
      if (!user?.id || !companion?.id) return [];

      try {
        const { data, error } = await db
          .from("companion_requests")
          .select("id, request_type, title, prompt, urgency, status, due_at, requested_at, resolved_at, response_style, consequence_hint, request_context")
          .eq("user_id", user.id)
          .eq("companion_id", companion.id)
          .in("status", ["pending", "accepted", "snoozed"] as RequestStatus[])
          .order("due_at", { ascending: true, nullsFirst: false })
          .order("requested_at", { ascending: false });

        if (error) throw error;

        return (data ?? []).map((row: any) => ({
          id: row.id,
          requestType: row.request_type,
          title: row.title,
          prompt: row.prompt,
          urgency: row.urgency,
          status: row.status,
          dueAt: row.due_at,
          requestedAt: row.requested_at,
          resolvedAt: row.resolved_at,
          responseStyle: row.response_style,
          consequenceHint: row.consequence_hint,
          requestContext: row.request_context ?? {},
        }));
      } catch (error) {
        if (!isMissingRelationError(error)) {
          console.warn("Failed to fetch companion requests", error);
        }
        return [];
      }
    },
    staleTime: 15_000,
  });

  const requestMetricsQuery = useQuery<RequestMetricsRow[]>({
    queryKey: ["companion-life-request-metrics", user?.id, companion?.id],
    enabled: !!user?.id && !!companion?.id,
    queryFn: async () => {
      if (!user?.id || !companion?.id) return [];

      try {
        const { data, error } = await db
          .from("companion_requests")
          .select("status, requested_at, resolved_at")
          .eq("user_id", user.id)
          .eq("companion_id", companion.id)
          .order("requested_at", { ascending: false })
          .limit(250);

        if (error) throw error;
        return (data ?? []) as RequestMetricsRow[];
      } catch (error) {
        if (!isMissingRelationError(error)) {
          console.warn("Failed to fetch companion request metrics", error);
        }
        return [];
      }
    },
    staleTime: 60_000,
  });

  const requestAnalytics = useMemo<CompanionRequestAnalytics>(() => {
    const rows = requestMetricsQuery.data ?? [];
    const nowMs = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const resolvedStatuses = new Set<RequestStatus>(["completed", "declined", "expired"]);

    const resolvedRows = rows.filter((row) => {
      if (!resolvedStatuses.has(row.status)) return false;
      if (!row.resolved_at || !row.requested_at) return false;
      const resolvedMs = new Date(row.resolved_at).getTime();
      const requestedMs = new Date(row.requested_at).getTime();
      return !Number.isNaN(resolvedMs) && !Number.isNaN(requestedMs) && resolvedMs >= requestedMs;
    });

    const averageResponseMinutes = resolvedRows.length > 0
      ? Number(
        (
          resolvedRows.reduce((sum, row) => {
            const resolvedMs = new Date(row.resolved_at as string).getTime();
            const requestedMs = new Date(row.requested_at as string).getTime();
            return sum + (resolvedMs - requestedMs) / 60_000;
          }, 0) / resolvedRows.length
        ).toFixed(1),
      )
      : null;

    const rows30d = rows.filter((row) => {
      const anchor = row.resolved_at ?? row.requested_at;
      if (!anchor) return false;
      const anchorMs = new Date(anchor).getTime();
      return !Number.isNaN(anchorMs) && (nowMs - anchorMs) <= THIRTY_DAYS_MS;
    });

    const resolvedCount30d = rows30d.filter((row) => resolvedStatuses.has(row.status)).length;
    const completedCount30d = rows30d.filter((row) => row.status === "completed").length;
    const completionRate30d = resolvedCount30d > 0
      ? Number(((completedCount30d / resolvedCount30d) * 100).toFixed(1))
      : null;

    const completionDaySet = new Set(
      rows
        .filter((row) => row.status === "completed" && row.resolved_at)
        .map((row) => {
          const resolvedMs = new Date(row.resolved_at as string).getTime();
          if (Number.isNaN(resolvedMs)) return null;
          return new Date(resolvedMs).toISOString().slice(0, 10);
        })
        .filter((day): day is string => !!day),
    );
    const completionDays = Array.from(completionDaySet).sort((a, b) => b.localeCompare(a));

    let completionStreakDays = 0;
    if (completionDays.length > 0) {
      completionStreakDays = 1;
      let cursor = new Date(`${completionDays[0]}T00:00:00.000Z`);
      for (let index = 1; index < completionDays.length; index += 1) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        const previousKey = cursor.toISOString().slice(0, 10);
        if (completionDays[index] !== previousKey) break;
        completionStreakDays += 1;
      }
    }

    return {
      averageResponseMinutes,
      completionStreakDays,
      completionRate30d,
      resolvedCount30d,
      completedCount30d,
    };
  }, [requestMetricsQuery.data]);

  const requestCadence = useMemo<CompanionRequestCadence>(() => {
    const requests = requestsQuery.data ?? [];
    const now = Date.now();
    let overdueCount = 0;
    let nextDueAt: string | null = null;
    const urgencyCounts: CompanionRequestCadence["urgencyCounts"] = {
      gentle: 0,
      important: 0,
      critical: 0,
    };

    requests.forEach((request) => {
      const urgency = request.urgency;
      if (urgency in urgencyCounts) {
        urgencyCounts[urgency] += 1;
      }

      if (!request.dueAt) return;
      const dueMs = new Date(request.dueAt).getTime();
      if (Number.isNaN(dueMs)) return;

      if (dueMs < now) {
        overdueCount += 1;
      }

      if (!nextDueAt || dueMs < new Date(nextDueAt).getTime()) {
        nextDueAt = request.dueAt;
      }
    });

    const careScore = clamp(Number(companion?.care_score ?? 0.5), 0, 1);
    const careConsistency = clamp(Number(companion?.care_consistency ?? 0.5), 0, 1);
    const requestFatigue = clamp(Number(companion?.request_fatigue ?? lifeSnapshot.requestFatigue), 0, 10);
    const escalationPressure = Number(((1 - careScore) + requestFatigue * 0.065 + (1 - careConsistency) * 0.35).toFixed(2));
    const openRequests = requests.length;
    const slotsAvailable = Math.max(0, MAX_OPEN_REQUESTS - openRequests);
    const cooldownActive = slotsAvailable === 0;
    const desiredRequestCount = escalationPressure >= 1.15 ? 3 : escalationPressure >= 0.7 ? 2 : 1;
    const recommendedNewRequests = Math.min(desiredRequestCount, slotsAvailable);

    let escalationLevel: RequestEscalationLevel = "stable";
    if (overdueCount > 0 || urgencyCounts.critical > 0 || escalationPressure >= 0.95) {
      escalationLevel = "critical";
    } else if (urgencyCounts.important >= 2 || escalationPressure >= 0.55) {
      escalationLevel = "watch";
    }

    return {
      maxOpenRequests: MAX_OPEN_REQUESTS,
      openRequests,
      slotsAvailable,
      cooldownActive,
      nextDueAt,
      overdueCount,
      urgencyCounts,
      escalationPressure,
      escalationLevel,
      recommendedNewRequests,
    };
  }, [companion?.care_score, companion?.care_consistency, companion?.request_fatigue, lifeSnapshot.requestFatigue, requestsQuery.data]);

  const habitatQuery = useQuery<CompanionHabitatState>({
    queryKey: ["companion-habitat-state", user?.id, companion?.id],
    enabled: !!user?.id && !!companion?.id,
    queryFn: async () => {
      if (!user?.id || !companion?.id) return defaultHabitatState;

      try {
        const { data, error } = await db
          .from("companion_habitat_state")
          .select("biome, ambiance, quality_tier, decor_slots, unlocked_themes, last_scene_state")
          .eq("user_id", user.id)
          .eq("companion_id", companion.id)
          .maybeSingle();

        if (error) throw error;

        if (!data) return defaultHabitatState;

        return {
          biome: data.biome,
          ambiance: data.ambiance,
          qualityTier: data.quality_tier,
          decorSlots: data.decor_slots ?? defaultHabitatState.decorSlots,
          unlockedThemes: data.unlocked_themes ?? defaultHabitatState.unlockedThemes,
          lastSceneState: data.last_scene_state ?? {},
        };
      } catch (error) {
        if (!isMissingRelationError(error)) {
          console.warn("Failed to fetch habitat state", error);
        }
        return defaultHabitatState;
      }
    },
    staleTime: 60_000,
  });

  const habitatItemsQuery = useQuery<CompanionHabitatItem[]>({
    queryKey: ["companion-habitat-items", user?.id, companion?.id],
    enabled: !!user?.id && !!companion?.id,
    queryFn: async () => {
      if (!user?.id || !companion?.id) return [];

      try {
        const { data, error } = await db
          .from("companion_habitat_items")
          .select("id, item_key, item_name, slot, rarity, is_equipped, unlock_source, metadata")
          .eq("user_id", user.id)
          .eq("companion_id", companion.id)
          .order("acquired_at", { ascending: true });

        if (error) throw error;

        return (data ?? []).map((row: any) => ({
          id: row.id,
          itemKey: row.item_key,
          itemName: row.item_name,
          slot: row.slot,
          rarity: row.rarity,
          isEquipped: Boolean(row.is_equipped),
          unlockSource: row.unlock_source ?? null,
          metadata: row.metadata ?? {},
        }));
      } catch (error) {
        if (!isMissingRelationError(error)) {
          console.warn("Failed to fetch habitat items", error);
        }
        return [];
      }
    },
    staleTime: 30_000,
  });

  const campaignQuery = useQuery<CompanionCampaignProgress | null>({
    queryKey: ["companion-campaign-progress", user?.id, companion?.id],
    enabled: !!user?.id && !!companion?.id,
    queryFn: async () => {
      if (!user?.id || !companion?.id) return null;

      try {
        const { data: progress, error } = await db
          .from("companion_campaign_progress")
          .select("id, current_node_id, current_chapter, unlocked_node_ids, completed_node_ids, choice_history")
          .eq("user_id", user.id)
          .eq("companion_id", companion.id)
          .maybeSingle();

        if (error) throw error;
        if (!progress) return null;

        const { data: nodes, error: nodesError } = await db
          .from("companion_campaign_nodes")
          .select("id, node_key, chapter_index, title, summary, unlock_rules, branch_group, branch_outcomes, ambient_theme")
          .order("chapter_index", { ascending: true });

        if (nodesError) throw nodesError;

        const campaignNodes: CompanionCampaignNode[] = (nodes ?? []).map((node: any) => ({
          id: node.id,
          nodeKey: node.node_key,
          chapterIndex: Number(node.chapter_index ?? 0),
          title: node.title,
          summary: node.summary,
          unlockRules: node.unlock_rules ?? {},
          branchGroup: node.branch_group ?? null,
          branchOutcomes: node.branch_outcomes ?? {},
          ambientTheme: node.ambient_theme ?? null,
        }));

        const nodeById = new Map(campaignNodes.map((node) => [node.id, node]));
        const currentNode = progress.current_node_id
          ? nodeById.get(progress.current_node_id) ?? null
          : null;

        const rawChoiceHistory = Array.isArray(progress.choice_history) ? progress.choice_history : [];
        const choiceHistory = rawChoiceHistory
          .map((entry: any): CompanionCampaignChoice | null => {
            if (!entry || typeof entry !== "object") return null;

            const toNodeId = typeof entry.toNodeId === "string" ? entry.toNodeId : null;
            if (!toNodeId) return null;

            const choiceKey = typeof entry.choiceKey === "string" ? entry.choiceKey : "steady";
            const fromNodeId = typeof entry.fromNodeId === "string" ? entry.fromNodeId : null;
            const at = typeof entry.at === "string" ? entry.at : new Date(0).toISOString();

            const recapSource = entry.recap && typeof entry.recap === "object"
              ? (entry.recap as Record<string, unknown>)
              : null;

            let recap: CompanionCampaignChoice["recap"];
            if (recapSource) {
              const chapter = Number(recapSource.chapter ?? 0);
              const title = typeof recapSource.title === "string" ? recapSource.title : "";
              const summary = typeof recapSource.summary === "string" ? recapSource.summary : "";
              const ambientTheme = typeof recapSource.ambientTheme === "string"
                ? recapSource.ambientTheme
                : null;
              const branchLabel = typeof recapSource.branchLabel === "string"
                ? recapSource.branchLabel
                : choiceKey;

              if (chapter > 0 && title.length > 0 && summary.length > 0) {
                recap = {
                  chapter,
                  title,
                  summary,
                  ambientTheme,
                  branchLabel,
                };
              }
            }

            return {
              at,
              fromNodeId,
              toNodeId,
              choiceKey,
              recap,
            };
          })
          .filter((entry): entry is CompanionCampaignChoice => entry !== null);

        const recapCards = choiceHistory
          .map((entry, index): CompanionCampaignRecapCard => {
            const toNode = nodeById.get(entry.toNodeId);
            const fromNode = entry.fromNodeId ? nodeById.get(entry.fromNodeId) : null;
            const fallbackChapter = toNode?.chapterIndex ?? index + 1;
            const fallbackTitle = toNode?.title ?? `Chapter ${fallbackChapter} Milestone`;
            const fallbackSummary = toNode?.summary ?? "Your bond shifted through this chapter choice.";

            return {
              id: `${entry.toNodeId}:${entry.at}:${index}`,
              at: entry.at,
              chapter: entry.recap?.chapter ?? fallbackChapter,
              title: entry.recap?.title ?? fallbackTitle,
              summary: entry.recap?.summary ?? fallbackSummary,
              ambientTheme: entry.recap?.ambientTheme ?? toNode?.ambientTheme ?? null,
              choiceKey: entry.choiceKey,
              fromNodeTitle: fromNode?.title ?? null,
              toNodeId: entry.toNodeId,
            };
          })
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

        const availableBranches: CompanionCampaignBranchTarget[] = currentNode
          ? Object.entries(currentNode.branchOutcomes ?? {}).map(([choiceKey, toNodeKey]) => {
              const targetNode = campaignNodes.find((node) => node.nodeKey === toNodeKey) ?? null;
              if (!targetNode) {
                return {
                  choiceKey,
                  toNodeKey,
                  toNodeId: null,
                  toNodeTitle: null,
                  toNodeChapter: null,
                  unlockRules: {},
                  eligible: false,
                  blockedReasons: ["Branch target unavailable"],
                };
              }

              const eligibility = evaluateCampaignBranchEligibility(targetNode.unlockRules, companion);
              return {
                choiceKey,
                toNodeKey,
                toNodeId: targetNode.id,
                toNodeTitle: targetNode.title,
                toNodeChapter: targetNode.chapterIndex,
                unlockRules: targetNode.unlockRules,
                eligible: eligibility.eligible,
                blockedReasons: eligibility.blockedReasons,
              };
            })
          : [];

        return {
          id: progress.id,
          currentNodeId: progress.current_node_id,
          currentChapter: Number(progress.current_chapter ?? 0),
          unlockedNodeIds: progress.unlocked_node_ids ?? [],
          completedNodeIds: progress.completed_node_ids ?? [],
          choiceHistory,
          recapCards,
          currentNode,
          availableChoices: availableBranches.map((branch) => branch.choiceKey),
          availableBranches,
        };
      } catch (error) {
        if (!isMissingRelationError(error)) {
          console.warn("Failed to fetch campaign progress", error);
        }
        return null;
      }
    },
    staleTime: 30_000,
  });

  const snapshotsQuery = useQuery<CompanionSocialSnapshot[]>({
    queryKey: ["companion-social-snapshots", user?.id, companion?.id],
    enabled: !!user?.id && !!companion?.id,
    queryFn: async () => {
      if (!user?.id || !companion?.id) return [];

      try {
        const { data, error } = await db
          .from("companion_social_snapshots")
          .select("id, headline, visibility, published_at, snapshot_type, snapshot_payload")
          .eq("user_id", user.id)
          .eq("companion_id", companion.id)
          .order("published_at", { ascending: false })
          .limit(5);

        if (error) throw error;

        return (data ?? []).map((row: any) => ({
          id: row.id,
          headline: row.headline,
          visibility: row.visibility,
          publishedAt: row.published_at,
          snapshotType: row.snapshot_type,
          snapshotPayload: row.snapshot_payload ?? null,
        }));
      } catch (error) {
        if (!isMissingRelationError(error)) {
          console.warn("Failed to fetch companion social snapshots", error);
        }
        return [];
      }
    },
  });

  const processDayTick = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.functions.invoke("process-companion-day-tick", {
        body: { date: today },
      });
      if (error) throw new Error(error.message);
      return data as DayTickResult;
    },
    onSuccess: () => {
      toast.success("Day rituals refreshed");
      queryClient.invalidateQueries({ queryKey: ["companion-life-rituals"] });
      queryClient.invalidateQueries({ queryKey: ["companion", user?.id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to process day tick");
    },
  });

  const generateRequests = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.functions.invoke("generate-companion-requests", {
        body: { maxRequests: 3 },
      });
      if (error) throw new Error(error.message);
      return (data ?? null) as GenerateRequestsResult | null;
    },
    onSuccess: (result) => {
      const generated = Number(result?.generated ?? 0);
      const reason = result?.reason ?? null;
      const cooldownSecondsRemaining = Number(result?.cooldownSecondsRemaining ?? 0);

      if (generated > 0) {
        toast.success(`${generated} companion request${generated === 1 ? "" : "s"} generated`);
      } else if (reason === "generation_cooldown" && cooldownSecondsRemaining > 0) {
        const minutes = Math.ceil(cooldownSecondsRemaining / 60);
        toast.message(`Request generation cooling down (${minutes}m remaining)`);
      } else if (reason === "max_open_requests") {
        toast.message("Resolve current requests before generating more");
      } else {
        toast.message("No new requests generated");
      }
      queryClient.invalidateQueries({ queryKey: ["companion-life-requests"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to generate requests");
    },
  });

  const resolveRequest = useMutation({
    mutationFn: async (payload: RequestResolvePayload) => {
      const { data, error } = await db.functions.invoke("resolve-companion-request", {
        body: payload,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-life-requests"] });
      queryClient.invalidateQueries({ queryKey: ["companion", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["companion-memories"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to resolve request");
    },
  });

  const completeRitual = useMutation({
    mutationFn: async (dailyRitualId: string) => {
      const { data, error } = await db.functions.invoke("complete-companion-ritual", {
        body: { dailyRitualId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("Ritual completed");
      queryClient.invalidateQueries({ queryKey: ["companion-life-rituals"] });
      queryClient.invalidateQueries({ queryKey: ["companion", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["companion-memories"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to complete ritual");
    },
  });

  const advanceCampaign = useMutation({
    mutationFn: async (choiceKey?: string) => {
      const { data, error } = await db.functions.invoke("advance-companion-campaign", {
        body: { choiceKey },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (result: any) => {
      if (result?.progressed) {
        toast.success("Campaign advanced");
      } else {
        const reason = typeof result?.reason === "string" ? result.reason : "No eligible chapter yet";
        toast.message(reason);
      }
      queryClient.invalidateQueries({ queryKey: ["companion-campaign-progress"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to advance campaign");
    },
  });

  const publishSnapshot = useMutation({
    mutationFn: async (payload?: { visibility?: "friends" | "private" | "public"; headline?: string }) => {
      const { data, error } = await db.functions.invoke("publish-companion-snapshot", {
        body: payload ?? {},
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("Snapshot published");
      queryClient.invalidateQueries({ queryKey: ["companion-social-snapshots"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to publish snapshot");
    },
  });

  const setHabitatAppearance = useMutation({
    mutationFn: async (payload: HabitatAppearancePayload) => {
      if (!user?.id || !companion?.id) {
        throw new Error("Companion not ready");
      }

      const currentHabitat = habitatQuery.data ?? defaultHabitatState;
      const biome = payload.biome ?? currentHabitat.biome;
      const ambiance = payload.ambiance ?? currentHabitat.ambiance;
      const qualityTier = payload.qualityTier ?? currentHabitat.qualityTier;

      const { error } = await db
        .from("companion_habitat_state")
        .upsert({
          user_id: user.id,
          companion_id: companion.id,
          biome,
          ambiance,
          quality_tier: qualityTier,
          decor_slots: currentHabitat.decorSlots,
          unlocked_themes: currentHabitat.unlockedThemes.length > 0 ? currentHabitat.unlockedThemes : ["cosmic_nest"],
          last_scene_state: currentHabitat.lastSceneState,
        }, {
          onConflict: "companion_id",
        });

      if (error) throw error;

      const { error: companionUpdateError } = await db
        .from("user_companion")
        .update({
          habitat_theme: biome,
        })
        .eq("id", companion.id)
        .eq("user_id", user.id);

      if (companionUpdateError) throw companionUpdateError;
    },
    onSuccess: () => {
      toast.success("Habitat updated");
      queryClient.invalidateQueries({ queryKey: ["companion-habitat-state"] });
      queryClient.invalidateQueries({ queryKey: ["companion", user?.id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update habitat");
    },
  });

  const seedStarterHabitatItems = useMutation({
    mutationFn: async () => {
      if (!user?.id || !companion?.id) {
        throw new Error("Companion not ready");
      }

      const { data: existing, error: lookupError } = await db
        .from("companion_habitat_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("companion_id", companion.id)
        .limit(1);

      if (lookupError) throw lookupError;
      if ((existing ?? []).length > 0) return { inserted: 0 };

      const starterDecorSlots = STARTER_HABITAT_ITEMS.reduce<Record<string, string>>((acc, item) => {
        acc[item.slot] = item.itemKey;
        return acc;
      }, {});

      const rows = STARTER_HABITAT_ITEMS.map((item) => ({
        user_id: user.id,
        companion_id: companion.id,
        item_key: item.itemKey,
        item_name: item.itemName,
        slot: item.slot,
        rarity: item.rarity,
        is_equipped: true,
        unlock_source: item.unlockSource,
        metadata: item.metadata,
      }));

      const { error } = await db
        .from("companion_habitat_items")
        .insert(rows);

      if (error) throw error;

      const currentHabitat = habitatQuery.data ?? defaultHabitatState;
      const { error: habitatError } = await db
        .from("companion_habitat_state")
        .upsert({
          user_id: user.id,
          companion_id: companion.id,
          biome: currentHabitat.biome,
          ambiance: currentHabitat.ambiance,
          quality_tier: currentHabitat.qualityTier,
          decor_slots: {
            ...currentHabitat.decorSlots,
            ...starterDecorSlots,
          },
          unlocked_themes: currentHabitat.unlockedThemes.length > 0 ? currentHabitat.unlockedThemes : ["cosmic_nest"],
          last_scene_state: currentHabitat.lastSceneState,
        }, {
          onConflict: "companion_id",
        });

      if (habitatError) throw habitatError;
      return { inserted: rows.length };
    },
    onSuccess: (result) => {
      if (result.inserted > 0) {
        toast.success("Starter decor unlocked");
      }
      queryClient.invalidateQueries({ queryKey: ["companion-habitat-items"] });
      queryClient.invalidateQueries({ queryKey: ["companion-habitat-state"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to seed starter habitat items");
    },
  });

  const equipHabitatItem = useMutation({
    mutationFn: async ({ itemId, slot }: EquipHabitatItemPayload) => {
      if (!user?.id || !companion?.id) {
        throw new Error("Companion not ready");
      }

      const { error: clearError } = await db
        .from("companion_habitat_items")
        .update({ is_equipped: false })
        .eq("user_id", user.id)
        .eq("companion_id", companion.id)
        .eq("slot", slot);

      if (clearError) throw clearError;

      const { data: target, error: targetError } = await db
        .from("companion_habitat_items")
        .update({ is_equipped: true, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("user_id", user.id)
        .eq("companion_id", companion.id)
        .select("item_key, slot")
        .single();

      if (targetError) throw targetError;

      const currentHabitat = habitatQuery.data ?? defaultHabitatState;
      const nextDecorSlots = {
        ...currentHabitat.decorSlots,
        [target.slot]: target.item_key,
      };

      const { error: habitatError } = await db
        .from("companion_habitat_state")
        .upsert({
          user_id: user.id,
          companion_id: companion.id,
          biome: currentHabitat.biome,
          ambiance: currentHabitat.ambiance,
          quality_tier: currentHabitat.qualityTier,
          decor_slots: nextDecorSlots,
          unlocked_themes: currentHabitat.unlockedThemes.length > 0 ? currentHabitat.unlockedThemes : ["cosmic_nest"],
          last_scene_state: currentHabitat.lastSceneState,
        }, {
          onConflict: "companion_id",
        });

      if (habitatError) throw habitatError;
    },
    onSuccess: () => {
      toast.success("Decor equipped");
      queryClient.invalidateQueries({ queryKey: ["companion-habitat-items"] });
      queryClient.invalidateQueries({ queryKey: ["companion-habitat-state"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to equip decor");
    },
  });

  return {
    today,
    lifeSnapshot,
    rituals: ritualsQuery.data ?? [],
    requests: requestsQuery.data ?? [],
    requestCadence,
    requestAnalytics,
    habitat: habitatQuery.data ?? defaultHabitatState,
    habitatItems: habitatItemsQuery.data ?? [],
    campaignProgress: campaignQuery.data,
    snapshots: snapshotsQuery.data ?? [],
    isLoading: ritualsQuery.isLoading || requestsQuery.isLoading || habitatQuery.isLoading || habitatItemsQuery.isLoading || campaignQuery.isLoading,
    processDayTick,
    generateRequests,
    resolveRequest,
    completeRitual,
    advanceCampaign,
    publishSnapshot,
    setHabitatAppearance,
    seedStarterHabitatItems,
    equipHabitatItem,
  };
};
