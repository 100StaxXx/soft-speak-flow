/**
 * Offline Storage Utility using IndexedDB
 * Provides persistent storage for offline-first functionality
 */

const DB_NAME = "cosmiq-offline-db";
const DB_VERSION = 3;

export type QueueActionKind =
  | "TASK_COMPLETE"
  | "TASK_CREATE"
  | "TASK_UPDATE"
  | "TASK_DELETE"
  | "MENTOR_FEEDBACK"
  | "SUPPORT_REPORT";

export type QueueEntityType = "task" | "mentor_feedback" | "support_report" | "unknown";

export type QueueActionStatus = "queued" | "syncing" | "synced" | "failed" | "dropped";

export interface QueuedAction {
  id: string;
  user_id: string;
  action_kind: QueueActionKind | string;
  entity_type: QueueEntityType | string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  retry_count: number;
  last_error: string | null;
  status: QueueActionStatus;
  created_at: number;
  updated_at: number;
}

interface LegacyPendingAction {
  id: string;
  user_id: string;
  type: "COMPLETE_TASK" | "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK";
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
}

const ACTIVE_QUEUE_STATUSES: QueueActionStatus[] = ["queued", "syncing", "failed"];

let db: IDBDatabase | null = null;

const nowMs = () => Date.now();

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const isString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

const toQueueActionKind = (value: unknown): QueueActionKind | null => {
  if (value === "TASK_COMPLETE" || value === "TASK_CREATE" || value === "TASK_UPDATE" || value === "TASK_DELETE" || value === "MENTOR_FEEDBACK" || value === "SUPPORT_REPORT") {
    return value;
  }
  return null;
};

const toQueueEntityType = (value: unknown): QueueEntityType => {
  if (value === "task" || value === "mentor_feedback" || value === "support_report" || value === "unknown") {
    return value;
  }
  return "unknown";
};

const toQueueStatus = (value: unknown): QueueActionStatus => {
  if (value === "queued" || value === "syncing" || value === "synced" || value === "failed" || value === "dropped") {
    return value;
  }
  return "queued";
};

const mapLegacyTypeToActionKind = (legacyType: unknown): QueueActionKind => {
  switch (legacyType) {
    case "COMPLETE_TASK":
      return "TASK_COMPLETE";
    case "CREATE_TASK":
      return "TASK_CREATE";
    case "UPDATE_TASK":
      return "TASK_UPDATE";
    case "DELETE_TASK":
      return "TASK_DELETE";
    default:
      return "TASK_UPDATE";
  }
};

const defaultEntityTypeForAction = (actionKind: QueueActionKind): QueueEntityType => {
  switch (actionKind) {
    case "TASK_COMPLETE":
    case "TASK_CREATE":
    case "TASK_UPDATE":
    case "TASK_DELETE":
      return "task";
    case "MENTOR_FEEDBACK":
      return "mentor_feedback";
    case "SUPPORT_REPORT":
      return "support_report";
    default:
      return "unknown";
  }
};

const normalizeQueuedAction = (row: Partial<QueuedAction> & Record<string, unknown>): QueuedAction | null => {
  const userId = row.user_id;
  if (!isString(userId)) return null;

  const actionKind = toQueueActionKind(row.action_kind);
  if (!actionKind) return null;

  const createdAt = typeof row.created_at === "number" ? row.created_at : nowMs();
  const updatedAt = typeof row.updated_at === "number" ? row.updated_at : createdAt;
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? (row.payload as Record<string, unknown>)
    : {};

  return {
    id: isString(row.id) ? row.id : createId(),
    user_id: userId,
    action_kind: actionKind,
    entity_type: toQueueEntityType(row.entity_type),
    entity_id: typeof row.entity_id === "string" ? row.entity_id : null,
    payload,
    retry_count: typeof row.retry_count === "number" ? row.retry_count : 0,
    last_error: typeof row.last_error === "string" ? row.last_error : null,
    status: toQueueStatus(row.status),
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

const normalizeLegacyRow = (row: Record<string, unknown>): QueuedAction | null => {
  const userId = row.user_id;
  if (!isString(userId)) return null;

  const actionKind = mapLegacyTypeToActionKind(row.type);
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? (row.payload as Record<string, unknown>)
    : {};
  const createdAt = typeof row.timestamp === "number" ? row.timestamp : nowMs();

  let entityId: string | null = null;
  const taskId = payload.taskId;
  if (typeof taskId === "string") entityId = taskId;

  return {
    id: isString(row.id) ? row.id : createId(),
    user_id: userId,
    action_kind: actionKind,
    entity_type: "task",
    entity_id: entityId,
    payload,
    retry_count: typeof row.retries === "number" ? row.retries : 0,
    last_error: null,
    status: "queued",
    created_at: createdAt,
    updated_at: createdAt,
  };
};

/**
 * Initialize the IndexedDB database
 */
export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open offline database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains("tasks")) {
        database.createObjectStore("tasks", { keyPath: "id" });
      }

      const actionStore = database.objectStoreNames.contains("pendingActions")
        ? (event.target as IDBOpenDBRequest).transaction!.objectStore("pendingActions")
        : database.createObjectStore("pendingActions", { keyPath: "id" });

      if (!actionStore.indexNames.contains("timestamp")) {
        actionStore.createIndex("timestamp", "timestamp");
      }
      if (!actionStore.indexNames.contains("user_id")) {
        actionStore.createIndex("user_id", "user_id");
      }
      if (!actionStore.indexNames.contains("status")) {
        actionStore.createIndex("status", "status");
      }
      if (!actionStore.indexNames.contains("created_at")) {
        actionStore.createIndex("created_at", "created_at");
      }
      if (!actionStore.indexNames.contains("action_kind")) {
        actionStore.createIndex("action_kind", "action_kind");
      }
      if (!actionStore.indexNames.contains("entity_type")) {
        actionStore.createIndex("entity_type", "entity_type");
      }

      if (!database.objectStoreNames.contains("cache")) {
        database.createObjectStore("cache", { keyPath: "key" });
      }

      // Migration safety: remove unscoped entries and convert v2 legacy shape to v3 queue shape.
      const cursorRequest = actionStore.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;

        const value = cursor.value as Record<string, unknown>;
        const asQueue = normalizeQueuedAction(value);

        if (asQueue) {
          cursor.update(asQueue);
          cursor.continue();
          return;
        }

        const asLegacy = normalizeLegacyRow(value);
        if (asLegacy) {
          cursor.update(asLegacy);
        } else {
          cursor.delete();
        }
        cursor.continue();
      };
    };
  });
}

