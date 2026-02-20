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
  "Mythical Canines": ["Fenrir"],
  "Felines": ["Cat", "Lion", "Tiger", "Panther", "Snow Leopard", "Cheetah", "Jaguar", "Lynx", "Puma / Cougar"],
  "Mythical Felines": ["Sphinx", "Kitsune"],
  "Dragons & Reptiles": ["Dragon", "Wyvern", "Hydra", "Basilisk", "T-Rex", "Velociraptor", "Crocodile", "Snake", "Sea Turtle"],
  "Birds": ["Eagle", "Falcon", "Hawk", "Owl", "Raven", "Parrot", "Hummingbird", "Penguin"],
  "Mythical Birds": ["Phoenix", "Thunderbird"],
  "Equines": ["Horse (Stallion)", "Unicorn", "Pegasus"],
  "Aquatic": ["Dolphin", "Shark", "Orca", "Blue Whale", "Jellyfish", "Octopus", "Manta Ray"],
  "Mythical Aquatic": ["Kraken", "Leviathan"],
  "Other Mammals": ["Bear", "Deer", "Elephant", "Gorilla", "Rhino", "Hippo", "Mammoth", "Kangaroo", "Koala", "Red Panda", "Panda", "Sloth", "Rabbit", "Mouse", "Chinchilla", "Raccoon", "Bat"],
};

const ELEMENTS = ["Fire", "Water", "Earth", "Air", "Lightning", "Ice", "Nature", "Light", "Shadow", "Cosmic"];
const STORY_TONES = ["", "whimsical", "epic", "cozy", "mysterious", "triumphant", "melancholic", "playful"];

const STAGE_NAMES = [
  "Egg", "Hatchling", "Sproutling", "Cub", "Juvenile",
  "Apprentice", "Scout", "Fledgling", "Warrior", "Guardian",
  "Champion", "Ascended", "Vanguard", "Titan", "Mythic",
  "Prime", "Regal", "Eternal", "Transcendent", "Apex", "Ultimate Form"
];

interface QualityScore {
  overall: number;
  limbCount: number;
  speciesFidelity: number;
  colorMatch: number;
  issues: string[];
  shouldRetry: boolean;
}

interface ExtractedMetadata {
  hexPrimaryColor: string;
  hexEyeColor: string;
  hexAccentColor?: string;
  primaryColorDesc: string;
  eyeColorDesc: string;
  markings: string;
  viewingAngle: string;
  pose: string;
  expression: string;
  artStyle: string;
  distinctiveFeatures: string;
  lightingDirection?: string;
}

interface GeneratedImage {
  stage: number;
  imageUrl: string;
  prompt?: string;
  generationMode: string;
  qualityScore?: QualityScore;
  extractedMetadata?: ExtractedMetadata;
}

