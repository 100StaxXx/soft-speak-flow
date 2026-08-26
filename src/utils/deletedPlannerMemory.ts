import { supabase } from "@/integrations/supabase/client";
import { productScopedStorageKey } from "@/config/productRuntime";

export type DeletedPlannerEntityType = "campaign" | "ritual" | "habit" | "task";

export interface DeletedPlannerEntity {
  entityType: DeletedPlannerEntityType;
  entityId?: string | null;
  title?: string | null;
  deletedAt?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}

type RpcDeletedPlannerEntity = {
  entity_type: DeletedPlannerEntityType;
  entity_id?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown>;
};

export const DELETED_PLANNER_MEMORY_EVENT = productScopedStorageKey(
  "deleted-planner-memory-updated",
);

const STORAGE_PREFIX = `${productScopedStorageKey("deleted-planner-entities:v1")}:`;
const MAX_LOCAL_TOMBSTONES = 300;
const MIN_TITLE_MATCH_LENGTH = 3;

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    return storage &&
        typeof storage.getItem === "function" &&
        typeof storage.setItem === "function"
      ? storage
      : null;
  } catch {
    return null;
  }
};

const normalizeTitle = (value: string | null | undefined): string | null => {
  const title = value?.trim();
  return title ? title : null;
};

const normalizeEntityId = (value: string | null | undefined): string | null => {
  const id = value?.trim();
  return id ? id : null;
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

const normalizeDeletedPlannerEntity = (
  entity: DeletedPlannerEntity | Record<string, unknown>,
): DeletedPlannerEntity | null => {
  const rawEntity = entity as Record<string, unknown>;
  const entityType = normalizeEntityType(
    rawEntity.entityType ?? rawEntity.entity_type,
  );
  if (!entityType) return null;

  const entityId = normalizeEntityId(
    (rawEntity.entityId ?? rawEntity.entity_id) as
      | string
      | null
      | undefined,
  );
  const title = normalizeTitle(entity.title as string | null | undefined);
  if (!entityId && !title) return null;

  const deletedAt = normalizeTitle(
    (rawEntity.deletedAt ?? rawEntity.deleted_at) as
      | string
      | null
      | undefined,
  ) ?? new Date().toISOString();

  const rawMetadata = entity.metadata;
  const metadata = rawMetadata && typeof rawMetadata === "object" &&
      !Array.isArray(rawMetadata)
    ? rawMetadata as Record<string, unknown>
    : null;

  return {
    entityType,
    entityId,
    title,
    deletedAt,
    source: normalizeTitle(entity.source as string | null | undefined),
    metadata,
  };
};

const dedupeKey = (entity: DeletedPlannerEntity) =>
  entity.entityId
    ? `${entity.entityType}:id:${entity.entityId}`
    : `${entity.entityType}:title:${(entity.title ?? "").trim().toLowerCase()}`;

export const normalizeDeletedPlannerEntities = (
  entities: Array<DeletedPlannerEntity | Record<string, unknown>>,
): DeletedPlannerEntity[] => {
  const byKey = new Map<string, DeletedPlannerEntity>();
  entities
    .map(normalizeDeletedPlannerEntity)
    .filter((entity): entity is DeletedPlannerEntity => Boolean(entity))
    .forEach((entity) => {
      const key = dedupeKey(entity);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, entity);
        return;
      }

      byKey.set(key, {
        ...existing,
        ...entity,
        metadata: {
          ...(existing.metadata ?? {}),
          ...(entity.metadata ?? {}),
        },
      });
    });

  return Array.from(byKey.values());
};

export const readLocalDeletedPlannerEntities = (
  userId: string,
): DeletedPlannerEntity[] => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? normalizeDeletedPlannerEntities(parsed as Record<string, unknown>[])
      : [];
  } catch {
    return [];
  }
};

const writeLocalDeletedPlannerEntities = (
  userId: string,
  entities: DeletedPlannerEntity[],
) => {
  const storage = getStorage();
  if (!storage) return;

  const trimmed = entities
    .slice()
    .sort((left, right) =>
      (right.deletedAt ?? "").localeCompare(left.deletedAt ?? "")
    )
    .slice(0, MAX_LOCAL_TOMBSTONES);
  try {
    storage.setItem(storageKey(userId), JSON.stringify(trimmed));
  } catch {
    // Local tombstones are a best-effort offline cache; the RPC remains authoritative.
  }
};