/**
 * Get the database instance, initializing if needed
 */
async function getDB(): Promise<IDBDatabase> {
  if (db) return db;
  return initOfflineDB();
}

/**
 * Save data to a cache store
 */
export async function saveToCache(key: string, data: unknown): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction("cache", "readwrite");
    const store = transaction.objectStore("cache");

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to save to cache:", error);
  }
}

/**
 * Get data from cache
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const database = await getDB();
    const transaction = database.transaction("cache", "readonly");
    const store = transaction.objectStore("cache");

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        resolve((entry?.data as T) ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get from cache:", error);
    return null;
  }
}

/**
 * Get cache timestamp
 */
export async function getCacheTimestamp(key: string): Promise<number | null> {
  try {
    const database = await getDB();
    const transaction = database.transaction("cache", "readonly");
    const store = transaction.objectStore("cache");

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        resolve(entry?.timestamp ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get cache timestamp:", error);
    return null;
  }
}

interface EnqueueActionInput {
  userId: string;
  actionKind: QueueActionKind;
  entityType?: QueueEntityType;
  entityId?: string | null;
  payload: Record<string, unknown>;
  status?: QueueActionStatus;
}

/**
 * Add a queued action for offline replay.
 */
export async function enqueueAction(input: EnqueueActionInput): Promise<string> {
  try {
    if (!input.userId) throw new Error("User ID is required for queued actions");
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readwrite");
    const store = transaction.objectStore("pendingActions");

    const timestamp = nowMs();
    const action: QueuedAction = {
      id: createId(),
      user_id: input.userId,
      action_kind: input.actionKind,
      entity_type: input.entityType ?? defaultEntityTypeForAction(input.actionKind),
      entity_id: input.entityId ?? null,
      payload: input.payload,
      retry_count: 0,
      last_error: null,
      status: input.status ?? "queued",
      created_at: timestamp,
      updated_at: timestamp,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(action);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return action.id;
  } catch (error) {
    console.error("Failed to enqueue action:", error);
    throw error;
  }
}

/**
 * List queued actions for a user.
 */
export async function getQueuedActions(userId: string): Promise<QueuedAction[]> {
  try {
    if (!userId) return [];
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readonly");
    const store = transaction.objectStore("pendingActions");
    const index = store.index("user_id");

    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => {
        const actions = ((request.result || []) as Array<Record<string, unknown>>)
          .map((row) => normalizeQueuedAction(row as Partial<QueuedAction> & Record<string, unknown>))
          .filter((row): row is QueuedAction => row !== null);
        actions.sort((a, b) => a.created_at - b.created_at);
        resolve(actions);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get queued actions:", error);
    return [];
  }
}

/**
 * List active actions (queued/syncing/failed) for replay.
 */
export async function getActiveQueuedActions(userId: string): Promise<QueuedAction[]> {
  const all = await getQueuedActions(userId);
  return all.filter((action) => ACTIVE_QUEUE_STATUSES.includes(action.status));
}

/**
 * Get count of queued actions.
 */
export async function getQueuedActionCount(
  userId?: string,
  statuses: QueueActionStatus[] = ACTIVE_QUEUE_STATUSES,
): Promise<number> {
  try {
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readonly");
    const store = transaction.objectStore("pendingActions");

    const fetchRows = (): Promise<Array<Record<string, unknown>>> => {
      if (!userId) {
        return new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve((request.result || []) as Array<Record<string, unknown>>);
          request.onerror = () => reject(request.error);
        });
      }

      const index = store.index("user_id");
      return new Promise((resolve, reject) => {
        const request = index.getAll(userId);
        request.onsuccess = () => resolve((request.result || []) as Array<Record<string, unknown>>);
        request.onerror = () => reject(request.error);
      });
    };

    const rows = await fetchRows();
    const normalized = rows
      .map((row) => normalizeQueuedAction(row as Partial<QueuedAction> & Record<string, unknown>))
      .filter((row): row is QueuedAction => row !== null);

    return normalized.filter((action) => statuses.includes(action.status)).length;
  } catch (error) {
    console.error("Failed to get queued action count:", error);
    return 0;
  }
}

/**
 * Update queued action record.
 */
export async function updateQueuedAction(
  id: string,
  patch: Partial<Pick<QueuedAction, "status" | "retry_count" | "last_error" | "payload" | "entity_id">>,
): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readwrite");
    const store = transaction.objectStore("pendingActions");

    const existing = await new Promise<QueuedAction | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const normalized = normalizeQueuedAction((request.result || null) as Partial<QueuedAction> & Record<string, unknown>);
        resolve(normalized);
      };
      request.onerror = () => reject(request.error);
    });

    if (!existing) return;

    const updated: QueuedAction = {
      ...existing,
      ...patch,
      updated_at: nowMs(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to update queued action:", error);
  }
}

