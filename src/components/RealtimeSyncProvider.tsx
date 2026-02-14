/**
 * Centralized provider for all realtime subscriptions
 * Activates cross-device sync for habits, epics, and daily tasks
 */
import { useHabitsRealtime } from "@/hooks/useHabitsRealtime";
import { useEpicsRealtime } from "@/hooks/useEpicsRealtime";
import { useDailyTasksRealtime } from "@/hooks/useDailyTasksRealtime";
import { ReactNode } from "react";

interface RealtimeSyncProviderProps {
  children: ReactNode;
}

export const RealtimeSyncProvider = ({ children }: RealtimeSyncProviderProps) => {
  // Only activate realtime subscriptions when user is authenticated
  // These hooks are no-ops when user is null
  useHabitsRealtime();
  useEpicsRealtime();
  useDailyTasksRealtime();

  return <>{children}</>;
};
