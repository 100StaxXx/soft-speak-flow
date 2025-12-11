import { getDocuments, timestampToISO } from "./firestore";

export interface XPEvent {
  id?: string;
  user_id: string;
  event_type: string;
  xp_earned: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export const getXPEvents = async (
  userId: string,
  startDate?: string,
  endDate?: string,
  limitCount?: number
): Promise<XPEvent[]> => {
  const filters: Array<[string, any, any]> = [["user_id", "==", userId]];
  
  if (startDate) {
    filters.push(["created_at", ">=", startDate]);
  }
  if (endDate) {
    filters.push(["created_at", "<=", endDate]);
  }

  const events = await getDocuments<XPEvent>(
    "xp_events",
    filters,
    "created_at",
    "desc",
    limitCount
  );

  return events.map((event) => ({
    ...event,
    created_at: timestampToISO(event.created_at as any) || event.created_at || undefined,
  }));
};

export const getTodayXPEvents = async (userId: string): Promise<XPEvent[]> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  
  return await getXPEvents(userId, startOfToday);
};

