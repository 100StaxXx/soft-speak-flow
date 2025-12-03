import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionPostcards, CompanionPostcard } from "@/hooks/useCompanionPostcards";
import { PostcardCard } from "./PostcardCard";
import { PostcardFullscreen } from "./PostcardFullscreen";
import { MapPin, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Mystery locations for uncollected postcards
const mysteryLocations = [
  { milestone: 25, hint: "A place where stars are born..." },
  { milestone: 50, hint: "Between dimensions, energy flows..." },
  { milestone: 75, hint: "Ancient cosmic structures await..." },
  { milestone: 100, hint: "The pinnacle of all creation..." },
];

export const CompanionPostcards = () => {
  const { postcards, isLoading } = useCompanionPostcards();
  const [selectedPostcard, setSelectedPostcard] = useState<CompanionPostcard | null>(null);

  // Group postcards by epic
  const postcardsByEpic = postcards.reduce((acc, postcard) => {
    const epicId = postcard.epic_id || 'no-epic';
    if (!acc[epicId]) acc[epicId] = [];
    acc[epicId].push(postcard);
    return acc;
  }, {} as Record<string, CompanionPostcard[]>);

  const totalPostcards = postcards.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Cosmic Postcards</h3>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span>{totalPostcards} collected</span>
        </div>
      </div>

      {/* Empty State */}
      {totalPostcards === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 px-6"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary/60" />
          </div>
          <h4 className="text-lg font-medium text-foreground mb-2">
            Your Journey Awaits
          </h4>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Complete Star Path milestones to unlock cosmic postcards of your companion's journey through the universe!
          </p>

          {/* Mystery Preview */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {mysteryLocations.map((loc) => (
              <div
                key={loc.milestone}
                className="relative p-4 rounded-xl bg-card/50 border border-border/50"
              >
                <div className="absolute top-2 right-2">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
                </div>
                <div className="text-xs font-medium text-primary mb-1">
                  {loc.milestone}% Milestone
                </div>
                <p className="text-xs text-muted-foreground italic">
                  {loc.hint}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Postcards Grid */}
      {totalPostcards > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 gap-4"
        >
          {postcards.map((postcard, index) => (
            <motion.div
              key={postcard.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <PostcardCard
                postcard={postcard}
                onClick={() => setSelectedPostcard(postcard)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {selectedPostcard && (
          <PostcardFullscreen
            postcard={selectedPostcard}
            onClose={() => setSelectedPostcard(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
