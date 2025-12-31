import { useState, useEffect, useCallback, useRef } from "react";
import {
  addPendingAction,
  getPendingActions,
  getPendingActionCount,
  clearPendingAction,
  incrementRetryCount,
  initOfflineDB,
} from "@/utils/offlineStorage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type SyncStatus = "idle" | "syncing" | "success" | "error";

interface OfflineQueueState {
  pendingCount: number;
  syncStatus: SyncStatus;
  lastSyncError: string | null;
}

const MAX_RETRIES = 3;

export function useOfflineQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<OfflineQueueState>({
    pendingCount: 0,
    syncStatus: "idle",
    lastSyncError: null,
  });
  
  const isSyncingRef = useRef(false);

  // Initialize DB and get pending count
  useEffect(() => {
    const init = async () => {
      try {
        await initOfflineDB();
        const count = await getPendingActionCount();
        setState(prev => ({ ...prev, pendingCount: count }));
      } catch (error) {
        console.error("Failed to initialize offline queue:", error);
      }
    };
    init();
  }, []);

  // Listen for online status and auto-sync
  useEffect(() => {
    const handleOnline = async () => {
      if (state.pendingCount > 0 && user?.id) {
        await syncPendingActions();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [state.pendingCount, user?.id]);

  /**
   * Queue an action for offline execution
   */
  const queueAction = useCallback(async (
    type: "COMPLETE_TASK" | "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK",
    payload: Record<string, unknown>
  ): Promise<string> => {
    const id = await addPendingAction(type, payload);
    const count = await getPendingActionCount();
    setState(prev => ({ ...prev, pendingCount: count }));
    return id;
  }, []);

  /**
   * Execute a single pending action
   */
  const executeAction = async (action: {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    retries: number;
  }): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      switch (action.type) {
        case "COMPLETE_TASK": {
          const { taskId, completed, completedAt } = action.payload as {
            taskId: string;
            completed: boolean;
            completedAt: string | null;
          };
          
          const { error } = await supabase
            .from("daily_tasks")
            .update({ 
              completed, 
              completed_at: completedAt 
            })
            .eq("id", taskId)
            .eq("user_id", user.id);
          
          if (error) throw error;
          break;
        }
        
        case "CREATE_TASK": {
          const taskData = action.payload as Record<string, unknown>;
          const { error } = await supabase
            .from("daily_tasks")
            .insert([{
              task_text: taskData.task_text as string,
              difficulty: taskData.difficulty as string,
              xp_reward: taskData.xp_reward as number,
              task_date: taskData.task_date as string,
              user_id: user.id,
              scheduled_time: taskData.scheduled_time as string | null,
              estimated_duration: taskData.estimated_duration as number | null,
            }]);
          
          if (error) throw error;
          break;
        }
        
        case "UPDATE_TASK": {
          const { taskId, updates } = action.payload as {
            taskId: string;
            updates: Record<string, unknown>;
          };
          
          const { error } = await supabase
            .from("daily_tasks")
            .update(updates)
            .eq("id", taskId)
            .eq("user_id", user.id);
          
          if (error) throw error;
          break;
        }
        
        case "DELETE_TASK": {
          const { taskId } = action.payload as { taskId: string };
          
          const { error } = await supabase
            .from("daily_tasks")
            .delete()
            .eq("id", taskId)
            .eq("user_id", user.id);
          
          if (error) throw error;
          break;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to execute ${action.type}:`, error);
      return false;
    }
  };

  /**
   * Sync all pending actions
   */
  const syncPendingActions = useCallback(async (): Promise<{
    success: number;
    failed: number;
  }> => {
    if (isSyncingRef.current || !navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    isSyncingRef.current = true;
    setState(prev => ({ ...prev, syncStatus: "syncing", lastSyncError: null }));

    let successCount = 0;
    let failedCount = 0;

    try {
      const actions = await getPendingActions();
      
      for (const action of actions) {
        if (action.retries >= MAX_RETRIES) {
          // Too many retries, remove action
          await clearPendingAction(action.id);
          failedCount++;
          continue;
        }

        const success = await executeAction(action);
        
        if (success) {
          await clearPendingAction(action.id);
          successCount++;
        } else {
          await incrementRetryCount(action.id);
          failedCount++;
        }
      }

      const finalCount = await getPendingActionCount();
      
      setState(prev => ({
        ...prev,
        pendingCount: finalCount,
        syncStatus: failedCount === 0 ? "success" : "error",
        lastSyncError: failedCount > 0 ? `${failedCount} actions failed to sync` : null,
      }));

      if (successCount > 0) {
        toast({
          title: "Synced successfully",
          description: `${successCount} action${successCount > 1 ? "s" : ""} synced`,
        });
      }

      // Reset status after delay
      setTimeout(() => {
        setState(prev => ({ ...prev, syncStatus: "idle" }));
      }, 3000);

      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error("Failed to sync pending actions:", error);
      setState(prev => ({
        ...prev,
        syncStatus: "error",
        lastSyncError: "Sync failed. Will retry when online.",
      }));
      return { success: successCount, failed: failedCount };
    } finally {
      isSyncingRef.current = false;
    }
  }, [user?.id, toast]);

  /**
   * Force a sync attempt
   */
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast({
        title: "You're offline",
        description: "Will sync when connection is restored",
        variant: "destructive",
      });
      return;
    }
    
    return syncPendingActions();
  }, [syncPendingActions, toast]);

  return {
    pendingCount: state.pendingCount,
    syncStatus: state.syncStatus,
    lastSyncError: state.lastSyncError,
    queueAction,
    triggerSync,
    syncPendingActions,
  };
}
