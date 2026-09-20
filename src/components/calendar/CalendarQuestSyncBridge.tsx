import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { syncImportedCalendarQuest } from "@/services/calendarQuestSync";
import type { CalendarQuestImport } from "@/hooks/useCalendarQuestImports";
import { supabase } from "@/integrations/supabase/client";

/** Persistent server-side links are the retry queue; no task data is lost on app close.
 * Native Apple data is synchronized only while the app can access EventKit.
 */
export function CalendarQuestSyncBridge() {
  const { user } = useAuth(); const cache = useQueryClient();
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false; let running = false;
    const run = async () => {
      if (cancelled || running || !navigator.onLine || document.visibilityState === "hidden") return;
      running = true;
      try {
        const { data, error } = await supabase.from("calendar_quest_imports" as never).select("*")
          .eq("user_id", user.id).eq("sync_enabled", true);
        if (error) return; // Older servers must not break app launch.
        for (const link of (data ?? []) as unknown as CalendarQuestImport[]) {
          if (cancelled) return;
          if (link.sync_status === "conflict" || link.sync_status === "missing") continue;
          await syncImportedCalendarQuest(link, user.id).catch(() => undefined);
        }
        if (!cancelled && data?.length) {
          for (const key of ["calendar-quest-imports", "daily-tasks", "calendar-tasks", "inbox-tasks"]) void cache.invalidateQueries({ queryKey: [key] });
        }
      } catch {
        // A transport/storage failure is retryable, never a reason to interrupt navigation.
      } finally { running = false; }
    };
    void run();
    const interval = window.setInterval(() => { void run(); }, 60000);
    const refresh = () => { void run(); };
    window.addEventListener("online", refresh); window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [user?.id, cache]);
  return null;
}
