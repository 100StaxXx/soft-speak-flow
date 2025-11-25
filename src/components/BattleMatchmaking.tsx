import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Swords, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { BattleCardSelector } from "./BattleCardSelector";

export const BattleMatchmaking = () => {
  const { user } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  // Check if user has evolution cards
  const { data: cards, isLoading } = useQuery({
    queryKey: ["battle-cards", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("companion_evolution_cards")
        .select("*")
        .eq("user_id", user.id)
        .order("evolution_stage", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleFindMatch = async () => {
    if (selectedCards.length !== 3) {
      toast.error("Select exactly 3 cards for your deck!");
      return;
    }

    setIsSearching(true);
    toast("Searching for opponents...", {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
    });

    try {
      // TODO: Implement matchmaking logic via edge function
      // For now, show a message
      setTimeout(() => {
        setIsSearching(false);
        toast.info("Matchmaking coming soon! Building the battle system first.");
      }, 2000);
    } catch (error) {
      console.error("Matchmaking error:", error);
      toast.error("Failed to find match");
      setIsSearching(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your cards...</p>
        </div>
      </Card>
    );
  }

  if (!cards || cards.length < 3) {
    return (
      <Card className="p-8 text-center">
        <Swords className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Not Enough Cards</h3>
        <p className="text-sm text-muted-foreground mb-4">
          You need at least 3 evolution cards to battle. Keep evolving your companion!
        </p>
        <p className="text-xs text-muted-foreground">
          Cards unlock at every evolution stage (0-20)
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deck Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Build Your Deck
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select exactly 3 cards (no duplicates)
        </p>

        <BattleCardSelector
          cards={cards}
          selectedCards={selectedCards}
          onCardSelect={(cardId) => {
            if (selectedCards.includes(cardId)) {
              setSelectedCards(selectedCards.filter((id) => id !== cardId));
            } else if (selectedCards.length < 3) {
              setSelectedCards([...selectedCards, cardId]);
            } else {
              toast.error("Maximum 3 cards allowed!");
            }
          }}
        />
      </Card>

      {/* Matchmaking Button */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">Ready for Battle?</h3>
            <p className="text-sm text-muted-foreground">
              3-Player Free-For-All • Last One Standing Wins
            </p>
          </div>

          <Button
            size="lg"
            onClick={handleFindMatch}
            disabled={isSearching || selectedCards.length !== 3}
            className="w-full max-w-xs bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Searching...
              </>
            ) : (
              <>
                <Swords className="h-5 w-5 mr-2" />
                Find Match
              </>
            )}
          </Button>

          {selectedCards.length !== 3 && (
            <p className="text-xs text-muted-foreground">
              {selectedCards.length}/3 cards selected
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
