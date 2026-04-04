import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionStory } from "@/hooks/useCompanionStory";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Lock,
  Grid3x3,
  Heart,
  Lightbulb,
} from "lucide-react";
import { Separator } from "./ui/separator";
import { toast } from "@/components/ui/sonner";
import {
  getPresetCompanionAssetUrl,
  getUniversalEggAssetUrl,
} from "@/lib/companionAssetResolver";
import {
  PROGRESSION_STORY_CHECKPOINT_LEVELS,
  getProgressionLevelDisplay,
} from "@/config/progression";
import { StoryJournalInfoTooltip } from "./StoryJournalInfoTooltip";
import { CompanionImage } from "./CompanionImage";
import { cn } from "@/lib/utils";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";

interface CompanionStoryJournalProps {
  layoutMode?: CompanionLayoutMode;
}

export const CompanionStoryJournal = ({ layoutMode = "mobile" }: CompanionStoryJournalProps) => {
  const { companion, isLoading: companionLoading } = useCompanion();
  const [viewingLevel, setViewingLevel] = useState(0);
  const [debouncedLevel, setDebouncedLevel] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const isDesktop = layoutMode === "desktop";

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLevel(viewingLevel);
    }, 300);

    return () => clearTimeout(timer);
  }, [viewingLevel]);

  const { story, allStories, isLoading, generateStory } = useCompanionStory(
    companion?.id,
    debouncedLevel,
  );

  const checkpointLevels = useMemo<number[]>(
    () => [...PROGRESSION_STORY_CHECKPOINT_LEVELS],
    [],
  );

  const { data: chapterImage } = useQuery<string | null>({
    queryKey: ["companion-story-image", companion?.id, debouncedLevel],
    queryFn: async () => {
      if (!companion) return null;

      if (debouncedLevel === 0) {
        return getUniversalEggAssetUrl(companion.core_element) || "/placeholder-egg.svg";
      }

      if (companion.preset_id) {
        const presetImageUrl = getPresetCompanionAssetUrl({
          presetId: companion.preset_id,
          stage: debouncedLevel,
          element: companion.core_element,
          state: "normal",
        });

        if (presetImageUrl) {
          return presetImageUrl;
        }
      }

      return companion.current_image_url || "/placeholder-companion.svg";
    },
    enabled: !!companion,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const handleGenerate = useCallback(() => {
    if (!companion) {
      toast.error("Companion not loaded. Please refresh the page.");
      return;
    }

    generateStory.mutate({
      companionId: companion.id,
      stage: debouncedLevel,
    });
  }, [companion, debouncedLevel, generateStory]);

  const canAccessLevel = useCallback((level: number) => {
    if (!companion) return false;
    return level <= companion.current_stage;
  }, [companion]);

  const isLevelUnlocked = canAccessLevel(debouncedLevel);
  const unlockedCheckpointCount = checkpointLevels.filter((level) => canAccessLevel(level)).length;
  const nextCheckpoint = checkpointLevels.find((level) => !canAccessLevel(level)) ?? null;
  const visibleLevels = nextCheckpoint === null
    ? checkpointLevels
    : checkpointLevels.filter((level) => level <= nextCheckpoint);

  const currentIndex = checkpointLevels.indexOf(viewingLevel);
  const previousLevel = currentIndex > 0 ? checkpointLevels[currentIndex - 1] : null;
  const nextLevel = currentIndex >= 0 && currentIndex < checkpointLevels.length - 1
    ? checkpointLevels[currentIndex + 1]
    : null;
  const hasStory = allStories?.some((entry) => entry.stage === debouncedLevel) ?? false;
  const chapterLabel = debouncedLevel === 0 ? "Prologue" : getProgressionLevelDisplay(debouncedLevel);
  const chapterImageFocal = useMemo(() => {
    if (!companion) return { x: null, y: null };
    if (debouncedLevel === 0) {
      return {
        x: companion.initial_image_focal_x ?? companion.current_image_focal_x ?? null,
        y: companion.initial_image_focal_y ?? companion.current_image_focal_y ?? null,
      };
    }

    return {
      x: companion.current_image_focal_x ?? null,
      y: companion.current_image_focal_y ?? null,
    };
  }, [
    companion,
    debouncedLevel,
  ]);

  if (companionLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading your companion's story...</p>
        </div>
      </Card>
    );
  }

  if (!companion) {
    return (
      <Card className="p-8 text-center">
        <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          Create your companion first to unlock the Story Journal
        </p>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", isDesktop ? "max-w-none p-0" : "max-w-4xl mx-auto p-4")}>
      {showGallery && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Chapter Gallery</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowGallery(false)}>
              Close
            </Button>
          </div>
          <div className={cn("grid gap-3", isDesktop ? "grid-cols-4 xl:grid-cols-6" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6")}>
            {visibleLevels.map((level) => {
              const isUnlocked = canAccessLevel(level);
              const levelHasStory = allStories?.some((entry) => entry.stage === level);
              return (
                <button
                  key={level}
                  onClick={() => {
                    if (isUnlocked) {
                      setViewingLevel(level);
                      setShowGallery(false);
                    }
                  }}
                  disabled={!isUnlocked}
                  className={`
                    relative aspect-square rounded-lg border-2 p-2 flex flex-col items-center justify-center gap-1 transition-all
                    ${isUnlocked
                      ? "border-primary/30 hover:border-primary hover:bg-primary/5 cursor-pointer"
                      : "border-muted bg-muted/30 cursor-not-allowed opacity-50"
                    }
                    ${viewingLevel === level ? "ring-2 ring-primary bg-primary/10" : ""}
                  `}
                >
                  {isUnlocked ? (
                    <>
                      <BookOpen className={`w-4 h-4 ${levelHasStory ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-medium">{level === 0 ? "P" : `L${level}`}</span>
                      {levelHasStory && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{level}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className={cn("space-y-2", isDesktop ? "text-left" : "text-center")}>
        <div className={cn("flex items-center gap-2", isDesktop ? "justify-start" : "justify-center")}>
          <h1 className="text-3xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Story Journal
          </h1>
          <StoryJournalInfoTooltip />
        </div>
        <p className="text-muted-foreground">
          New chapters unlock at key companion tiers, from the first hatch through Ascended.
        </p>
      </div>

      <div className={cn("flex items-center gap-4", isDesktop ? "justify-between" : "justify-center")}>
        <div className="text-sm text-muted-foreground">
          Unlocked: {unlockedCheckpointCount} of {checkpointLevels.length} checkpoints ({allStories?.length || 0} written)
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGallery(!showGallery)}
        >
          <Grid3x3 className="w-4 h-4 mr-2" />
          {showGallery ? "Close Gallery" : "Gallery"}
        </Button>
      </div>

      <Card className={cn(isDesktop ? "p-8" : "p-6")}>
        {chapterImage && isLevelUnlocked && (
          <div className="flex justify-center mb-6">
            <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-glow">
              <CompanionImage
                src={chapterImage}
                alt={`${companion.spirit_animal} at ${chapterLabel}`}
                focalX={chapterImageFocal.x}
                focalY={chapterImageFocal.y}
                className="w-full h-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = debouncedLevel === 0
                    ? "/placeholder-egg.svg"
                    : "/placeholder-companion.svg";
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                <p className="text-xs text-center font-medium text-foreground">
                  {chapterLabel}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (previousLevel !== null) {
                setViewingLevel(previousLevel);
              }
            }}
            disabled={previousLevel === null}
            className="flex-shrink-0 px-2 sm:px-3"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Previous</span>
          </Button>

          <div className="text-center min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {debouncedLevel === 0 ? "Origin checkpoint" : "Tier checkpoint"}
            </p>
            <p className="font-semibold text-sm sm:text-base truncate">{chapterLabel}</p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (nextLevel !== null && canAccessLevel(nextLevel)) {
                setViewingLevel(nextLevel);
              }
            }}
            disabled={nextLevel === null || !canAccessLevel(nextLevel)}
            className="flex-shrink-0 px-2 sm:px-3"
          >
            <span className="hidden sm:inline mr-1">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Separator className="my-6" />

        {!isLevelUnlocked && (
          <Card className="p-8 text-center">
            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Chapter Locked</h3>
            <p className="text-muted-foreground">
              {debouncedLevel === 0
                ? "Complete companion creation to unlock the Prologue"
                : `This chapter unlocks when your companion reaches ${getProgressionLevelDisplay(debouncedLevel)}`}
            </p>
          </Card>
        )}

        {isLevelUnlocked && story ? (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">
                {chapterLabel}: {story.chapter_title}
              </h2>
              <p className="text-lg text-muted-foreground italic">"{story.intro_line}"</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BookOpen className="w-4 h-4" />
                <span>The Journey</span>
              </div>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">{story.main_story}</p>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
                <Heart className="w-4 h-4" />
                <span>Bond Moment</span>
              </div>
              <p className="text-sm text-foreground/90">{story.bond_moment}</p>
            </div>

            {story.life_lesson && (
              <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-amber-600 dark:text-amber-400">
                  <Lightbulb className="w-4 h-4" />
                  <span>Wisdom Gained</span>
                </div>
                <p className="text-sm text-foreground/90">{story.life_lesson}</p>
              </div>
            )}
          </div>
        ) : isLevelUnlocked ? (
          <Card className="p-8 text-center space-y-4">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">Chapter Not Yet Written</h3>
              <p className="text-muted-foreground mb-6">
                {debouncedLevel === 0
                  ? "The beginning of your companion's story awaits..."
                  : `Write the ${chapterLabel} chapter to continue the journey.`}
              </p>

              <Button
                onClick={handleGenerate}
                disabled={generateStory.isPending || isLoading || hasStory}
                className="w-full max-w-sm mx-auto"
              >
                {generateStory.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Writing chapter...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Write {chapterLabel}
                  </>
                )}
              </Button>
            </div>
          </Card>
        ) : null}
      </Card>
    </div>
  );
};
