import { getDocuments, getDocument, timestampToISO } from "./firestore";

export interface CompanionEvolution {
  id?: string;
  companion_id: string;
  stage: number;
  image_url?: string;
  created_at?: string;
}

export const getCompanionEvolution = async (
  companionId: string,
  stage: number
): Promise<CompanionEvolution | null> => {
  const evolutions = await getDocuments<CompanionEvolution>(
    "companion_evolutions",
    [
      ["companion_id", "==", companionId],
      ["stage", "==", stage],
    ],
    undefined,
    undefined,
    1
  );

  if (evolutions.length === 0) return null;

  const evolution = evolutions[0];
  return {
    ...evolution,
    created_at: timestampToISO(evolution.created_at as any) || evolution.created_at || undefined,
  };
};

export const getCompanionEvolutions = async (
  companionId: string
): Promise<CompanionEvolution[]> => {
  const evolutions = await getDocuments<CompanionEvolution>(
    "companion_evolutions",
    [["companion_id", "==", companionId]],
    "stage",
    "asc"
  );

  return evolutions.map((evolution) => ({
    ...evolution,
    created_at: timestampToISO(evolution.created_at as any) || evolution.created_at || undefined,
  }));
};