export const AdminCompanionImageTester = () => {
  const [testData, setTestData] = useState({
    spiritAnimal: "Wolf",
    element: "Fire",
    stage: 0,
    favoriteColor: "#FF6B35",
    eyeColor: "#FFD700",
    furColor: "#8B4513",
    storyTone: "",
    retryAttempt: 0,
  });
  
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingChain, setGeneratingChain] = useState(false);
  const [chainProgress, setChainProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Store all generated images in chain
  const [generatedChain, setGeneratedChain] = useState<Record<number, GeneratedImage>>({});
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [selectedPreviewStage, setSelectedPreviewStage] = useState<number | null>(null);

  // All stages now use T2I, but stages 2-14 extract metadata from previous image
  const getGenerationMode = (stage: number, hasPreviousImage: boolean): string => {
    // Text-to-image for stages 0, 1, and cosmic stages 15-20
    if (stage <= 1) return "Text-to-Image (Egg Stage)";
    if (stage >= 15) return "Text-to-Image (Cosmic Stage)";
    // Stages 2-14 use T2I but extract visual metadata from previous image for consistency
    return hasPreviousImage ? "Text-to-Image (with Visual Metadata)" : "Text-to-Image (No Reference)";
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
            retryAttempt: testData.retryAttempt || undefined,
            flowType: "admin",
            debug: true,
          },
        });

      if (error) throw error;

      const newImage: GeneratedImage = {
        stage: testData.stage,
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        generationMode,
        qualityScore: data.qualityScore,
        extractedMetadata: data.extractedMetadata,
      };

      setGeneratedChain(prev => ({ ...prev, [testData.stage]: newImage }));
      setCurrentPrompt(data.prompt || "Prompt not returned");
      setSelectedPreviewStage(testData.stage);
      
      // Show quality score in toast
      if (data.qualityScore) {
        const qs = data.qualityScore;
        if (qs.shouldRetry) {
          toast.warning(`Stage ${testData.stage} generated with issues (Score: ${qs.overall}/100)`, {
            description: qs.issues?.slice(0, 2).join(", ") || "Quality below threshold"
          });
        } else {
          toast.success(`Stage ${testData.stage} generated (Score: ${qs.overall}/100)`);
        }
      } else {
        toast.success(`Stage ${testData.stage} image generated (${generationMode})`);
      }
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
            flowType: "admin",
            debug: true,
          },
        });

        if (error) throw error;

        const newImage: GeneratedImage = {
          stage,
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          generationMode,
          qualityScore: data.qualityScore,
          extractedMetadata: data.extractedMetadata,
        };

        setGeneratedChain(prev => ({ ...prev, [stage]: newImage }));
        previousImageUrl = data.imageUrl;

        // Show quality in toast
        if (data.qualityScore) {
          const qs = data.qualityScore;
          toast.success(`Stage ${stage} (${STAGE_NAMES[stage]}) - Score: ${qs.overall}/100`);
        } else {
          toast.success(`Stage ${stage} (${STAGE_NAMES[stage]}) complete`);
        }
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
        Test companion image generation with visual metadata extraction for consistent evolution chains
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
                <option key={el} value={el}>{el}</option>
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
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {currentMode.includes("Visual Metadata") ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-600 text-xs font-medium">
                <LinkIcon className="w-3 h-3" />
                T2I + Visual Metadata (stage {testData.stage - 1} → {testData.stage})
              </span>
            ) : currentMode.includes("Egg") ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-600 text-xs font-medium">
                <ImageIcon className="w-3 h-3" />
                Text-to-Image (Egg)
              </span>
            ) : currentMode.includes("Cosmic") ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-600 text-xs font-medium">
                <ImageIcon className="w-3 h-3" />
                Text-to-Image (Cosmic)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-600 text-xs font-medium">
                <ImageIcon className="w-3 h-3" />
                Text-to-Image
              </span>
            )}
            {testData.stage >= 2 && testData.stage <= 14 && !hasPreviousStageImage && (
              <span className="text-xs text-amber-600">
                ⚠️ No previous stage - generate chain or prior stage first
              </span>
            )}
          </div>

          {/* Color Palette Preview for Visual Metadata Mode */}
          {hasPreviousStageImage && testData.stage >= 2 && testData.stage <= 14 && (
            <div className="mt-3 p-3 rounded-xl bg-muted/50 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Colors that will be extracted & matched:</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-5 h-5 rounded-full border border-border" 
                    style={{ backgroundColor: testData.favoriteColor }}
                  />
                  <span className="text-xs text-muted-foreground">Primary</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-5 h-5 rounded-full border border-border" 
                    style={{ backgroundColor: testData.eyeColor }}
                  />
                  <span className="text-xs text-muted-foreground">Eyes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-5 h-5 rounded-full border border-border" 
                    style={{ backgroundColor: testData.furColor }}
                  />
                  <span className="text-xs text-muted-foreground">Fur</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                ✨ Metadata (hex colors, pose, angle, style) will be extracted from stage {testData.stage - 1}
              </p>
            </div>
          )}
        </div>

        {/* Retry Attempt */}
        <div>
          <Label htmlFor="retryAttempt">Retry Attempt (0-3, affects enforcement text)</Label>
          <Input
            type="number"
            id="retryAttempt"
            min="0"
            max="3"
            value={testData.retryAttempt}
            onChange={(e) => setTestData({ ...testData, retryAttempt: parseInt(e.target.value) || 0 })}
            className="w-full rounded-2xl min-h-[44px] text-base"
          />
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
                      {image.qualityScore && (
                        <span className={`ml-1 ${image.qualityScore.overall >= 70 ? 'text-green-400' : 'text-amber-400'}`}>
                          ({image.qualityScore.overall})
                        </span>
                      )}
                    </div>
                    <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                      image.generationMode.includes("Visual Metadata") ? "bg-purple-500" : 
                      image.generationMode.includes("Egg") ? "bg-amber-500" :
                      image.generationMode.includes("Cosmic") ? "bg-indigo-500" : "bg-blue-500"
                    }`} />
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" /> T2I
              <span className="inline-block w-2 h-2 rounded-full bg-purple-500 ml-3 mr-1" /> T2I + Metadata
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-3 mr-1" /> Egg
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 ml-3 mr-1" /> Cosmic
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
                  selectedImage.generationMode.includes("Visual Metadata") ? "text-purple-600" : 
                  selectedImage.generationMode.includes("Egg") ? "text-amber-600" :
                  selectedImage.generationMode.includes("Cosmic") ? "text-indigo-600" : "text-blue-600"
                }`}>
                  {selectedImage.generationMode}
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

            {/* Quality Score Panel */}
            {selectedImage.qualityScore && (
              <div className="p-4 rounded-xl bg-muted/50 border">
                <Label className="mb-3 block">Quality Analysis</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-2 rounded-lg bg-background">
                    <div className={`text-2xl font-bold ${
                      selectedImage.qualityScore.overall >= 70 ? 'text-green-600' : 
                      selectedImage.qualityScore.overall >= 50 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {selectedImage.qualityScore.overall}
                    </div>
                    <div className="text-xs text-muted-foreground">Overall</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background">
                    <div className={`text-2xl font-bold ${selectedImage.qualityScore.limbCount >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                      {selectedImage.qualityScore.limbCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Limbs</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background">
                    <div className={`text-2xl font-bold ${selectedImage.qualityScore.speciesFidelity >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                      {selectedImage.qualityScore.speciesFidelity}
                    </div>
                    <div className="text-xs text-muted-foreground">Species</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background">
                    <div className={`text-2xl font-bold ${selectedImage.qualityScore.colorMatch >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                      {selectedImage.qualityScore.colorMatch}
                    </div>
                    <div className="text-xs text-muted-foreground">Colors</div>
                  </div>
                </div>
                {selectedImage.qualityScore.issues && selectedImage.qualityScore.issues.length > 0 && (
                  <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs font-medium text-red-600 mb-1">Issues Detected:</p>
                    <ul className="text-xs text-red-600/80 list-disc list-inside">
                      {selectedImage.qualityScore.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Metadata Panel */}
            {selectedImage.extractedMetadata && (
              <div className="p-4 rounded-xl bg-muted/50 border">
                <Label className="mb-3 block">Extracted Visual Metadata</Label>
                <div className="space-y-3">
                  {/* Color Palette */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20">Colors:</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border border-border shadow-sm" 
                        style={{ backgroundColor: selectedImage.extractedMetadata.hexPrimaryColor }}
                        title={`Primary: ${selectedImage.extractedMetadata.hexPrimaryColor}`}
                      />
                      <div 
                        className="w-6 h-6 rounded-full border border-border shadow-sm" 
                        style={{ backgroundColor: selectedImage.extractedMetadata.hexEyeColor }}
                        title={`Eyes: ${selectedImage.extractedMetadata.hexEyeColor}`}
                      />
                      {selectedImage.extractedMetadata.hexAccentColor && (
                        <div 
                          className="w-6 h-6 rounded-full border border-border shadow-sm" 
                          style={{ backgroundColor: selectedImage.extractedMetadata.hexAccentColor }}
                          title={`Accent: ${selectedImage.extractedMetadata.hexAccentColor}`}
                        />
                      )}
                      <span className="text-xs text-muted-foreground ml-2">
                        {selectedImage.extractedMetadata.hexPrimaryColor} / {selectedImage.extractedMetadata.hexEyeColor}
                      </span>
                    </div>
                  </div>
                  {/* Pose & Composition */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded bg-background">
                      <span className="text-muted-foreground">Angle:</span>
                      <span className="ml-1 font-medium">{selectedImage.extractedMetadata.viewingAngle}</span>
                    </div>
                    <div className="p-2 rounded bg-background">
                      <span className="text-muted-foreground">Pose:</span>
                      <span className="ml-1 font-medium">{selectedImage.extractedMetadata.pose}</span>
                    </div>
                    <div className="p-2 rounded bg-background">
                      <span className="text-muted-foreground">Expression:</span>
                      <span className="ml-1 font-medium">{selectedImage.extractedMetadata.expression}</span>
                    </div>
                    <div className="p-2 rounded bg-background">
                      <span className="text-muted-foreground">Style:</span>
                      <span className="ml-1 font-medium truncate">{selectedImage.extractedMetadata.artStyle.slice(0, 20)}...</span>
                    </div>
                  </div>
                  {/* Markings */}
                  <div className="text-xs">
                    <span className="text-muted-foreground">Markings:</span>
                    <span className="ml-2">{selectedImage.extractedMetadata.markings}</span>
                  </div>
                </div>
              </div>
            )}
            
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
