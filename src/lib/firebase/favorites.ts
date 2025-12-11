import { getDocuments, setDocument, deleteDocument, timestampToISO } from "./firestore";

export interface Favorite {
  id?: string;
  user_id: string;
  quote_id?: string;
  pep_talk_id?: string;
  created_at: string;
}

export const getFavorites = async (userId: string): Promise<Favorite[]> => {
  const favorites = await getDocuments<Favorite>(
    "favorites",
    [["user_id", "==", userId]],
    "created_at",
    "desc"
  );

  return favorites.map((fav) => ({
    ...fav,
    created_at: timestampToISO(fav.created_at as any) || fav.created_at || new Date().toISOString(),
  }));
};

export const addFavorite = async (
  userId: string,
  quoteId?: string,
  pepTalkId?: string
): Promise<void> => {
  const favoriteId = `${userId}_${quoteId || pepTalkId}_${Date.now()}`;
  await setDocument("favorites", favoriteId, {
    user_id: userId,
    quote_id: quoteId,
    pep_talk_id: pepTalkId,
    created_at: new Date().toISOString(),
  }, false);
};

export const removeFavorite = async (
  userId: string,
  quoteId?: string,
  pepTalkId?: string
): Promise<void> => {
  const favorites = await getDocuments<Favorite>("favorites", [
    ["user_id", "==", userId],
    quoteId ? ["quote_id", "==", quoteId] : ["pep_talk_id", "==", pepTalkId],
  ]);

  for (const fav of favorites) {
    if (fav.id) {
      await deleteDocument("favorites", fav.id);
    }
  }
};

export const isFavorite = async (
  userId: string,
  quoteId?: string,
  pepTalkId?: string
): Promise<boolean> => {
  const favorites = await getDocuments<Favorite>("favorites", [
    ["user_id", "==", userId],
    quoteId ? ["quote_id", "==", quoteId] : ["pep_talk_id", "==", pepTalkId],
  ], undefined, undefined, 1);

  return favorites.length > 0;
};

