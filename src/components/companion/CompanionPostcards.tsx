import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionPostcards, CompanionPostcard } from "@/hooks/useCompanionPostcards";
import { PostcardCard } from "./PostcardCard";
import { PostcardFullscreen } from "./PostcardFullscreen";
import { PostcardsTutorialModal } from "@/components/PostcardsTutorialModal";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { MapPin, Sparkles, BookOpen, ChevronRight, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StoryTypeSlug } from "@/types/narrativeTypes";

const storyTypeIcons: Record<StoryTypeSlug, string> = {
  treasure_hunt: "🗺️",
  mystery: "🔮",
  pilgrimage: "🧭",
  heroes_journey: "⚔️",
  rescue_mission: "💖",
  exploration: "🏔️",
};

interface EpicInfo {
  id: string;
  title: string;
  book_title: string | null;
  story_type_slug: string | null;
  total_chapters: number | null;
}

export const CompanionPostcards = () => {
  const { postcards, isLoading } = useCompanionPostcards();
  const [selectedPostcard, setSelectedPostcard] = useState<CompanionPostcard | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal("postcards");
  const [manualTutorialOpen, setManualTutorialOpen] = useState(false);

  // Fetch epic info for grouping
  const epicIds = useMemo(() => 
    [...new Set(postcards.map(p => p.epic_id).filter(Boolean))] as string[],
    [postcards]
  );

  const { data: epics } = useQuery({
    queryKey: ["postcards-epics", epicIds],
    queryFn: async () => {
      if (epicIds.length === 0) return [];
      const { data, error } = await supabase
        .from("epics")
        .select("id, title, book_title, story_type_slug, total_chapters, status")
        .in("id", epicIds);
      if (error) throw error;
      return data as (EpicInfo & { status: string })[];
    },
    enabled: epicIds.length > 0,
  });

  const epicMap = useMemo(() => {
    const map = new Map<string, EpicInfo & { status: string }>();
    epics?.forEach(e => map.set(e.id, e));
    return map;
  }, [epics]);

  // Group postcards by epic
  const groupedPostcards = useMemo(() => {
    const groups: Record<string, { epic: EpicInfo & { status: string } | null; postcards: CompanionPostcard[] }> = {};
    
    postcards.forEach(postcard => {
      const epicId = postcard.epic_id || "standalone";
      if (!groups[epicId]) {
        groups[epicId] = {
          epic: postcard.epic_id ? epicMap.get(postcard.epic_id) || null : null,
          postcards: [],
        };
      }
      groups[epicId].postcards.push(postcard);
    });

    // Sort postcards within each group by chapter number
    Object.values(groups).forEach(group => {
      group.postcards.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
    });

    return groups;
  }, [postcards, epicMap]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (filter === "all") return groupedPostcards;
    
    const filtered: typeof groupedPostcards = {};
    Object.entries(groupedPostcards).forEach(([key, group]) => {
      if (filter === "completed" && group.epic?.status === "completed") {
        filtered[key] = group;
      } else if (filter === "active" && group.epic?.status !== "completed") {
        filtered[key] = group;
      } else if (key === "standalone") {
        filtered[key] = group;
      }
    });
    return filtered;
  }, [groupedPostcards, filter]);

  const totalPostcards = postcards.length;
  const totalEpics = epicIds.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tutorial Modal */}
      <PostcardsTutorialModal 
        open={showTutorial || manualTutorialOpen} 
        onClose={() => {
          dismissTutorial();
          setManualTutorialOpen(false);
        }} 
      />

      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Cosmic Postcards</h3>
          <button
            onClick={() => setManualTutorialOpen(true)}
            className="p-1 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="Learn about postcards"
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span>{totalPostcards} chapters</span>
          {totalEpics > 0 && (
            <span className="text-muted-foreground/60">• {totalEpics} paths</span>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      {totalPostcards > 0 && totalEpics > 0 && (
        <div className="flex gap-2">
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {totalPostcards === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 px-6"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary/60" />
          </div>
          <h4 className="text-lg font-medium text-foreground mb-2">
            Your Story Awaits
          </h4>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
            As you complete Quests and progress through Campaigns, your companion's journey unfolds through cosmic postcards—each one a chapter in your adventure.
          </p>

          <div className="bg-card/50 rounded-xl p-4 border border-border/50 text-left max-w-xs mx-auto">
            <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              How to Unlock
            </h5>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 text-primary" />
                <span>Open Quests and start a Campaign (or choose a Star Path).</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 text-primary" />
                <span>Complete quests and rituals to progress your campaign.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 text-primary" />
                <span>Reach campaign milestones to unlock story chapters.</span>
              </li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* Grouped Postcards */}
      {totalPostcards > 0 && (
        <div className="space-y-6">
          {Object.entries(filteredGroups).map(([epicId, group]) => (
            <motion.div
              key={epicId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {/* Epic Header */}
              {group.epic && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {storyTypeIcons[(group.epic.story_type_slug as StoryTypeSlug) || "heroes_journey"]}
                    </span>
                    <div>
                      <h4 className="text-sm font-medium text-foreground line-clamp-1">
                        {group.epic.book_title || group.epic.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {group.postcards.length}/{group.epic.total_chapters || "?"} chapters
                      </p>
                    </div>
                  </div>
                  {group.epic.status === "completed" && (
                    <Badge variant="secondary" className="text-[10px] bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                      Complete
                    </Badge>
                  )}
                </div>
              )}

              {/* Postcards Grid */}
              <div className="grid grid-cols-2 gap-3">
                {group.postcards.map((postcard, index) => (
                  <motion.div
                    key={postcard.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <PostcardCard
                      postcard={postcard}
                      onClick={() => setSelectedPostcard(postcard)}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
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
