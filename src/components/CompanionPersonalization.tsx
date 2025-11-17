import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const COLORS = [
  { name: "Royal Purple", value: "#9333EA", gradient: "from-purple-600 to-violet-600" },
  { name: "Ocean Blue", value: "#0EA5E9", gradient: "from-blue-500 to-cyan-500" },
  { name: "Forest Green", value: "#10B981", gradient: "from-emerald-500 to-green-600" },
  { name: "Sunset Orange", value: "#F97316", gradient: "from-orange-500 to-red-500" },
  { name: "Rose Pink", value: "#EC4899", gradient: "from-pink-500 to-rose-500" },
  { name: "Golden Yellow", value: "#EAB308", gradient: "from-yellow-500 to-amber-500" },
  { name: "Crimson Red", value: "#DC2626", gradient: "from-red-600 to-rose-600" },
  { name: "Silver Gray", value: "#64748B", gradient: "from-slate-500 to-gray-600" },
];

const ANIMALS = [
  { name: "Dragon", emoji: "🐉" },
  { name: "Phoenix", emoji: "🔥" },
  { name: "Wolf", emoji: "🐺" },
  { name: "Tiger", emoji: "🐯" },
  { name: "Eagle", emoji: "🦅" },
  { name: "Serpent", emoji: "🐍" },
  { name: "Bear", emoji: "🐻" },
  { name: "Fox", emoji: "🦊" },
  { name: "Lion", emoji: "🦁" },
  { name: "Owl", emoji: "🦉" },
  { name: "Raven", emoji: "🐦‍⬛" },
  { name: "Deer", emoji: "🦌" },
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
  const [selectedColor, setSelectedColor] = useState<string>("");
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

        {/* Color Selection */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Favorite color</Label>
          <div className="grid grid-cols-4 gap-3">
            {COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.name)}
                className={`
                  relative h-20 rounded-lg transition-all duration-200
                  bg-gradient-to-br ${color.gradient}
                  ${selectedColor === color.name 
                    ? "ring-4 ring-primary scale-105 shadow-lg" 
                    : "hover:scale-105 hover:shadow-md opacity-70 hover:opacity-100"
                  }
                `}
              >
                {selectedColor === color.name && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white rounded-full p-1">
                      <div className="text-2xl">✓</div>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-1 left-0 right-0 text-center">
                  <span className="text-xs font-semibold text-white drop-shadow-lg">
                    {color.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Animal Selection */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Favorite animal or mythic creature</Label>
          <div className="grid grid-cols-4 gap-3">
            {ANIMALS.map((animal) => (
              <button
                key={animal.name}
                onClick={() => setSelectedAnimal(animal.name)}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-200
                  ${selectedAnimal === animal.name
                    ? "border-primary bg-primary/10 scale-105 shadow-lg"
                    : "border-border hover:border-primary/50 hover:scale-105"
                  }
                `}
              >
                <div className="text-4xl mb-2">{animal.emoji}</div>
                <div className="text-sm font-medium">{animal.name}</div>
              </button>
            ))}
          </div>
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
                  p-4 rounded-lg border-2 transition-all duration-200
                  ${selectedElement === element.name
                    ? "border-primary bg-primary/10 scale-105 shadow-lg"
                    : "border-border hover:border-primary/50 hover:scale-105"
                  }
                `}
              >
                <div className={`text-4xl mb-2 ${element.color}`}>{element.emoji}</div>
                <div className="text-sm font-medium">{element.name}</div>
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