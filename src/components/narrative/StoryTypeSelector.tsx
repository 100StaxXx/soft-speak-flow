import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Map, Search, Compass, Sword, Heart, Mountain, ChevronDown } from "lucide-react";
import type { StoryTypeSlug } from "@/types/narrativeTypes";

interface StoryType {
  slug: StoryTypeSlug;
  name: string;
  description: string;
  icon: typeof Map;
  baseChapters: number;
  bossHint: string;
  color: string;
}

const storyTypes: StoryType[] = [
  {
    slug: "treasure_hunt",
    name: "Treasure Hunt",
    description: "Follow clues to a legendary artifact hidden among the stars",
    icon: Map,
    baseChapters: 5,
    bossHint: "The Guardian of Lost Treasures",
    color: "from-amber-500 to-yellow-600",
  },
  {
    slug: "mystery",
    name: "Cosmiq Mystery",
    description: "Unravel secrets that threaten the fabric of reality",
    icon: Search,
    baseChapters: 6,
    bossHint: "The Keeper of Forgotten Truths",
    color: "from-purple-500 to-indigo-600",
  },
  {
    slug: "pilgrimage",
    name: "Sacred Pilgrimage",
    description: "Journey to sacred sites seeking enlightenment and peace",
    icon: Compass,
    baseChapters: 4,
    bossHint: "The Trial of Inner Shadows",
    color: "from-cyan-500 to-teal-600",
  },
  {
    slug: "heroes_journey",
    name: "Hero's Journey",
    description: "Answer the call to adventure and become a legend",
    icon: Sword,
    baseChapters: 6,
    bossHint: "The Dark Mirror of Destiny",
    color: "from-red-500 to-orange-600",
  },
  {
    slug: "rescue_mission",
    name: "Rescue Mission",
    description: "Race against time to save someone precious from darkness",
    icon: Heart,
    baseChapters: 5,
    bossHint: "The Void That Consumes",
    color: "from-pink-500 to-rose-600",
  },
  {
    slug: "exploration",
    name: "Uncharted Realms",
    description: "Discover new worlds and map the unknown cosmos",
    icon: Mountain,
    baseChapters: 5,
    bossHint: "The Primordial Chaos",
    color: "from-emerald-500 to-green-600",
  },
];

interface StoryTypeSelectorProps {
  selectedType: StoryTypeSlug | null;
  onSelect: (type: StoryTypeSlug) => void;
}

export const StoryTypeSelector = ({ selectedType, onSelect }: StoryTypeSelectorProps) => {
  const [expandedType, setExpandedType] = useState<StoryTypeSlug | null>(null);

  const handleCardClick = (slug: StoryTypeSlug) => {
    if (expandedType === slug) {
      // If already expanded, just select it
      onSelect(slug);
    } else {
      // Expand the card
      setExpandedType(slug);
      onSelect(slug);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground mb-2">
        Choose Your Adventure Type
      </div>
      <div className="grid grid-cols-2 gap-3">
        {storyTypes.map((type, index) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.slug;
          const isExpanded = expandedType === type.slug;
          
          return (
            <motion.div
              key={type.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              layout
            >
              <Card
                className={cn(
                  "p-3 cursor-pointer transition-all border-2",
                  "hover:scale-[1.02] hover:shadow-lg",
                  isSelected 
                    ? "border-primary bg-primary/10 shadow-glow" 
                    : "border-transparent hover:border-primary/30"
                )}
                onClick={() => handleCardClick(type.slug)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    "bg-gradient-to-br",
                    type.color
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">{type.name}</h4>
                      {isSelected && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Selected
                        </Badge>
                      )}
                    </div>
                    
                    <AnimatePresence mode="wait">
                      {isExpanded ? (
                        <motion.p
                          key="full"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-[11px] text-muted-foreground mt-0.5"
                        >
                          {type.description}
                        </motion.p>
                      ) : (
                        <motion.div
                          key="truncated"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-1 mt-0.5"
                        >
                          <p className="text-[11px] text-muted-foreground line-clamp-1 flex-1">
                            {type.description}
                          </p>
                          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      
      {selectedType && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg"
        >
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">Final Boss Hint:</span>{" "}
            {storyTypes.find(t => t.slug === selectedType)?.bossHint}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export { storyTypes };
