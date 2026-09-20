import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarIntegrations } from "@/hooks/useCalendarIntegrations";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";
import type { CalendarQuestSnapshot } from "@/utils/calendarSyncMerge";
import { eventQuestSnapshot } from "../../supabase/functions/_shared/calendarSyncPlan.ts";
export { eventQuestSnapshot } from "../../supabase/functions/_shared/calendarSyncPlan.ts";

export interface CalendarQuestImport {
  id: string; task_id: string; connection_id: string; provider: "google" | "outlook" | "apple";
  calendar_id: string; external_id: string; baseline: CalendarQuestSnapshot; revision: number;
  timezone: string;
  resource_kind: "event" | "task";
  sync_enabled: boolean; sync_status: "linked" | "conflict" | "missing" | "retry"; last_error: string | null;
}

export function useCalendarQuestImports(enabled = true) {
  const { user } = useAuth(); const queryClient = useQueryClient();
  const { connections } = useCalendarIntegrations({ enabled });
  const query = useQuery({ queryKey: ["calendar-quest-imports", user?.id], enabled: enabled && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_quest_imports" as never).select("*").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as CalendarQuestImport[];
    }, staleTime: 30000, retry: false });
  const invalidate = async () => {
    await Promise.all(["calendar-quest-imports", "daily-tasks", "calendar-tasks", "inbox-tasks", "inbox-count"].map(
      (key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };
  const importEvent = useMutation({ mutationFn: async ({ event, sync }: { event: ExternalCalendarEvent; sync: boolean }) => {
    const connection = connections.find((item) => event.connectionId ? item.id === event.connectionId : item.provider === event.provider);
    if (!user || !connection || !event.calendarId) throw new Error("Reconnect this calendar in Preferences first.");
    const { data, error } = await supabase.rpc("import_calendar_quest" as never, {
      p_connection_id: connection.id, p_calendar_id: event.calendarId, p_external_id: event.id,
      p_snapshot: eventQuestSnapshot(event), p_sync_enabled: sync,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    } as never);
    if (error) throw new Error("Could not link this calendar item. Please retry; your original event has not been changed.");
    return String(data);
  }, onSuccess: invalidate });
  return { links: query.data ?? [], error: query.error, importEvent, invalidate };
}
