import { useState, useEffect } from "react";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionStory } from "@/hooks/useCompanionStory";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { BookOpen, Sparkles, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const STAGE_NAMES = [
  "Dormant Egg", "Cracking Awakening", "Newborn Emergence", "Early Infant",
  "Juvenile Form", "Young Explorer", "Adolescent Guardian", "Initiate Protector",
  "Seasoned Guardian", "Mature Protector", "Veteran Form", "Elevated Form",
  "Ascended Form", "Ether-Born Avatar", "Primordial Aspect", "Colossus Form",
  "Cosmic Guardian", "Astral Overlord", "Universal Sovereign", "Mythic Apex",
  "Origin of Creation"
];

const TONE_OPTIONS = [
  { value: "soft", label: "Soft & Gentle" },
  { value: "heroic", label: "Heroic & Epic" },
  { value: "epic", label: "Epic Adventure" },
  { value: "cinematic", label: "Cinematic" },
  { value: "dark", label: "Dark & Intense" },
  { value: "emotional", label: "Emotional" },
  { value: "mysterious", label: "Mysterious" },
];

const INTENSITY_OPTIONS = [
  { value: "soft", label: "Soft" },
  { value: "moderate", label: "Moderate" },
  { value: "epic", label: "Epic" },
];

export const CompanionStoryJournal = () => {
  const { companion } = useCompanion();
  // Always default to current companion stage
  const [viewingStage, setViewingStage] = useState(companion?.current_stage || 0);
  const [selectedTone, setSelectedTone] = useState("heroic");
  const [selectedIntensity, setSelectedIntensity] = useState("moderate");
  
  // Update viewing stage when companion stage changes
  useEffect(() => {
    if (companion?.current_stage !== undefined) {
      setViewingStage(companion.current_stage);
    }
  }, [companion?.current_stage]);
  
  const { story, allStories, isLoading, generateStory, regenerateStory } = useCompanionStory(
    companion?.id,
    viewingStage
  );

  if (!companion) {
    return (
      <Card className="border-muted/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Create your companion first to unlock the Story Journal
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleGenerate = () => {
    generateStory.mutate({
      companionId: companion.id,
      stage: viewingStage,
      tonePreference: selectedTone,
      themeIntensity: selectedIntensity,
    });
  };

  const handleRegenerate = () => {
    regenerateStory.mutate({
      companionId: companion.id,
      stage: viewingStage,
      tonePreference: selectedTone,
      themeIntensity: selectedIntensity,
    });
  };

  const canNavigateBack = viewingStage > 0;
  const canNavigateForward = viewingStage < companion.current_stage;
  const isCurrentStage = viewingStage === companion.current_stage;

  return (
    <div className="space-y-4" data-tour="story-tab">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Story Journal
              </CardTitle>
              <CardDescription className="mt-2">
                Your companion's epic journey through {STAGE_NAMES.length} legendary chapters
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {allStories?.length || 0} / {companion.current_stage + 1} unlocked
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewingStage(v => v - 1)}
              disabled={!canNavigateBack}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex flex-col items-center gap-1">
              <Badge variant={isCurrentStage ? "default" : "secondary"}>
                Stage {viewingStage}
              </Badge>
              <span className="text-sm font-medium">{STAGE_NAMES[viewingStage]}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewingStage(v => v + 1)}
              disabled={!canNavigateForward}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Story Display or Generate */}
      {story ? (
        <Card className="border-muted/50">
          <CardHeader>
            <div className="space-y-4">
              <div>
                <CardTitle className="text-2xl mb-2">{story.chapter_title}</CardTitle>
                <CardDescription className="text-base italic">
                  {story.intro_line}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={selectedTone} onValueChange={setSelectedTone}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map(tone => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedIntensity} onValueChange={setSelectedIntensity}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSITY_OPTIONS.map(intensity => (
                      <SelectItem key={intensity.value} value={intensity.value}>
                        {intensity.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerateStory.isPending}
                  className="ml-auto"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Rewrite
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Story */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-line leading-relaxed">{story.main_story}</p>
            </div>

            <Separator />

            {/* Bond Moment */}
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
              <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Bond Moment
              </h3>
              <p className="text-sm italic">{story.bond_moment}</p>
            </div>

            {/* Life Lesson */}
            <div className="bg-accent/10 rounded-lg p-4 border border-accent/20">
              <h3 className="text-sm font-semibold text-accent-foreground mb-2">Life Lesson</h3>
              <p className="text-sm">{story.life_lesson}</p>
            </div>

            {/* Lore Expansion */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Lore & Legends</h3>
              <ul className="space-y-2">
                {story.lore_expansion.map((lore, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{lore}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Hook */}
            {viewingStage < 20 && (
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border border-primary/20">
                <h3 className="text-sm font-semibold mb-2">To Be Continued...</h3>
                <p className="text-sm italic">{story.next_hook}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-muted-foreground flex items-center justify-between pt-4 border-t">
              <span>Chapter generated on {new Date(story.generated_at).toLocaleDateString()}</span>
              <Badge variant="outline" className="text-xs">
                {story.tone_preference}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <BookOpen className="h-16 w-16 text-muted-foreground" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Chapter Not Yet Written</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {viewingStage > companion.current_stage
                  ? `Evolve your companion to Stage ${viewingStage} to unlock this chapter`
                  : `Generate the legendary story of ${companion.spirit_animal}'s ${STAGE_NAMES[viewingStage]} stage`}
              </p>
            </div>
            {viewingStage <= companion.current_stage && (
              <div className="flex flex-col items-center gap-3 mt-2">
                <div className="flex gap-2">
                  <Select value={selectedTone} onValueChange={setSelectedTone}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Choose tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map(tone => (
                        <SelectItem key={tone.value} value={tone.value}>
                          {tone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedIntensity} onValueChange={setSelectedIntensity}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Intensity" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTENSITY_OPTIONS.map(intensity => (
                        <SelectItem key={intensity.value} value={intensity.value}>
                          {intensity.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGenerate} disabled={generateStory.isPending}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Chapter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
