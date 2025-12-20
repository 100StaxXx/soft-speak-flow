import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download, Share, ImageIcon, Zap, Link as LinkIcon } from "lucide-react";
import { downloadImage } from "@/utils/imageDownload";
import { Capacitor } from '@capacitor/core';
import { Progress } from "@/components/ui/progress";

// Complete creature list from edge function, organized by category
const CREATURE_OPTIONS = {
  "Canines": ["Wolf", "Fox", "Arctic Fox", "Fennec Fox", "Dog", "Hyena", "Tanuki"],
  "Mythical Canines": ["Fenrir", "Cerberus"],
  "Felines": ["Cat", "Lion", "Tiger", "Panther", "Snow Leopard", "Cheetah", "Jaguar", "Lynx", "Puma / Cougar"],
  "Mythical Felines": ["Sphinx", "Kitsune"],
  "Dragons & Reptiles": ["Dragon", "Wyvern", "Hydra", "Basilisk", "T-Rex", "Velociraptor", "Crocodile", "Snake", "Sea Turtle"],
  "Birds": ["Eagle", "Falcon", "Hawk", "Owl", "Raven", "Parrot", "Hummingbird", "Penguin"],
  "Mythical Birds": ["Phoenix", "Thunderbird"],
  "Equines": ["Horse (Stallion)", "Unicorn", "Pegasus"],
  "Aquatic": ["Dolphin", "Shark", "Orca", "Blue Whale", "Jellyfish", "Octopus", "Manta Ray"],
  "Mythical Aquatic": ["Kraken", "Leviathan"],
  "Other Mammals": ["Bear", "Elephant", "Gorilla", "Rhino", "Hippo", "Mammoth", "Kangaroo", "Koala", "Red Panda", "Panda", "Sloth", "Rabbit", "Mouse", "Chinchilla", "Raccoon", "Bat", "Deer"],
};

const ELEMENTS = ["fire", "water", "earth", "air", "lightning", "ice", "light", "shadow"];
const STORY_TONES = ["", "heroic", "ethereal", "mystical", "ancient", "celestial"];

const STAGE_NAMES = [
  "Egg", "Hatchling", "Sproutling", "Cub", "Juvenile",
  "Apprentice", "Scout", "Fledgling", "Warrior", "Guardian",
  "Champion", "Ascended", "Vanguard", "Titan", "Mythic",
  "Prime", "Regal", "Eternal", "Transcendent", "Apex", "Ultimate Form"
];

interface GeneratedImage {
  stage: number;
  imageUrl: string;
  prompt?: string;
  generationMode: "text-to-image" | "image-to-image";
}

