import { getDocuments, setDocument, timestampToISO } from "./firestore";

export interface MentorChat {
  id?: string;
  user_id: string;
  mentor_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const getMentorChats = async (
  userId: string,
  mentorId?: string,
  limitCount?: number
): Promise<MentorChat[]> => {
  const filters: Array<[string, any, any]> = [["user_id", "==", userId]];
  if (mentorId) {
    filters.push(["mentor_id", "==", mentorId]);
  }

  const chats = await getDocuments<MentorChat>(
    "mentor_chats",
    filters,
    "created_at",
    "desc",
    limitCount
  );

  return chats.map((chat) => ({
    ...chat,
    created_at: timestampToISO(chat.created_at as any) || chat.created_at || new Date().toISOString(),
  }));
};

export const getDailyMessageCount = async (
  userId: string,
  mentorId?: string
): Promise<number> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const filters: Array<[string, any, any]> = [
    ["user_id", "==", userId],
    ["created_at", ">=", todayISO],
  ];
  if (mentorId) {
    filters.push(["mentor_id", "==", mentorId]);
  }

  const chats = await getDocuments<MentorChat>("mentor_chats", filters);
  return chats.length;
};

export const createMentorChat = async (chat: Omit<MentorChat, "id" | "created_at">): Promise<void> => {
  const chatId = `${chat.user_id}_${chat.mentor_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await setDocument("mentor_chats", chatId, {
    ...chat,
    created_at: new Date().toISOString(),
  }, false);
};

