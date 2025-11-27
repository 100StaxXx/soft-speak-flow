import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionStory } from "@/hooks/useCompanionStory";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles, Loader2, Lock, Share2, Grid3x3 } from "lucide-react";
import { Separator } from "./ui/separator";
import { getStageName } from "@/config/companionStages";
import { toast } from "sonner";
import { safeClipboardWrite, isClipboardAvailable, getClipboardErrorMessage } from "@/utils/clipboard";

export const CompanionStoryJournal = () => {
  const { companion, isLoading: companionLoading } = useCompanion();
  const [viewingStage, setViewingStage] = useState(0);
  const [debouncedStage, setDebouncedStage] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  // Debounce stage changes to prevent race conditions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStage(viewingStage);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [viewingStage]);
  
  // Check if sharing is supported
  useEffect(() => {
    const checkShareSupport = async () => {
      try {
        // Dynamically import Capacitor modules to prevent web build issues
        const { Capacitor } = await import("@capacitor/core");
        
        if (Capacitor.isNativePlatform()) {
          const { Share } = await import("@capacitor/share");
          const canShareResult = await Share.canShare();
          setCanShare(canShareResult.value);
        } else {
          // Check for Web Share API or clipboard as fallback
          setCanShare(!!navigator.share || isClipboardAvailable());
        }
      } catch (error) {
        // Capacitor not available, check web share API or clipboard fallback
        setCanShare(!!navigator.share || isClipboardAvailable());
      }
    };
    checkShareSupport();
  }, []);
  
  const { story, allStories, isLoading, generateStory } = useCompanionStory(
    companion?.id,
    debouncedStage
  );

  // Fetch companion evolution image for current stage with Stage 0 handling
  const { data: evolutionImage, isLoading: isImageLoading } = useQuery<string | null>({
    queryKey: ["companion-evolution-image", companion?.id, debouncedStage],
    queryFn: async () => {
      if (!companion) return null;
      
      try {
        // Special handling for Stage 0 (Egg state)
        if (debouncedStage === 0) {
          // Return current image or a placeholder
          return companion.current_image_url || '/placeholder-egg.png';
        }
        
        const { data, error } = await supabase
          .from("companion_evolutions")
          .select("image_url")
          .eq("companion_id", companion.id)
          .eq("stage", debouncedStage)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Failed to fetch evolution image:', error);
          return companion.current_image_url || '/placeholder-companion.png';
        }
        
        return data?.image_url || companion.current_image_url || '/placeholder-companion.png';
      } catch (error) {
        console.error('Error in evolution image query:', error);
        return companion.current_image_url || '/placeholder-companion.png';
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

  const handleShare = async () => {
    if (isSharing) return; // Prevent double-click
    
    if (!story) {
      toast.error("No story to share");
      return;
    }
    
    if (!canShare) {
      toast.error("Sharing is not supported on this device");
      return;
    }
    
    setIsSharing(true);
    
    try {
      // Create chapter text once (fixes Bug #3: code duplication)
      const chapterText = `${story.chapter_title}\n\n${story.intro_line}\n\n${story.main_story}`;
      const shareData = {
        title: `${debouncedStage === 0 ? "Prologue" : `Chapter ${debouncedStage}`}: ${story.chapter_title}`,
        text: chapterText,
      };

      // Dynamically import Capacitor for native platforms
      const { Capacitor } = await import("@capacitor/core");
      
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import("@capacitor/share");
        await Share.share(shareData);
        toast.success("Story shared!");
      } else if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Story shared!");
      } else {
        // Fallback: copy to clipboard (safe for all contexts)
        const success = await safeClipboardWrite(chapterText);
        if (success) {
          toast.success("Story copied to clipboard!");
        } else {
          toast.error("Failed to copy story to clipboard");
        }
      }
    } catch (error: any) {
      console.error("Share error:", error);
      
      // Check if user cancelled (case-insensitive)
      const errorMsg = error?.message?.toLowerCase() || error?.toString?.()?.toLowerCase() || '';
      const isCancelled = errorMsg.includes('cancel') || 
                         errorMsg.includes('abort') || 
                         errorMsg.includes('dismissed') ||
                         error?.name === 'AbortError';
      
      if (!isCancelled) {
        // Try fallback to clipboard as last resort (reuse already created chapterText)
        const chapterText = `${story.chapter_title}\n\n${story.intro_line}\n\n${story.main_story}`;
        const success = await safeClipboardWrite(chapterText);
        
        if (success) {
          toast.info("Couldn't share, but story was copied to clipboard!");
        } else {
          toast.error(getClipboardErrorMessage(error));
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">{showGallery && (
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
        <h1 className="text-3xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Story Journal
        </h1>
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
                    ? '/placeholder-egg.png' 
                    : '/placeholder-companion.png';
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

        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewingStage(Math.max(0, viewingStage - 1))}
            disabled={viewingStage === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {debouncedStage === 0 ? "Prologue" : `Chapter ${debouncedStage}`}
            </p>
            <p className="font-semibold">{getStageName(debouncedStage)}</p>
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
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
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

        {/* Story Display */}
        {isStageUnlocked && story ? (
          <div className="space-y-6">
            {/* Chapter Title & Share */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 text-center space-y-2">
                  <h2 className="text-2xl font-bold">
                    {debouncedStage === 0 ? "Prologue" : `Chapter ${debouncedStage}`}: {story.chapter_title}
                  </h2>
                  <p className="text-lg text-muted-foreground italic">"{story.intro_line}"</p>
                </div>
                {canShare && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    disabled={!story || isSharing}
                    className="flex-shrink-0"
                  >
                    <Share2 className={`w-4 h-4 mr-2 ${isSharing ? 'animate-pulse' : ''}`} />
                    {isSharing ? "Sharing..." : "Share"}
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Main Story */}
            <div>
              <h3 className="text-sm font-semibold mb-3">The Story</h3>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">{story.main_story}</p>
            </div>

            {/* Bond Moment */}
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <h3 className="text-sm font-semibold mb-2 text-primary">Bond Moment</h3>
              <p className="text-sm text-foreground/90">{story.bond_moment}</p>
            </div>

            {/* Life Lesson */}
            <div className="bg-accent/5 p-4 rounded-lg border border-accent/20">
              <h3 className="text-sm font-semibold mb-2 text-accent">Life Lesson</h3>
              <p className="text-sm text-foreground/90">{story.life_lesson}</p>
            </div>

            {/* Lore Expansion */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Lore & Legends</h3>
              <ul className="space-y-2">
                {(Array.isArray(story.lore_expansion) ? story.lore_expansion : []).map((lore, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{lore}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Hook */}
            <div className="text-center p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg">
              <p className="text-sm font-medium text-foreground/80 italic">
                {story.next_hook}
              </p>
            </div>
          </div>
        ) : isStageUnlocked ? (
          <Card className="p-8 text-center space-y-4">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold mb-2">Chapter Not Yet Written</h3>
              <p className="text-muted-foreground mb-6">
                {debouncedStage === 0 
                  ? "The beginning of your companion's story awaits..."
                  : `Generate this chapter of your companion's story to continue the journey.`
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
                    Generate {debouncedStage === 0 ? "Prologue" : `Chapter ${debouncedStage}`}
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
