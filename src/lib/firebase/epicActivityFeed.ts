import { getDocuments, timestampToISO } from "./firestore";

export interface EpicActivityFeedItem {
  id?: string;
  epic_id: string;
  user_id: string;
  activity_type: string;
  activity_data?: Record<string, unknown>;
  created_at?: string;
}

export const getEpicActivityFeed = async (
  epicId: string,
  limitCount?: number
): Promise<EpicActivityFeedItem[]> => {
  const activities = await getDocuments<EpicActivityFeedItem>(
    "epic_activity_feed",
    [["epic_id", "==", epicId]],
    "created_at",
    "desc",
    limitCount
  );

  return activities.map((activity) => ({
    ...activity,
    created_at: timestampToISO(activity.created_at as any) || activity.created_at || undefined,
  }));
};

