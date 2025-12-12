import { getDocuments, updateDocument, timestampToISO } from "./firestore";

export interface ActivityFeedItem {
  id?: string;
  user_id: string;
  activity_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  is_read?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const getActivityFeed = async (
  userId: string,
  limitCount?: number
): Promise<ActivityFeedItem[]> => {
  const activities = await getDocuments<ActivityFeedItem>(
    "activity_feed",
    [["user_id", "==", userId]],
    "created_at",
    "desc",
    limitCount
  );

  return activities.map((activity) => ({
    ...activity,
    created_at: timestampToISO(activity.created_at as any) || activity.created_at || undefined,
    updated_at: timestampToISO(activity.updated_at as any) || activity.updated_at || undefined,
  }));
};

export const markActivityAsRead = async (activityId: string): Promise<void> => {
  await updateDocument("activity_feed", activityId, {
    is_read: true,
  });
};

