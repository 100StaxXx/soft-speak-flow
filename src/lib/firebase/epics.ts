import { getDocuments, getDocument, setDocument, updateDocument, timestampToISO } from "./firestore";

export interface Epic {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  invite_code?: string;
  is_public?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EpicMember {
  id?: string;
  epic_id: string;
  user_id: string;
  total_contribution?: number;
  joined_at?: string;
  created_at?: string;
}

export interface EpicHabit {
  id?: string;
  epic_id: string;
  habit_id: string;
  created_at?: string;
}

export const getEpic = async (epicId: string): Promise<Epic | null> => {
  return await getDocument<Epic>("epics", epicId);
};

export const getEpics = async (
  userId?: string,
  filters?: Array<[string, any, any]>
): Promise<Epic[]> => {
  const allFilters: Array<[string, any, any]> = filters || [];
  if (userId) {
    allFilters.push(["user_id", "==", userId]);
  }

  const epics = await getDocuments<Epic>("epics", allFilters.length > 0 ? allFilters : undefined, "created_at", "desc");

  return epics.map((epic) => ({
    ...epic,
    created_at: timestampToISO(epic.created_at as any) || epic.created_at || undefined,
    updated_at: timestampToISO(epic.updated_at as any) || epic.updated_at || undefined,
  }));
};

export const getEpicByInviteCode = async (inviteCode: string): Promise<Epic | null> => {
  const epics = await getDocuments<Epic>("epics", [
    ["invite_code", "==", inviteCode],
    ["is_public", "==", true],
  ], undefined, undefined, 1);

  return epics[0] || null;
};

export const getEpicMembers = async (epicId: string): Promise<EpicMember[]> => {
  const members = await getDocuments<EpicMember>(
    "epic_members",
    [["epic_id", "==", epicId]],
    "total_contribution",
    "desc"
  );

  return members.map((member) => ({
    ...member,
    joined_at: timestampToISO(member.joined_at as any) || member.joined_at || undefined,
    created_at: timestampToISO(member.created_at as any) || member.created_at || undefined,
  }));
};

export const getEpicHabits = async (epicId: string): Promise<EpicHabit[]> => {
  return await getDocuments<EpicHabit>("epic_habits", [["epic_id", "==", epicId]]);
};

export const joinEpic = async (epicId: string, userId: string): Promise<void> => {
  const memberId = `${epicId}_${userId}`;
  await setDocument("epic_members", memberId, {
    epic_id: epicId,
    user_id: userId,
    total_contribution: 0,
    joined_at: new Date().toISOString(),
  }, false);
};

export const getUserEpics = async (userId: string): Promise<{ owned: Epic[]; joined: Epic[] }> => {
  const [owned, allMembers] = await Promise.all([
    getEpics(userId, [["status", "==", "active"]]),
    getDocuments<EpicMember>("epic_members", [["user_id", "==", userId]]),
  ]);

  // Get epics that user joined but doesn't own
  const joinedEpicIds = allMembers
    .filter(m => m.epic_id)
    .map(m => m.epic_id!);

  const joined: Epic[] = [];
  for (const epicId of joinedEpicIds) {
    const epic = await getEpic(epicId);
    if (epic && epic.user_id !== userId && epic.status === "active") {
      joined.push(epic);
    }
  }

  return { owned, joined };
};

