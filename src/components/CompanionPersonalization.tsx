import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const ANIMALS = [
  "Dragon", "Unicorn", "Wolf", "Tiger", "Lion",
  "Phoenix", "Bear", "Shark", "Eagle", "Dolphin",
  "Fox", "Panther", "Orca", "Cat", "Dog",
  "Owl", "Pegasus", "Gorilla", "Cheetah", "Snake",
  "Gryphon", "Jaguar", "Snow Leopard", "Falcon", "Hawk",
  "Elephant", "Sea Turtle", "Octopus", "Kangaroo", "Penguin",
  "Sloth", "Parrot", "Raven", "Kitsune", "Kraken",
  "Hydra", "Basilisk", "Leviathan", "Hippo",
  "Rhino", "Horse (Stallion)", "Puma / Cougar", "Lynx", "Hyena",
  "Manta Ray", "Jellyfish", "Reindeer", "Mammoth", "Cerberus",
  "Sphinx", "Tanuki", "Fenrir", "Wyvern", "Hippogriff",
  "Blue Whale", "Butterfly", "Mechanical Dragon", "Thunderbird", "Crocodile",
  "Wolverine", "Arctic Fox", "Fennec Fox", "Hummingbird", "T-Rex",
  "Velociraptor",
];

const ELEMENTS = [
  { name: "Fire", emoji: "🔥", color: "text-orange-500" },
  { name: "Water", emoji: "💧", color: "text-blue-500" },
  { name: "Earth", emoji: "🌍", color: "text-green-600" },
  { name: "Air", emoji: "💨", color: "text-cyan-400" },
  { name: "Lightning", emoji: "⚡", color: "text-yellow-400" },
  { name: "Ice", emoji: "❄️", color: "text-blue-300" },
  { name: "Light", emoji: "✨", color: "text-yellow-200" },
  { name: "Shadow", emoji: "🌑", color: "text-purple-600" },
];

interface CompanionPersonalizationProps {
  onComplete: (data: {
    favoriteColor: string;
    spiritAnimal: string;
    coreElement: string;
  }) => void;
  isLoading?: boolean;
}

export const CompanionPersonalization = ({ onComplete, isLoading }: CompanionPersonalizationProps) => {
  const [selectedColor, setSelectedColor] = useState<string>("#9333EA");
  const [selectedAnimal, setSelectedAnimal] = useState<string>("");
  const [selectedElement, setSelectedElement] = useState<string>("");

  const isComplete = selectedColor && selectedAnimal && selectedElement;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 p-4 flex items-center justify-center">
      <Card className="max-w-2xl w-full p-8 space-y-8 shadow-glow animate-scale-in">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Let's create your companion.
          </h1>
          <div className="space-y-2 max-w-md mx-auto">
            <p className="text-lg font-medium text-foreground">
              This companion grows as you do.
            </p>
            <p className="text-muted-foreground">
              Your habits, your challenges, your consistency — they all evolve it.
            </p>
          </div>
        </div>

        {/* Color Selection with Color Wheel */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Favorite color</Label>
          <div className="flex justify-center">
            <label className="cursor-pointer group">
              <div className="relative w-32 h-32 rounded-full border-4 border-primary/20 shadow-glow transition-all hover:scale-105 overflow-hidden"
                style={{ backgroundColor: selectedColor }}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-center mt-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Click to change
              </p>
            </label>
          </div>
        </div>

        {/* Animal Selection with Dropdown */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Favorite animal or mythic creature</Label>
          <Select value={selectedAnimal} onValueChange={setSelectedAnimal}>
            <SelectTrigger className="w-full h-14 text-base">
              <SelectValue placeholder="Choose your spirit creature..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] bg-card border-border">
              {ANIMALS.map((animal) => (
                <SelectItem 
                  key={animal} 
                  value={animal}
                  className="cursor-pointer hover:bg-accent/50"
                >
                  {animal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Element Selection */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Element</Label>
          <div className="grid grid-cols-4 gap-3">
            {ELEMENTS.map((element) => (
              <button
                key={element.name}
                onClick={() => setSelectedElement(element.name)}
                className={`
                  p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center min-h-[100px]
                  ${selectedElement === element.name
                    ? "border-primary bg-primary/10 scale-105 shadow-lg"
                    : "border-border hover:border-primary/50 hover:scale-105"
                  }
                `}
              >
                <div className={`text-3xl mb-1 ${element.color}`}>{element.emoji}</div>
                <div className="text-xs font-medium text-center leading-tight">{element.name}</div>
              </button>
            ))}
          </div>
        </div>

        {isComplete && !isLoading && (
          <div className="text-center space-y-3 animate-scale-in">
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
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
      </Card>
    </div>
  );
};