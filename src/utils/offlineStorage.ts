/**
 * Offline Storage Utility using IndexedDB
 * Provides persistent storage for offline-first functionality
 */

const DB_NAME = "cosmiq-offline-db";
const DB_VERSION = 2;

interface PendingAction {
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

let db: IDBDatabase | null = null;

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
      const oldVersion = event.oldVersion;
      
      // Create object stores
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

      // Safety migration: remove legacy unscoped actions to prevent cross-account replay.
      if (oldVersion < 2) {
        const cursorRequest = actionStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const value = cursor.value as Partial<PendingAction>;
          if (!value.user_id || typeof value.user_id !== "string") {
            cursor.delete();
          }
          cursor.continue();
        };
      }
      
      if (!database.objectStoreNames.contains("cache")) {
        database.createObjectStore("cache", { keyPath: "key" });
      }
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
        resolve(entry?.data as T ?? null);
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

/**
 * Add a pending action to the queue
 */
export async function addPendingAction(
  type: PendingAction["type"],
  payload: Record<string, unknown>,
  userId: string
): Promise<string> {
  try {
    if (!userId) throw new Error("User ID is required for pending actions");
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readwrite");
    const store = transaction.objectStore("pendingActions");
    
    const action: PendingAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.add(action);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return action.id;
  } catch (error) {
    console.error("Failed to add pending action:", error);
    throw error;
  }
}

/**
 * Get all pending actions
 */
export async function getPendingActions(userId: string): Promise<PendingAction[]> {
  try {
    if (!userId) return [];
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readonly");
    const store = transaction.objectStore("pendingActions");
    const index = store.index("user_id");
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => {
        const actions = (request.result || []) as PendingAction[];
        actions.sort((a, b) => a.timestamp - b.timestamp);
        resolve(actions);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get pending actions:", error);
    return [];
  }
}

/**
 * Get count of pending actions
 */
export async function getPendingActionCount(userId?: string): Promise<number> {
  try {
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readonly");
    const store = transaction.objectStore("pendingActions");

    if (!userId) {
      return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    const index = store.index("user_id");
    return new Promise((resolve, reject) => {
      const request = index.count(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get pending action count:", error);
    return 0;
  }
}

/**
 * Clear a pending action after successful sync
 */
export async function clearPendingAction(id: string): Promise<void> {
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
    console.error("Failed to clear pending action:", error);
  }
}

/**
 * Increment retry count for a pending action
 */
export async function incrementRetryCount(id: string): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction("pendingActions", "readwrite");
    const store = transaction.objectStore("pendingActions");
    
    const action = await new Promise<PendingAction | undefined>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (action) {
      action.retries += 1;
      await new Promise<void>((resolve, reject) => {
        const request = store.put(action);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
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
