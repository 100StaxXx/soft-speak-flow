import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { CompanionCreationLoader } from "./CompanionCreationLoader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const ANIMALS = [
  "Arctic Fox", "Basilisk", "Bear", "Blue Whale", "Buttercat",
  "Cat", "Cheetah", "Crocodile", "Dog",
  "Dolphin", "Dragon", "Eagle", "Elephant", "Falcon",
  "Fennec Fox", "Fenrir", "Fox", "Gorilla", "Gryphon",
  "Hawk", "Hippo", "Hippogriff", "Horse (Stallion)", "Hummingbird",
  "Hydra", "Hyena", "Jaguar", "Jellyfish", "Kangaroo",
  "Kitsune", "Kraken", "Leviathan", "Lion", "Lynx",
  "Mammoth", "Manta Ray", "Mechanical Dragon", "Octopus", "Orca",
  "Owl", "Panther", "Parrot", "Pegasus", "Penguin",
  "Phoenix", "Puma / Cougar", "Raven", "Reindeer", "Rhino",
  "Sea Turtle", "Shark", "Sloth", "Snake", "Snow Leopard",
  "Sphinx", "T-Rex", "Tanuki", "Thunderbird", "Tiger",
  "Unicorn", "Velociraptor", "Wolf", "Wolverine", "Wyvern",
];

const ELEMENTS = [
  { name: "Fire", emoji: "🔥", color: "text-orange-500" },
  { name: "Water", emoji: "💧", color: "text-blue-500" },
  { name: "Earth", emoji: "🪨", color: "text-green-600" },
  { name: "Air", emoji: "💨", color: "text-cyan-400" },
  { name: "Lightning", emoji: "⚡", color: "text-yellow-400" },
  { name: "Ice", emoji: "❄️", color: "text-blue-300" },
  { name: "Light", emoji: "✨", color: "text-yellow-200" },
  { name: "Shadow", emoji: "🌑", color: "text-purple-600" },
];

const STORY_TONES = [
  { value: "soft_gentle", label: "Soft & Gentle", emoji: "🌸" },
  { value: "epic_adventure", label: "Epic Adventure", emoji: "⚔️" },
  { value: "emotional_heartfelt", label: "Emotional & Heartfelt", emoji: "💖" },
  { value: "dark_intense", label: "Dark & Intense", emoji: "🌑" },
  { value: "whimsical_playful", label: "Whimsical & Playful", emoji: "✨" },
];

interface CompanionPersonalizationProps {
  onComplete: (data: {
    favoriteColor: string;
    spiritAnimal: string;
    coreElement: string;
    storyTone: string;
  }) => void;
  isLoading?: boolean;
}

export const CompanionPersonalization = ({ onComplete, isLoading }: CompanionPersonalizationProps) => {
  const [selectedColor, setSelectedColor] = useState<string>("#9333EA");
  const [selectedAnimal, setSelectedAnimal] = useState<string>("");
  const [selectedElement, setSelectedElement] = useState<string>("");
  const [selectedTone, setSelectedTone] = useState<string>("epic_adventure");

  const isComplete = selectedColor && selectedAnimal && selectedElement && selectedTone;

  // Show dedicated loading screen when creating companion
  if (isLoading) {
    return <CompanionCreationLoader />;
  }

  return (
    <div className="min-h-screen p-4 pt-safe-top safe-area-bottom flex items-center justify-center relative z-10">
      <div className="max-w-2xl w-full p-8 space-y-8 animate-scale-in cosmic-glass rounded-2xl border border-white/10">
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Create Your Companion
          </h1>
          <div className="space-y-2 max-w-md mx-auto">
            <p className="text-lg font-medium text-foreground">
              This companion grows as you do.
            </p>
            <p className="text-muted-foreground text-sm">
              Your habits, your challenges, your consistency — they all evolve it.
            </p>
          </div>
        </div>

        {/* Color Selection with Color Wheel */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold text-foreground">Favorite Color</Label>
          <div className="flex justify-center">
            <label className="cursor-pointer group">
              <div 
                className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-white/20 shadow-lg transition-all hover:scale-105 overflow-hidden"
                style={{ 
                  backgroundColor: selectedColor,
                  boxShadow: `0 0 30px ${selectedColor}50, 0 0 60px ${selectedColor}30`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-center mt-3 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Tap to change
              </p>
            </label>
          </div>
        </div>

        {/* Animal Selection with Dropdown */}
        <div className="space-y-3">
          <Label className="text-lg font-semibold text-foreground">Spirit Creature</Label>
          <Select value={selectedAnimal} onValueChange={setSelectedAnimal}>
            <SelectTrigger className="w-full h-14 text-base bg-white/5 border-white/20 hover:border-white/40">
              <SelectValue placeholder="Choose your spirit creature..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] bg-background/95 backdrop-blur-xl border-white/20">
              {ANIMALS.map((animal) => (
                <SelectItem 
                  key={animal} 
                  value={animal}
                  className="cursor-pointer"
                >
                  {animal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Element Selection */}
        <div className="space-y-3">
          <Label className="text-lg font-semibold text-foreground">Element</Label>
          <div className="grid grid-cols-4 gap-2 md:gap-3">
            {ELEMENTS.map((element) => (
              <button
                key={element.name}
                onClick={() => setSelectedElement(element.name)}
                className={`
                  p-2 md:p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center min-h-[80px] md:min-h-[100px]
                  ${selectedElement === element.name
                    ? "border-primary bg-primary/20 scale-105 shadow-lg shadow-primary/20"
                    : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                  }
                `}
              >
                <div className={`text-2xl md:text-3xl mb-1 ${element.color}`}>{element.emoji}</div>
                <div className="text-xs font-medium text-center leading-tight text-foreground/80">{element.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Story Tone Selection */}
        <div className="space-y-3">
          <Label className="text-lg font-semibold text-foreground">Story Tone</Label>
          <p className="text-sm text-muted-foreground">
            Choose how your companion's story unfolds
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            {STORY_TONES.map((tone) => (
              <button
                key={tone.value}
                onClick={() => setSelectedTone(tone.value)}
                className={`
                  p-3 md:p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3
                  ${selectedTone === tone.value
                    ? "border-primary bg-primary/20 scale-[1.02] shadow-lg shadow-primary/20"
                    : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                  }
                `}
              >
                <span className="text-xl md:text-2xl">{tone.emoji}</span>
                <span className="font-medium text-foreground/90">{tone.label}</span>
              </button>
            ))}
          </div>
        </div>

        {isComplete && !isLoading && (
          <div className="text-center space-y-3 animate-scale-in">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-sm font-medium text-foreground">
                This is your starting form.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Every time you show up for yourself, it will change.
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={() => onComplete({
            favoriteColor: selectedColor,
            spiritAnimal: selectedAnimal,
            coreElement: selectedElement,
            storyTone: selectedTone,
          })}
          disabled={!isComplete || isLoading}
          variant="cta"
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating your companion...
            </>
          ) : (
            "Begin Your Journey"
          )}
        </Button>
        
        {isLoading && (
          <div className="text-center space-y-2 animate-fade-in">
            <p className="text-sm text-muted-foreground">
              Please wait while we create your unique companion...
            </p>
            <p className="text-xs text-muted-foreground/70">
              This may take up to 30 seconds
            </p>
          </div>
        )}
      </div>
    </div>
  );
};