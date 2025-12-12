import { getDocument, getDocuments, setDocument, updateDocument, timestampToISO } from "./firestore";

export interface UserCompanion {
  id?: string;
  user_id: string;
  favorite_color?: string;
  spirit_animal?: string;
  core_element?: string;
  current_stage?: number;
  current_xp?: number;
  current_image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const getCompanion = async (userId: string): Promise<UserCompanion | null> => {
  const companions = await getDocuments<UserCompanion>(
    "user_companion",
    [["user_id", "==", userId]],
    undefined,
    undefined,
    1
  );

  if (companions.length === 0) return null;

  const companion = companions[0];
  return {
    ...companion,
    created_at: timestampToISO(companion.created_at as any) || companion.created_at || undefined,
    updated_at: timestampToISO(companion.updated_at as any) || companion.updated_at || undefined,
  };
};

export const getCompanionsByUserIds = async (userIds: string[]): Promise<Map<string, UserCompanion>> => {
  if (userIds.length === 0) return new Map();

  // Firestore 'in' queries are limited to 10 items, so we need to batch
  const batchSize = 10;
  const companionsMap = new Map<string, UserCompanion>();

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const companions = await getDocuments<UserCompanion>(
      "user_companion",
      [["user_id", "in", batch]]
    );

    companions.forEach(companion => {
      if (companion.user_id) {
        companionsMap.set(companion.user_id, companion);
      }
    });
  }

  return companionsMap;
};

