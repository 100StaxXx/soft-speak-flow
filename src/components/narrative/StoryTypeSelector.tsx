import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Map, Search, Compass, Sword, Heart, Mountain } from "lucide-react";
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
    name: "Cosmic Mystery",
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
  targetDays: number;
}

export const StoryTypeSelector = ({ selectedType, onSelect, targetDays }: StoryTypeSelectorProps) => {
  // Calculate chapters based on duration
  const calculateChapters = (baseChapters: number) => {
    if (targetDays <= 14) return Math.max(3, baseChapters - 2);
    if (targetDays <= 30) return baseChapters;
    if (targetDays <= 60) return baseChapters + 1;
    return baseChapters + 2;
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground mb-2">
        Choose Your Adventure Type
      </div>
      <div className="grid grid-cols-2 gap-3">
        {storyTypes.map((type, index) => {
          const Icon = type.icon;
          const chapters = calculateChapters(type.baseChapters);
          const isSelected = selectedType === type.slug;
          
          return (
            <motion.div
              key={type.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={cn(
                  "p-3 cursor-pointer transition-all border-2",
                  "hover:scale-[1.02] hover:shadow-lg",
                  isSelected 
                    ? "border-primary bg-primary/10 shadow-glow" 
                    : "border-transparent hover:border-primary/30"
                )}
                onClick={() => onSelect(type.slug)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
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
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                      {type.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {chapters} Chapters
                      </Badge>
                    </div>
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