/**
 * Remove action from queue store.
 */
export async function removeQueuedAction(id: string): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readwrite");
    const store = transaction.objectStore("pendingActions");

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to remove queued action:", error);
  }
}

/**
 * Mark action for manual retry.
 */
export async function retryQueuedAction(id: string): Promise<void> {
  await updateQueuedAction(id, { status: "queued", last_error: null });
}

/**
 * Mark action as discarded by user.
 */
export async function discardQueuedAction(id: string, reason?: string): Promise<void> {
  await updateQueuedAction(id, {
    status: "dropped",
    last_error: reason ?? "Discarded by user",
  });
}

// ---------------------------------------------------------------------------
// Legacy compatibility exports (used by existing tests/hooks)
// ---------------------------------------------------------------------------

/**
 * Add a pending action to the queue (legacy task API)
 */
export async function addPendingAction(
  type: LegacyPendingAction["type"],
  payload: Record<string, unknown>,
  userId: string,
): Promise<string> {
  return enqueueAction({
    userId,
    actionKind: mapLegacyTypeToActionKind(type),
    entityType: "task",
    entityId: typeof payload.taskId === "string" ? payload.taskId : null,
    payload,
  });
}

/**
 * Get all pending actions (legacy task API)
 */
export async function getPendingActions(userId: string): Promise<LegacyPendingAction[]> {
  const rows = await getActiveQueuedActions(userId);
  return rows
    .filter((row) => row.entity_type === "task")
    .map((row) => {
      let type: LegacyPendingAction["type"] = "UPDATE_TASK";
      switch (row.action_kind) {
        case "TASK_COMPLETE":
          type = "COMPLETE_TASK";
          break;
        case "TASK_CREATE":
          type = "CREATE_TASK";
          break;
        case "TASK_DELETE":
          type = "DELETE_TASK";
          break;
        case "TASK_UPDATE":
        default:
          type = "UPDATE_TASK";
          break;
      }

      return {
        id: row.id,
        user_id: row.user_id,
        type,
        payload: row.payload,
        timestamp: row.created_at,
        retries: row.retry_count,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get count of pending actions (legacy task API)
 */
export async function getPendingActionCount(userId?: string): Promise<number> {
  return getQueuedActionCount(userId, ACTIVE_QUEUE_STATUSES);
}

/**
 * Clear a pending action after successful sync (legacy behavior)
 */
export async function clearPendingAction(id: string): Promise<void> {
  await removeQueuedAction(id);
}

/**
 * Increment retry count for a pending action (legacy behavior)
 */
export async function incrementRetryCount(id: string): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readwrite");
    const store = transaction.objectStore("pendingActions");

    const action = await new Promise<QueuedAction | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const normalized = normalizeQueuedAction((request.result || null) as Partial<QueuedAction> & Record<string, unknown>);
        resolve(normalized);
      };
      request.onerror = () => reject(request.error);
    });

    if (!action) return;

    await updateQueuedAction(id, {
      retry_count: action.retry_count + 1,
      status: "failed",
    });
  } catch (error) {
    console.error("Failed to increment retry count:", error);
  }
}

/**
 * Clear all pending actions
 */
export async function clearAllPendingActions(userId?: string): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readwrite");
    const store = transaction.objectStore("pendingActions");

    if (!userId) {
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return;
    }

    const index = store.index("user_id");
    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(userId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }

        const deleteRequest = cursor.delete();
        deleteRequest.onsuccess = () => cursor.continue();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear all pending actions:", error);
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

export function __resetOfflineDBForTests(): void {
  if (db) {
    db.close();
  }
  db = null;
}
