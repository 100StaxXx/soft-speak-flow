import { supabase } from "@/integrations/supabase/client";
import { parseFunctionInvokeError } from "@/utils/supabaseFunctionErrors";

export type CompanionCinemaInteractionType = "watch" | "hunt" | "forge";

export interface CompanionCinemaReward {
  type?: string;
  title?: string;
  description?: string;
  element?: string;
  level?: number;
  awardedAt?: string;
}

export interface CompanionCinemaEventSummary {
  id: string;
  status: string;
  ready_at?: string | null;
  revealed_at?: string | null;
  reveal_copy?: string | null;
  title?: string | null;
}

export interface CompanionCinemaInteractionRun {
  id: string;
  interaction_type: CompanionCinemaInteractionType;
  status: string;
  title?: string | null;
  intention?: string | null;
  cinema_event_id?: string | null;
  completion_cinema_event_id?: string | null;
  reward?: CompanionCinemaReward | null;
  expected_complete_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  start_event?: CompanionCinemaEventSummary | CompanionCinemaEventSummary[] | null;
  completion_event?: CompanionCinemaEventSummary | CompanionCinemaEventSummary[] | null;
}

export interface CompanionCinemaReveal {
  eventId: string;
  status: string;
  ready: boolean;
  eventType?: string;
  title?: string;
  revealCopy?: string | null;
  durationSeconds?: number;
  videoUrl?: string;
  reward?: CompanionCinemaReward | null;
}

export const resolveCinemaEventSummary = (
  value: CompanionCinemaEventSummary | CompanionCinemaEventSummary[] | null | undefined,
): CompanionCinemaEventSummary | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(
    "manage-companion-cinema-interaction",
    { body },
  );
  if (error) {
    const parsed = await parseFunctionInvokeError(error);
    const serverMessage = parsed.responsePayload?.error ??
      parsed.responsePayload?.message ?? parsed.backendMessage;
    throw new Error(
      serverMessage ??
        "Companion cinema is temporarily unavailable. Please try again.",
    );
  }
  return data as T;
};

export const startCompanionCinemaInteraction = async ({
  interactionType,
  intention,
  expectedMinutes,
}: {
  interactionType: CompanionCinemaInteractionType;
  intention?: string | null;
  expectedMinutes?: number;
}): Promise<{
  run: CompanionCinemaInteractionRun;
  reused?: boolean;
  quota?: { dailyRemaining: number; monthlyRemaining: number };
}> =>
  await invoke({
    action: "start",
    interactionType,
    intention: intention ?? null,
    expectedMinutes,
  });

export const completeCompanionCinemaInteraction = async ({
  runId,
  completed,
  outcome,
}: {
  runId: string;
  completed: boolean;
  outcome?: Record<string, unknown>;
}): Promise<{ run: CompanionCinemaInteractionRun | null }> =>
  await invoke({
    action: completed ? "complete" : "cancel",
    runId,
    outcome: outcome ?? {},
  });

export const getCompanionCinemaInteractionStatus = async (
  runId: string,
): Promise<{ run: (CompanionCinemaInteractionRun & {
  start_event?: CompanionCinemaEventSummary | CompanionCinemaEventSummary[] | null;
  completion_event?: CompanionCinemaEventSummary | CompanionCinemaEventSummary[] | null;
}) | null; available?: boolean }> => await invoke({ action: "status", runId });

export const getCompanionCinemaHistory = async (): Promise<{
  available?: boolean;
  runs: CompanionCinemaInteractionRun[];
}> => await invoke({ action: "history" });

export const revealCompanionCinemaEvent = async (
  eventId: string,
): Promise<CompanionCinemaReveal> =>
  await invoke({ action: "reveal", eventId });
