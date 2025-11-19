import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Zap, Heart, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EvolutionCard {
  id: string;
  card_id: string;
  evolution_stage: number;
  creature_name: string;
  species: string;
  element: string;
  stats: {
    strength: number;
    agility: number;
    vitality: number;
    intellect: number;
    spirit: number;
    affinity: number;
  };
  traits: string[];
  story_text: string;
  lore_seed: string;
  bond_level: number;
  rarity: string;
  frame_type: string;
  image_url?: string;
  created_at: string;
}

const RARITY_COLORS = {
  Common: 'from-gray-400 to-gray-600',
  Rare: 'from-blue-400 to-blue-600',
  Epic: 'from-purple-400 to-purple-600',
  Legendary: 'from-orange-400 to-orange-600',
  Mythic: 'from-pink-400 to-pink-600',
  Celestial: 'from-cyan-400 to-cyan-600',
  Primal: 'from-red-400 to-red-600',
  Origin: 'from-yellow-400 to-yellow-600',
};

export const EvolutionCardGallery = () => {
  const { user } = useAuth();
  const [selectedCard, setSelectedCard] = useState<EvolutionCard | null>(null);

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
      
      // Cast the data with proper types
      return (data || []).map(card => ({
        ...card,
        stats: card.stats as EvolutionCard['stats']
      })) as EvolutionCard[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
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
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card 
              className="overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 group relative"
              onClick={() => setSelectedCard(card)}
            >
              {/* Rarity gradient border */}
              <div className={`absolute inset-0 bg-gradient-to-br ${RARITY_COLORS[card.rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.Common} opacity-20 group-hover:opacity-40 transition-opacity`} />
              
              <div className="relative p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg line-clamp-1">{card.creature_name}</h3>
                    <p className="text-xs text-muted-foreground">Stage {card.evolution_stage} • {card.species}</p>
                  </div>
                  <Badge className={`bg-gradient-to-r ${RARITY_COLORS[card.rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.Common} text-white border-0`}>
                    {card.rarity}
                  </Badge>
                </div>

                {/* Card ID */}
                <div className="font-mono text-xs text-muted-foreground truncate">
                  {card.card_id}
                </div>

                {/* Element & Bond */}
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    {card.element}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Heart className="h-3 w-3 mr-1" />
                    Bond {card.bond_level}
                  </Badge>
                </div>

                {/* Stats Preview */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-red-500" />
                    <span>{card.stats.strength}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    <span>{card.stats.agility}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3 text-green-500" />
                    <span>{card.stats.vitality}</span>
                  </div>
                </div>

                {/* Traits */}
                <div className="flex flex-wrap gap-1">
                  {card.traits.slice(0, 2).map((trait, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {trait}
                    </Badge>
                  ))}
                  {card.traits.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{card.traits.length - 2}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Card Detail Modal */}
      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          {selectedCard && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{selectedCard.creature_name}</span>
                  <Badge className={`bg-gradient-to-r ${RARITY_COLORS[selectedCard.rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.Common} text-white border-0`}>
                    {selectedCard.rarity}
                  </Badge>
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Stage {selectedCard.evolution_stage} {selectedCard.species} • {selectedCard.element}
                </p>
                <p className="font-mono text-xs text-muted-foreground">{selectedCard.card_id}</p>
              </DialogHeader>

              <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
                <div className="space-y-6">
                  {/* Stats */}
                  <div>
                    <h4 className="font-semibold mb-3">Stats</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Strength</span>
                        <span className="font-bold">{selectedCard.stats.strength}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Agility</span>
                        <span className="font-bold">{selectedCard.stats.agility}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Vitality</span>
                        <span className="font-bold">{selectedCard.stats.vitality}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Intellect</span>
                        <span className="font-bold">{selectedCard.stats.intellect}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Spirit</span>
                        <span className="font-bold">{selectedCard.stats.spirit}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Affinity</span>
                        <span className="font-bold">{selectedCard.stats.affinity}</span>
                      </div>
                    </div>
                  </div>

                  {/* Traits */}
                  <div>
                    <h4 className="font-semibold mb-3">Traits</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCard.traits.map((trait, i) => (
                        <Badge key={i} variant="secondary">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Story */}
                  <div>
                    <h4 className="font-semibold mb-3">Story</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {selectedCard.story_text}
                    </p>
                  </div>

                  {/* Lore Seed */}
                  <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                    <p className="text-sm italic text-muted-foreground">
                      {selectedCard.lore_seed}
                    </p>
                  </div>

                  {/* Bond Level */}
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-semibold">Bond Level: {selectedCard.bond_level}</span>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};