export const dispatchDeletedPlannerMemoryUpdated = (userId: string) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DELETED_PLANNER_MEMORY_EVENT, { detail: { userId } }),
  );
};

export const rememberDeletedPlannerEntitiesLocally = (
  userId: string,
  entities: DeletedPlannerEntity[],
) => {
  const normalized = normalizeDeletedPlannerEntities(entities);
  if (normalized.length === 0) return;

  const merged = normalizeDeletedPlannerEntities([
    ...readLocalDeletedPlannerEntities(userId),
    ...normalized,
  ]);
  writeLocalDeletedPlannerEntities(userId, merged);
  dispatchDeletedPlannerMemoryUpdated(userId);
};

const toRpcEntity = (entity: DeletedPlannerEntity): RpcDeletedPlannerEntity => ({
  entity_type: entity.entityType,
  entity_id: entity.entityId ?? null,
  title: entity.title ?? null,
  metadata: entity.metadata ?? {},
});

export const forgetDeletedPlannerEntities = async ({
  userId,
  entities,
  source,
}: {
  userId: string;
  entities: DeletedPlannerEntity[];
  source?: string | null;
}): Promise<void> => {
  const normalized = normalizeDeletedPlannerEntities(entities);
  if (!userId || normalized.length === 0) return;

  rememberDeletedPlannerEntitiesLocally(userId, normalized);

  try {
    const { error } = await (supabase as any).rpc(
      "forget_deleted_planner_entities",
      {
        p_user_id: userId,
        p_entities: normalized.map(toRpcEntity),
        p_source: source ?? null,
      },
    );
    if (error) {
      console.warn("Failed to persist deleted planner memory tombstones:", error);
      return;
    }
    dispatchDeletedPlannerMemoryUpdated(userId);
  } catch (error) {
    console.warn("Failed to persist deleted planner memory tombstones:", error);
  }
};

export const loadDeletedPlannerEntities = async (
  userId: string,
): Promise<DeletedPlannerEntity[]> => {
  const localEntities = readLocalDeletedPlannerEntities(userId);

  try {
    const { data, error } = await (supabase as any)
      .from("deleted_planner_entities")
      .select("entity_type, entity_id, title, deleted_at, source, metadata")
      .eq("user_id", userId)
      .order("deleted_at", { ascending: false })
      .limit(MAX_LOCAL_TOMBSTONES);

    if (error) {
      console.warn("Failed to load deleted planner memory tombstones:", error);
      return localEntities;
    }

    return normalizeDeletedPlannerEntities([
      ...(data ?? []).map((row: Record<string, unknown>) => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
        title: row.title,
        deletedAt: row.deleted_at,
        source: row.source,
        metadata: row.metadata,
      })),
      ...localEntities,
    ]);
  } catch (error) {
    console.warn("Failed to load deleted planner memory tombstones:", error);
    return localEntities;
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
  const normalizedEntities = normalizeDeletedPlannerEntities(deletedEntities);

  normalizedEntities.forEach((entity) => {
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

export const sanitizeConversationHistoryForDeletedPlannerEntities = <
  T extends { content: string },
>(
  history: T[],
  deletedEntities: DeletedPlannerEntity[] | null | undefined,
  allowedTitles?: Iterable<string | null | undefined>,
): T[] =>
  history.map((entry) => ({
    ...entry,
    content: sanitizeTextForDeletedPlannerEntities(
      entry.content,
      deletedEntities,
      allowedTitles,
    ),
  }));

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
  const entityId = normalizeEntityId(reference.entityId);
  const title = normalizeTitle(reference.title);
  const allowedTitleSet = buildAllowedTitleSet(allowedTitles);

  return normalizeDeletedPlannerEntities(deletedEntities).some((entity) => {
    if (entityType && entity.entityType !== entityType) return false;
    if (entityId && entity.entityId && entity.entityId === entityId) {
      return true;
    }
    if (!title || allowedTitleSet.has(title.toLowerCase())) return false;
    return Boolean(
      entity.title && entity.title.trim().toLowerCase() === title.toLowerCase(),
    );
  });
};
