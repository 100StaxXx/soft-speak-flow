import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionStory } from "@/hooks/useCompanionStory";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles, Loader2, Lock, Grid3x3, Heart, Lightbulb } from "lucide-react";
import { Separator } from "./ui/separator";
import { getStageName } from "@/config/companionStages";
import { toast } from "sonner";

import { StoryJournalInfoTooltip } from "./StoryJournalInfoTooltip";

export const CompanionStoryJournal = () => {
  const { companion, isLoading: companionLoading } = useCompanion();
  const [viewingStage, setViewingStage] = useState(0);
  const [debouncedStage, setDebouncedStage] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  
  // Debounce stage changes to prevent race conditions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStage(viewingStage);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [viewingStage]);
  
  
  const { story, allStories, isLoading, generateStory } = useCompanionStory(
    companion?.id,
    debouncedStage
  );

  // Fetch companion evolution image for current stage with Stage 0 handling
  const { data: evolutionImage } = useQuery<string | null>({
    queryKey: ["companion-evolution-image", companion?.id, debouncedStage],
    queryFn: async () => {
      if (!companion) return null;
      
      try {
        // Query companion_evolutions for the specific stage (including stage 0)
        const { data, error } = await supabase
          .from("companion_evolutions")
          .select("image_url")
          .eq("companion_id", companion.id)
          .eq("stage", debouncedStage)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Failed to fetch evolution image:', error);
        }
        
        // If we found an image for this stage, use it
        if (data?.image_url) {
          return data.image_url;
        }
        
        // Fallback for stage 0 (egg) if no evolution record exists
        if (debouncedStage === 0) {
          return '/placeholder-egg.svg';
        }
        
        // Fallback for other stages
        return companion.current_image_url || '/placeholder-companion.svg';
      } catch (error) {
        console.error('Error in evolution image query:', error);
        return debouncedStage === 0 ? '/placeholder-egg.svg' : (companion.current_image_url || '/placeholder-companion.svg');
      }
    },
    enabled: !!companion,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    placeholderData: (previousData) => previousData, // Prevent flashing during navigation
  });

  const handleGenerate = useCallback(() => {
    if (!companion) {
      toast.error("Companion not loaded. Please refresh the page.");
      return;
    }
    generateStory.mutate({
      companionId: companion.id,
      stage: debouncedStage,
    });
  }, [companion, debouncedStage, generateStory]);

  // Check if this stage can be accessed (must be at or below companion's current stage)
  const canAccessStage = useCallback((stage: number) => {
    if (!companion) return false;
    return stage <= companion.current_stage;
  }, [companion]);

  const isStageUnlocked = canAccessStage(debouncedStage);

  // Calculate which stages to show in gallery (unlocked + 1 preview)
  const maxVisibleStage = companion ? Math.min(companion.current_stage + 1, 20) : 0;
  const galleryStages = Array.from({ length: maxVisibleStage + 1 }, (_, i) => i);

  // Show loading state
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

  // Show empty state if no companion
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
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {showGallery && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Chapter Gallery</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowGallery(false)}>
              Close
            </Button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {galleryStages.map((i) => {
              const isUnlocked = canAccessStage(i);
              const hasStory = allStories?.some(s => s.stage === i);
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (isUnlocked) {
                      setViewingStage(i);
                      setShowGallery(false);
                    }
                  }}
                  disabled={!isUnlocked}
                  className={`
                    relative aspect-square rounded-lg border-2 p-2 flex flex-col items-center justify-center gap-1 transition-all
                    ${isUnlocked 
                      ? 'border-primary/30 hover:border-primary hover:bg-primary/5 cursor-pointer' 
                      : 'border-muted bg-muted/30 cursor-not-allowed opacity-50'
                    }
                    ${viewingStage === i ? 'ring-2 ring-primary bg-primary/10' : ''}
                  `}
                >
                  {isUnlocked ? (
                    <>
                      <BookOpen className={`w-4 h-4 ${hasStory ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs font-medium">{i === 0 ? 'P' : i}</span>
                      {hasStory && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{i}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Story Journal
          </h1>
          <StoryJournalInfoTooltip />
        </div>
        <p className="text-muted-foreground">
          Your companion's epic journey - unlock new chapters as they evolve
        </p>
      </div>

      {/* Progress indicator & Gallery button */}
      <div className="flex justify-center items-center gap-4">
        <div className="text-sm text-muted-foreground">
          Unlocked: Prologue + {companion.current_stage} Chapters ({allStories?.length || 0} written)
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

      {/* Navigation */}
      <Card className="p-6">
        {/* Companion Image at current stage */}
        {evolutionImage && isStageUnlocked && (
          <div className="flex justify-center mb-6">
            <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-glow">
              <img 
                src={evolutionImage} 
                alt={`${companion.spirit_animal} at ${getStageName(debouncedStage)}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('Image failed to load:', evolutionImage);
                  e.currentTarget.src = debouncedStage === 0 
                    ? '/placeholder-egg.svg' 
                    : '/placeholder-companion.svg';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-2">
                <p className="text-xs text-center font-medium text-foreground">
                  {getStageName(debouncedStage)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewingStage(Math.max(0, viewingStage - 1))}
            disabled={viewingStage === 0}
            className="flex-shrink-0 px-2 sm:px-3"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Previous</span>
          </Button>

          <div className="text-center min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {debouncedStage === 0 ? "Prologue" : `Chapter ${debouncedStage}`}
            </p>
            <p className="font-semibold text-sm sm:text-base truncate">{getStageName(debouncedStage)}</p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const nextStage = viewingStage + 1;
              if (canAccessStage(nextStage)) {
                setViewingStage(nextStage);
              }
            }}
            disabled={viewingStage === 20 || !canAccessStage(viewingStage + 1)}
            className="flex-shrink-0 px-2 sm:px-3"
          >
            <span className="hidden sm:inline mr-1">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Separator className="my-6" />

        {/* Stage Locked Message */}
        {!isStageUnlocked && (
          <Card className="p-8 text-center">
            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Chapter Locked</h3>
            <p className="text-muted-foreground">
              {debouncedStage === 0 
                ? "Complete companion creation to unlock the Prologue"
                : `This chapter unlocks when your companion reaches Stage ${debouncedStage}`
              }
            </p>
          </Card>
        )}

        {/* Story Display - 5 Sections */}
        {isStageUnlocked && story ? (
          <div className="space-y-6">
            {/* Section 1: Chapter Header */}
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">
                {debouncedStage === 0 ? "Prologue" : `Chapter ${debouncedStage}`}: {story.chapter_title}
              </h2>
              <p className="text-lg text-muted-foreground italic">"{story.intro_line}"</p>
            </div>

            <Separator />

            {/* Section 2: The Journey (Main Story) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BookOpen className="w-4 h-4" />
                <span>The Journey</span>
              </div>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">{story.main_story}</p>
            </div>

            {/* Section 3: Bond Moment */}
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary">
                <Heart className="w-4 h-4" />
                <span>Bond Moment</span>
              </div>
              <p className="text-sm text-foreground/90">{story.bond_moment}</p>
            </div>

            {/* Section 4: Wisdom Gained */}
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
        ) : isStageUnlocked ? (
          <Card className="p-8 text-center space-y-4">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">Chapter Not Yet Written</h3>
              <p className="text-muted-foreground mb-6">
                {debouncedStage === 0 
                  ? "The beginning of your companion's story awaits..."
                  : `Write this chapter of your companion's story to continue the journey.`
                }
              </p>
              
              <Button
                onClick={handleGenerate}
                disabled={generateStory.isPending || isLoading}
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
                    Write {debouncedStage === 0 ? "Prologue" : `Chapter ${debouncedStage}`}
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
