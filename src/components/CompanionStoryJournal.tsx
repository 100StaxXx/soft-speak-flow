import { useState } from "react";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionStory } from "@/hooks/useCompanionStory";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles, Loader2, Lock } from "lucide-react";
import { Separator } from "./ui/separator";

const STAGE_NAMES = [
  "Egg",
  "Hatchling",
  "Guardian",
  "Ascended",
  "Mythic",
  "Titan",
  "Stage 6",
  "Stage 7",
  "Stage 8",
  "Stage 9",
  "Stage 10",
  "Stage 11",
  "Stage 12",
  "Stage 13",
  "Stage 14",
  "Stage 15",
  "Stage 16",
  "Stage 17",
  "Stage 18",
  "Stage 19",
  "Ultimate"
];

export const CompanionStoryJournal = () => {
  const { companion } = useCompanion();
  const [viewingStage, setViewingStage] = useState(0);
  
  const { story, allStories, isLoading, generateStory } = useCompanionStory(
    companion?.id,
    viewingStage
  );

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

  const handleGenerate = () => {
    if (!companion) return;
    generateStory.mutate({
      companionId: companion.id,
      stage: viewingStage,
    });
  };

  // Check if this stage can be accessed (must be at or below companion's current stage)
  const canAccessStage = (stage: number) => {
    return stage <= companion.current_stage;
  };

  const isStageUnlocked = canAccessStage(viewingStage);

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Story Journal
        </h1>
        <p className="text-muted-foreground">
          Your companion's epic journey - unlock new chapters as they evolve
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center items-center gap-2">
        <div className="text-sm text-muted-foreground">
          Unlocked: Prologue + {companion.current_stage} Chapters ({allStories?.length || 0} written)
        </div>
      </div>

      {/* Navigation */}
      <Card className="p-6">
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
              {viewingStage === 0 ? "Prologue" : `Chapter ${viewingStage}`}
            </p>
            <p className="font-semibold">{STAGE_NAMES[viewingStage]}</p>
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
              {viewingStage === 0 
                ? "Complete companion creation to unlock the Prologue"
                : `This chapter unlocks when your companion reaches Stage ${viewingStage}`
              }
            </p>
          </Card>
        )}

        {/* Story Display */}
        {isStageUnlocked && story ? (
          <div className="space-y-6">
            {/* Chapter Title */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">
                {viewingStage === 0 ? "Prologue" : `Chapter ${viewingStage}`}: {story.chapter_title}
              </h2>
              <p className="text-lg text-muted-foreground italic">"{story.intro_line}"</p>
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
                {viewingStage === 0 
                  ? "The beginning of your companion's story awaits..."
                  : `Generate this chapter of your companion's story to continue the journey.`
                }
              </p>
              
              <Button
                onClick={handleGenerate}
                disabled={generateStory.isPending}
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
                    Generate {viewingStage === 0 ? "Prologue" : `Chapter ${viewingStage}`}
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
