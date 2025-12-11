import { getDocuments, updateDocument, timestampToISO } from "./firestore";

export interface MentorNudge {
  id: string;
  user_id: string;
  mentor_id?: string;
  nudge_type: string;
  title?: string;
  message: string;
  delivered_at?: string;
  dismissed_at?: string | null;
  created_at?: string;
}

export const getMentorNudges = async (
  userId: string,
  limitCount?: number
): Promise<MentorNudge[]> => {
  const nudges = await getDocuments<MentorNudge>(
    "mentor_nudges",
    [
      ["user_id", "==", userId],
      ["dismissed_at", "==", null],
    ],
    "delivered_at",
    "desc",
    limitCount
  );

  return nudges.map((nudge) => ({
    ...nudge,
    delivered_at: timestampToISO(nudge.delivered_at as any) || nudge.delivered_at || undefined,
    dismissed_at: timestampToISO(nudge.dismissed_at as any) || nudge.dismissed_at || null,
    created_at: timestampToISO(nudge.created_at as any) || nudge.created_at || undefined,
  }));
};

export const dismissNudge = async (nudgeId: string): Promise<void> => {
  await updateDocument("mentor_nudges", nudgeId, {
    dismissed_at: new Date().toISOString(),
  });
};

