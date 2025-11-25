import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EvolutionCardFlip } from "./EvolutionCardFlip";

interface EvolutionCard {
  id: string;
  card_id: string;
  evolution_stage: number;
  creature_name: string;
  species: string;
  element: string;
  stats: any;
  traits: string[] | null;
  story_text: string;
  rarity: string;
  image_url: string | null;
  energy_cost?: number | null;
  bond_level?: number | null;
}

export const EvolutionCardGallery = () => {
  const { user } = useAuth();

  const { data: cards, isLoading } = useQuery({
    queryKey: ["evolution-cards", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("companion_evolution_cards")
        .select("*")
        .eq("user_id", user.id)
        .order("evolution_stage", { ascending: true });

      if (error) throw error;
      
      const evolutionIds = (data || [])
        .map(card => card.evolution_id)
        .filter((id): id is string => Boolean(id));

      let evolutionImageLookup: Record<string, string | null> = {};

      if (evolutionIds.length > 0) {
        const { data: evolutionRows, error: evolutionError } = await supabase
          .from("companion_evolutions")
          .select("id, image_url")
          .in("id", evolutionIds);

        if (evolutionError) throw evolutionError;

        evolutionImageLookup = (evolutionRows || []).reduce((acc, row) => {
          acc[row.id] = row.image_url ?? null;
          return acc;
        }, {} as Record<string, string | null>);
      }

      const cardsWithImages = (data || []).map(card => ({
        ...card,
        image_url: (card.evolution_id && evolutionImageLookup[card.evolution_id]) || card.image_url
      }));
      
      // Deduplicate cards by card_id
      const uniqueCards = new Map<string, any>();
      cardsWithImages.forEach(card => {
        if (!uniqueCards.has(card.card_id)) {
          uniqueCards.set(card.card_id, card);
        }
      });
      
      const mappedCards = Array.from(uniqueCards.values()) as EvolutionCard[];
      return mappedCards;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[280px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Evolution Cards Yet</h3>
        <p className="text-sm text-muted-foreground">
          Cards are created when your companion evolves. Keep growing to unlock your first card!
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <EvolutionCardFlip key={card.id} card={card} />
      ))}
    </div>
  );
};
