import { getDocuments, timestampToISO } from "./firestore";

export interface CompanionEvolutionCard {
  id: string;
  user_id: string;
  card_id: string;
  evolution_id?: string;
  evolution_stage: number;
  creature_name: string;
  species: string;
  element: string;
  stats?: Record<string, unknown>;
  traits?: string[] | null;
  story_text: string;
  rarity: string;
  image_url?: string | null;
  energy_cost?: number | null;
  bond_level?: number | null;
  created_at?: string;
}

export const getCompanionEvolutionCards = async (
  userId: string
): Promise<CompanionEvolutionCard[]> => {
  const cards = await getDocuments<CompanionEvolutionCard>(
    "companion_evolution_cards",
    [["user_id", "==", userId]],
    "evolution_stage",
    "asc"
  );

  return cards.map((card) => ({
    ...card,
    created_at: timestampToISO(card.created_at as any) || card.created_at || undefined,
  }));
};