export const AdminCompanionImageTester = () => {
  const [testData, setTestData] = useState({
    spiritAnimal: "Wolf",
    element: "fire",
    stage: 0,
    favoriteColor: "#FF6B35",
    eyeColor: "#FFD700",
    furColor: "#8B4513",
    storyTone: "",
  });
  
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingChain, setGeneratingChain] = useState(false);
  const [chainProgress, setChainProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Store all generated images in chain
  const [generatedChain, setGeneratedChain] = useState<Record<number, GeneratedImage>>({});
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [selectedPreviewStage, setSelectedPreviewStage] = useState<number | null>(null);

  const getGenerationMode = (stage: number, hasPreviousImage: boolean): "text-to-image" | "image-to-image" => {
    // Text-to-image for stages 0, 1, and cosmic stages 15-20
    if (stage <= 1 || stage >= 15) return "text-to-image";
    // Image-to-image for stages 2-14 when previous image exists
    return hasPreviousImage ? "image-to-image" : "text-to-image";
  };

  const estimateGenerationTime = (stagesCount: number) => {
    // Roughly 8-12 seconds per image
    const avgSecondsPerImage = 10;
    const totalSeconds = stagesCount * avgSecondsPerImage;
    if (totalSeconds < 60) return `~${totalSeconds} seconds`;
    return `~${Math.ceil(totalSeconds / 60)} minutes`;
  };

  const handleGenerateSingleImage = async () => {
    setGeneratingImage(true);
    setCurrentPrompt(null);

    try {
      const previousStageImage = generatedChain[testData.stage - 1]?.imageUrl;
      const generationMode = getGenerationMode(testData.stage, !!previousStageImage);

      const { data, error } = await supabase.functions.invoke("generate-companion-image", {
        body: {
          spiritAnimal: testData.spiritAnimal,
          element: testData.element,
          stage: testData.stage,
          favoriteColor: testData.favoriteColor,
          eyeColor: testData.eyeColor || undefined,
          furColor: testData.furColor || undefined,
          storyTone: testData.storyTone || undefined,
          previousStageImageUrl: previousStageImage,
        },
      });

      if (error) throw error;

      const newImage: GeneratedImage = {
        stage: testData.stage,
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        generationMode,
      };

      setGeneratedChain(prev => ({ ...prev, [testData.stage]: newImage }));
      setCurrentPrompt(data.prompt || "Prompt not returned");
      setSelectedPreviewStage(testData.stage);
      toast.success(`Stage ${testData.stage} image generated (${generationMode})`);
    } catch (error: any) {
      console.error("Error generating companion image:", error);
      toast.error(error.message || "Failed to generate companion image");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateEvolutionChain = async () => {
    setGeneratingChain(true);
    setChainProgress({ current: 0, total: testData.stage + 1 });
    setGeneratedChain({});

    try {
      let previousImageUrl: string | undefined = undefined;

      for (let stage = 0; stage <= testData.stage; stage++) {
        setChainProgress({ current: stage, total: testData.stage + 1 });
        
        const generationMode = getGenerationMode(stage, !!previousImageUrl);

        const { data, error } = await supabase.functions.invoke("generate-companion-image", {
          body: {
            spiritAnimal: testData.spiritAnimal,
            element: testData.element,
            stage: stage,
            favoriteColor: testData.favoriteColor,
            eyeColor: testData.eyeColor || undefined,
            furColor: testData.furColor || undefined,
            storyTone: testData.storyTone || undefined,
            previousStageImageUrl: previousImageUrl,
          },
        });

        if (error) throw error;

        const newImage: GeneratedImage = {
          stage,
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          generationMode,
        };

        setGeneratedChain(prev => ({ ...prev, [stage]: newImage }));
        previousImageUrl = data.imageUrl;

        toast.success(`Stage ${stage} (${STAGE_NAMES[stage]}) complete`);
      }

      setChainProgress({ current: testData.stage + 1, total: testData.stage + 1 });
      setSelectedPreviewStage(testData.stage);
      toast.success(`Evolution chain complete! Generated ${testData.stage + 1} images.`);
    } catch (error: any) {
      console.error("Error generating evolution chain:", error);
      toast.error(error.message || "Failed to generate evolution chain");
    } finally {
      setGeneratingChain(false);
      setChainProgress(null);
    }
  };

  const hasPreviousStageImage = testData.stage > 0 && !!generatedChain[testData.stage - 1];
  const currentMode = getGenerationMode(testData.stage, hasPreviousStageImage);
  const selectedImage = selectedPreviewStage !== null ? generatedChain[selectedPreviewStage] : null;
  const chainCount = Object.keys(generatedChain).length;

  return (
    <Card className="p-6 mb-8 rounded-3xl shadow-soft">
      <h2 className="font-heading text-2xl font-semibold mb-4">🎨 Companion Image Tester</h2>
      <p className="text-muted-foreground mb-6">
        Test companion image generation with I2I support for evolution chains
      </p>
      
      <div className="space-y-4">
        {/* Spirit Animal & Element */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="spiritAnimal">Spirit Animal ({Object.values(CREATURE_OPTIONS).flat().length} creatures)</Label>
            <select
              id="spiritAnimal"
              value={testData.spiritAnimal}
              onChange={(e) => setTestData({ ...testData, spiritAnimal: e.target.value })}
              className="w-full p-3 min-h-[44px] border rounded-2xl bg-background text-base"
            >
              {Object.entries(CREATURE_OPTIONS).map(([category, creatures]) => (
                <optgroup key={category} label={category}>
                  {creatures.map(creature => (
                    <option key={creature} value={creature}>{creature}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="element">Element</Label>
            <select
              id="element"
              value={testData.element}
              onChange={(e) => setTestData({ ...testData, element: e.target.value })}
              className="w-full p-3 min-h-[44px] border rounded-2xl bg-background text-base"
            >
              {ELEMENTS.map(el => (
                <option key={el} value={el}>{el.charAt(0).toUpperCase() + el.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Story Tone */}
        <div>
          <Label htmlFor="storyTone">Story Tone (Optional)</Label>
          <select
            id="storyTone"
            value={testData.storyTone}
            onChange={(e) => setTestData({ ...testData, storyTone: e.target.value })}
            className="w-full p-3 min-h-[44px] border rounded-2xl bg-background text-base"
          >
            <option value="">None (default)</option>
            {STORY_TONES.filter(Boolean).map(tone => (
              <option key={tone} value={tone}>{tone.charAt(0).toUpperCase() + tone.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Stage Slider */}
        <div>
          <Label htmlFor="stage">
            Evolution Stage: {testData.stage} - {STAGE_NAMES[testData.stage]}
          </Label>
          <input
            type="range"
            id="stage"
            min="0"
            max="20"
            value={testData.stage}
            onChange={(e) => setTestData({ ...testData, stage: parseInt(e.target.value) })}
            className="w-full h-10 cursor-pointer"
          />
          
          {/* Generation Mode Indicator */}
          <div className="flex items-center gap-2 mt-2">
            {currentMode === "image-to-image" ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-600 text-xs font-medium">
                <LinkIcon className="w-3 h-3" />
                Image-to-Image (stage {testData.stage - 1} → {testData.stage})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-600 text-xs font-medium">
                <ImageIcon className="w-3 h-3" />
                Text-to-Image
              </span>
            )}
            {testData.stage >= 2 && testData.stage <= 14 && !hasPreviousStageImage && (
              <span className="text-xs text-amber-600">
                ⚠️ No previous stage image - will use T2I instead of I2I
              </span>
            )}
          </div>
        </div>

        {/* Color Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="favoriteColor">Favorite Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                id="favoriteColor"
                value={testData.favoriteColor}
                onChange={(e) => setTestData({ ...testData, favoriteColor: e.target.value })}
                className="w-16 h-12 rounded-2xl cursor-pointer"
              />
              <Input
                type="text"
                value={testData.favoriteColor}
                onChange={(e) => setTestData({ ...testData, favoriteColor: e.target.value })}
                className="flex-1 rounded-2xl min-h-[44px] text-base"
                placeholder="#FF6B35"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="eyeColor">Eye Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                id="eyeColor"
                value={testData.eyeColor}
                onChange={(e) => setTestData({ ...testData, eyeColor: e.target.value })}
                className="w-16 h-12 rounded-2xl cursor-pointer"
              />
              <Input
                type="text"
                value={testData.eyeColor}
                onChange={(e) => setTestData({ ...testData, eyeColor: e.target.value })}
                className="flex-1 rounded-2xl min-h-[44px] text-base"
                placeholder="#FFD700"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="furColor">Fur/Scale Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                id="furColor"
                value={testData.furColor}
                onChange={(e) => setTestData({ ...testData, furColor: e.target.value })}
                className="w-16 h-12 rounded-2xl cursor-pointer"
              />
              <Input
                type="text"
                value={testData.furColor}
                onChange={(e) => setTestData({ ...testData, furColor: e.target.value })}
                className="flex-1 rounded-2xl min-h-[44px] text-base"
                placeholder="#8B4513"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={handleGenerateSingleImage}
            disabled={generatingImage || generatingChain}
            variant="outline"
            className="w-full rounded-2xl min-h-[48px] text-base"
          >
            {generatingImage ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Stage {testData.stage}...
              </>
            ) : (
              <>
                <ImageIcon className="h-5 w-5 mr-2" />
                Generate Single Stage
              </>
            )}
          </Button>

          <Button
            onClick={handleGenerateEvolutionChain}
            disabled={generatingImage || generatingChain}
            className="w-full rounded-2xl min-h-[48px] text-base"
          >
            {generatingChain ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Chain...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                Generate Full Evolution (0→{testData.stage})
              </>
            )}
          </Button>
        </div>

        {/* Chain generation info */}
        {!generatingChain && testData.stage > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Full evolution will generate {testData.stage + 1} images ({estimateGenerationTime(testData.stage + 1)})
          </p>
        )}

        {/* Progress Bar */}
        {chainProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Generating stage {chainProgress.current} of {chainProgress.total - 1}</span>
              <span>{Math.round((chainProgress.current / chainProgress.total) * 100)}%</span>
            </div>
            <Progress value={(chainProgress.current / chainProgress.total) * 100} />
            <p className="text-xs text-muted-foreground text-center">
              {chainProgress.current > 0 && STAGE_NAMES[chainProgress.current - 1]} → {STAGE_NAMES[chainProgress.current]}
            </p>
          </div>
        )}

        {/* Evolution Chain Gallery */}
        {chainCount > 0 && (
          <div className="space-y-3">
            <Label>Evolution Chain Gallery ({chainCount} images)</Label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from({ length: 21 }, (_, i) => i).map(stage => {
                const image = generatedChain[stage];
                if (!image) return null;
                
                return (
                  <button
                    key={stage}
                    onClick={() => {
                      setSelectedPreviewStage(stage);
                      setCurrentPrompt(image.prompt || null);
                    }}
                    className={`flex-shrink-0 relative rounded-xl overflow-hidden border-2 transition-all ${
                      selectedPreviewStage === stage 
                        ? "border-primary ring-2 ring-primary/30" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={image.imageUrl}
                      alt={`Stage ${stage}`}
                      className="w-20 h-20 object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                      {stage}
                    </div>
                    <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                      image.generationMode === "image-to-image" ? "bg-green-500" : "bg-blue-500"
                    }`} />
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" /> T2I
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 ml-3 mr-1" /> I2I
            </p>
          </div>
        )}

        {/* Selected Image Preview */}
        {selectedImage && (
          <div className="space-y-4 p-4 md:p-6 border rounded-2xl bg-card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">
                  Stage {selectedImage.stage} - {STAGE_NAMES[selectedImage.stage]}
                </h3>
                <span className={`text-xs ${
                  selectedImage.generationMode === "image-to-image" ? "text-green-600" : "text-blue-600"
                }`}>
                  {selectedImage.generationMode === "image-to-image" ? "Image-to-Image" : "Text-to-Image"}
                </span>
              </div>
              <Button
                onClick={() => downloadImage(
                  selectedImage.imageUrl,
                  `companion-${testData.spiritAnimal}-stage${selectedImage.stage}.png`
                )}
                variant="outline"
                size="sm"
                className="rounded-full"
              >
                {Capacitor.isNativePlatform() ? (
                  <><Share className="h-4 w-4 mr-1" /> Share</>
                ) : (
                  <><Download className="h-4 w-4 mr-1" /> Download</>
                )}
              </Button>
            </div>
            
            <div className="flex justify-center">
              <img
                src={selectedImage.imageUrl}
                alt={`Stage ${selectedImage.stage} - ${STAGE_NAMES[selectedImage.stage]}`}
                className="max-w-md w-full rounded-2xl shadow-lg"
              />
            </div>
            
            {currentPrompt && (
              <div className="space-y-2">
                <Label>Generated Prompt:</Label>
                <Textarea
                  value={currentPrompt}
                  readOnly
                  className="font-mono text-xs rounded-2xl min-h-[100px]"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
