import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, Check } from "lucide-react";
import { type FactionType } from "./FactionSelector";

type AnimalType = "wolf" | "dragon" | "phoenix" | "tiger" | "owl" | "serpent" | "bear" | "fox" | "raven" | "dolphin";
type ElementType = "fire" | "water" | "earth" | "air" | "lightning" | "shadow" | "light" | "ice";

interface AnimalOption {
  id: AnimalType;
  name: string;
  emoji: string;
  trait: string;
}

interface ElementOption {
  id: ElementType;
  name: string;
  color: string;
  gradient: string;
}

const animals: AnimalOption[] = [
  { id: "wolf", name: "Wolf", emoji: "🐺", trait: "Loyal & fierce" },
  { id: "dragon", name: "Dragon", emoji: "🐉", trait: "Powerful & wise" },
  { id: "phoenix", name: "Phoenix", emoji: "🔥", trait: "Reborn & eternal" },
  { id: "tiger", name: "Tiger", emoji: "🐯", trait: "Bold & strong" },
  { id: "owl", name: "Owl", emoji: "🦉", trait: "Wise & observant" },
  { id: "serpent", name: "Serpent", emoji: "🐍", trait: "Cunning & agile" },
  { id: "bear", name: "Bear", emoji: "🐻", trait: "Protective & grounded" },
  { id: "fox", name: "Fox", emoji: "🦊", trait: "Clever & adaptable" },
  { id: "raven", name: "Raven", emoji: "🐦‍⬛", trait: "Mysterious & insightful" },
  { id: "dolphin", name: "Dolphin", emoji: "🐬", trait: "Joyful & intelligent" },
];

const elements: ElementOption[] = [
  { id: "fire", name: "Fire", color: "#FF6B35", gradient: "from-orange-500 to-red-600" },
  { id: "water", name: "Water", color: "#4ECDC4", gradient: "from-cyan-400 to-blue-600" },
  { id: "earth", name: "Earth", color: "#95D5B2", gradient: "from-green-400 to-emerald-600" },
  { id: "air", name: "Air", color: "#E0E0E0", gradient: "from-gray-200 to-gray-400" },
  { id: "lightning", name: "Lightning", color: "#FFE066", gradient: "from-yellow-300 to-amber-500" },
  { id: "shadow", name: "Shadow", color: "#7B68EE", gradient: "from-purple-500 to-indigo-700" },
  { id: "light", name: "Light", color: "#FFF8DC", gradient: "from-yellow-100 to-amber-200" },
  { id: "ice", name: "Ice", color: "#B0E0E6", gradient: "from-blue-200 to-cyan-400" },
];

// Faction-suggested elements
const factionSuggestedElements: Record<FactionType, ElementType[]> = {
  starfall: ["fire", "lightning", "light"],
  void: ["shadow", "ice", "water"],
  stellar: ["air", "light", "water"],
};

interface QuickCompanionCreatorProps {
  faction: FactionType;
  onComplete: (animal: AnimalType, element: ElementType, name: string) => void;
}

export const QuickCompanionCreator = ({ faction, onComplete }: QuickCompanionCreatorProps) => {
  const [step, setStep] = useState<"animal" | "element">("animal");
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(null);

  const suggestedElements = factionSuggestedElements[faction];

  const factionColors: Record<FactionType, string> = {
    starfall: "hsl(24, 100%, 50%)",
    void: "hsl(270, 70%, 50%)",
    stellar: "hsl(200, 90%, 60%)",
  };
  const factionColor = factionColors[faction];

  const handleAnimalSelect = (animal: AnimalType) => {
    setSelectedAnimal(animal);
    setTimeout(() => setStep("element"), 300);
  };

  const handleElementSelect = (element: ElementType) => {
    setSelectedElement(element);
  };

  const handleComplete = () => {
    if (selectedAnimal && selectedElement) {
      // Auto-generate a name based on animal and element
      const animalData = animals.find(a => a.id === selectedAnimal);
      const elementData = elements.find(e => e.id === selectedElement);
      const defaultName = `${elementData?.name} ${animalData?.name}`;
      onComplete(selectedAnimal, selectedElement, defaultName);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col p-6">
      {/* Background Stars */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-safe-top text-center mb-6 z-10"
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          {step === "animal" ? "Choose Your Spirit Animal" : "Infuse Your Element"}
        </h1>
        <p className="text-white/70">
          {step === "animal" 
            ? "This creature will be your companion through the cosmos"
            : "Your element shapes your companion's cosmic energy"
          }
        </p>
      </motion.div>

      {/* Selection Area */}
      <div className="flex-1 flex flex-col justify-center z-10">
        <AnimatePresence mode="wait">
          {step === "animal" && (
            <motion.div
              key="animal"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="grid grid-cols-2 gap-3"
            >
              {animals.map((animal, index) => (
                <motion.button
                  key={animal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleAnimalSelect(animal.id)}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    selectedAnimal === animal.id
                      ? "border-primary bg-primary/20"
                      : "border-white/20 bg-card/30 hover:border-white/40"
                  }`}
                >
                  <div className="text-4xl mb-2">{animal.emoji}</div>
                  <div className="text-white font-semibold">{animal.name}</div>
                  <div className="text-white/60 text-xs">{animal.trait}</div>
                  
                  {selectedAnimal === animal.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check size={14} className="text-white" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </motion.div>
          )}

          {step === "element" && (
            <motion.div
              key="element"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              {/* Suggested Elements */}
              <div className="mb-4">
                <p className="text-white/60 text-sm mb-2 text-center">
                  ✨ Suggested for your faction
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {elements
                    .filter(e => suggestedElements.includes(e.id))
                    .map((element, index) => (
                      <motion.button
                        key={element.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => handleElementSelect(element.id)}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          selectedElement === element.id
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-white/30 hover:border-white/50"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${element.color}40, ${element.color}20)`,
                        }}
                      >
                        <div className="text-white font-semibold">{element.name}</div>
                        {selectedElement === element.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check size={12} className="text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                </div>
              </div>

              {/* All Elements */}
              <div>
                <p className="text-white/60 text-sm mb-2 text-center">All elements</p>
                <div className="grid grid-cols-4 gap-2">
                  {elements
                    .filter(e => !suggestedElements.includes(e.id))
                    .map((element, index) => (
                      <motion.button
                        key={element.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                        onClick={() => handleElementSelect(element.id)}
                        className={`relative p-3 rounded-lg border transition-all ${
                          selectedElement === element.id
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-white/20 hover:border-white/40"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${element.color}30, ${element.color}10)`,
                        }}
                      >
                        <div className="text-white text-sm font-medium">{element.name}</div>
                        {selectedElement === element.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check size={10} className="text-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                </div>
              </div>

              {/* Preview */}
              {selectedAnimal && selectedElement && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-white/10 text-center"
                >
                  <p className="text-white/60 text-sm">Your companion</p>
                  <p className="text-2xl font-bold text-white">
                    {animals.find(a => a.id === selectedAnimal)?.emoji}{" "}
                    {elements.find(e => e.id === selectedElement)?.name}{" "}
                    {animals.find(a => a.id === selectedAnimal)?.name}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Continue Button */}
      {step === "element" && selectedElement && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pb-safe-bottom z-10"
        >
          <Button
            onClick={handleComplete}
            className="w-full py-6 text-lg font-semibold"
            style={{
              background: `linear-gradient(135deg, ${factionColor}, ${factionColor}80)`,
            }}
          >
            Summon My Companion
            <ChevronRight className="ml-2" />
          </Button>
        </motion.div>
      )}
    </div>
  );
};
