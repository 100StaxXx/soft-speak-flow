import type { SupabaseClientLike } from "../_shared/costGuardrails.ts";
import type {
  PlannerBuildInput,
  PlannerSessionState,
} from "./planner.ts";

export type DeletedPlannerEntityType = "campaign" | "ritual" | "habit" | "task";

export interface DeletedPlannerEntity {
  entityType: DeletedPlannerEntityType;
  entityId: string | null;
  title: string | null;
}

const MIN_TITLE_MATCH_LENGTH = 3;

const normalizeTitle = (value: string | null | undefined): string | null => {
  const title = value?.trim();
  return title ? title : null;
};

const normalizeEntityType = (
  value: unknown,
): DeletedPlannerEntityType | null => {
  if (value === "epic") return "campaign";
  return value === "campaign" ||
      value === "ritual" ||
      value === "habit" ||
      value === "task"
    ? value
    : null;
};

export const loadDeletedPlannerEntities = async (
  supabase: SupabaseClientLike,
  userId: string,
): Promise<DeletedPlannerEntity[]> => {
  try {
    const { data, error } = await supabase
      .from("deleted_planner_entities")
      .select("entity_type, entity_id, title")
      .eq("user_id", userId)
      .order("deleted_at", { ascending: false })
      .limit(300);
    if (error) throw error;

    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    return rows.reduce<DeletedPlannerEntity[]>((entities, row) => {
      const record = row as Record<string, unknown>;
      const entityType = normalizeEntityType(record.entity_type);
      const entityId = typeof record.entity_id === "string"
        ? record.entity_id
        : null;
      const title = normalizeTitle(record.title as string | null | undefined);
      if (!entityType || (!entityId && !title)) return entities;
      entities.push({ entityType, entityId, title });
      return entities;
    }, []);
  } catch (error) {
    console.warn("[companion-planner-chat] deleted planner memory load failed", {
      userId,
      error,
    });
    return [];
  }
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildAllowedTitleSet = (
  allowedTitles?: Iterable<string | null | undefined>,
) =>
  new Set(
    Array.from(allowedTitles ?? [])
      .map((title) => title?.trim().toLowerCase() ?? "")
      .filter(Boolean),
  );

export const sanitizeTextForDeletedPlannerEntities = (
  text: string | null | undefined,
  deletedEntities: DeletedPlannerEntity[] | null | undefined,
  allowedTitles?: Iterable<string | null | undefined>,
): string => {
  let nextText = text ?? "";
  if (!nextText || !deletedEntities || deletedEntities.length === 0) {
    return nextText;
  }

  const allowedTitleSet = buildAllowedTitleSet(allowedTitles);

  deletedEntities.forEach((entity) => {
    if (entity.entityId) {
      nextText = nextText.replace(
        new RegExp(escapeRegExp(entity.entityId), "gi"),
        "[deleted planner id]",
      );
    }

    const title = entity.title?.trim();
    if (
      !title ||
      title.length < MIN_TITLE_MATCH_LENGTH ||
      allowedTitleSet.has(title.toLowerCase())
    ) {
      return;
    }

    nextText = nextText.replace(
      new RegExp(escapeRegExp(title), "gi"),
      "[deleted planner item]",
    );
  });

  return nextText;
};

export const collectAllowedPlannerTitles = (
  context: PlannerBuildInput["plannerContext"],
): string[] =>
  Array.from(
    new Set([
      ...context.activeEpics.map((epic) => epic.title),
      ...context.rituals.map((ritual) => ritual.title),
      ...context.tasks.map((task) => task.title),
      ...context.inboxTasks.map((task) => task.title),
      ...(context.recentCompletedTasks ?? []).map((task) => task.title),
    ].filter((title): title is string => Boolean(title?.trim()))),
  );

export const sanitizeConversationHistoryForDeletedPlannerEntities = (
  history: PlannerBuildInput["conversationHistory"],
  deletedEntities: DeletedPlannerEntity[] | null | undefined,
  allowedTitles?: Iterable<string | null | undefined>,
): PlannerBuildInput["conversationHistory"] =>
  history.map((entry) => ({
    ...entry,
    content: sanitizeTextForDeletedPlannerEntities(
      entry.content,
      deletedEntities,
      allowedTitles,
    ),
  }));

export const sanitizeSessionStateForDeletedPlannerEntities = (
  sessionState: PlannerSessionState,
  deletedEntities: DeletedPlannerEntity[] | null | undefined,
  allowedTitles?: Iterable<string | null | undefined>,
): PlannerSessionState => {
  const sourceMessage = sessionState.planningConsent?.sourceMessage;
  if (!sourceMessage) return sessionState;

  return {
    ...sessionState,
    planningConsent: sessionState.planningConsent
      ? {
        ...sessionState.planningConsent,
        sourceMessage: sanitizeTextForDeletedPlannerEntities(
          sourceMessage,
          deletedEntities,
          allowedTitles,
        ),
      }
      : sessionState.planningConsent,
  };
};

export const isDeletedPlannerEntityReference = (
  reference: {
    entityType?: DeletedPlannerEntityType | "epic" | null;
    entityId?: string | null;
    title?: string | null;
  },
  deletedEntities: DeletedPlannerEntity[] | null | undefined,
  allowedTitles?: Iterable<string | null | undefined>,
): boolean => {
  if (!deletedEntities || deletedEntities.length === 0) return false;
  const entityType = normalizeEntityType(reference.entityType);
  const entityId = reference.entityId?.trim() || null;
  const title = normalizeTitle(reference.title);
  const allowedTitleSet = buildAllowedTitleSet(allowedTitles);

  return deletedEntities.some((entity) => {
    if (entityType && entity.entityType !== entityType) return false;
    if (entityId && entity.entityId === entityId) return true;
    if (!title || allowedTitleSet.has(title.toLowerCase())) return false;
    return entity.title?.trim().toLowerCase() === title.toLowerCase();
  });
};
