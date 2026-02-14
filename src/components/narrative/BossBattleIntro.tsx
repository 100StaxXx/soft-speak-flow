import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sword, Shield, Sparkles, Skull, 
  Eye, Zap, Star, ChevronRight, Info 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BossBattleContext } from "@/types/narrativeTypes";
import type { AdversaryTheme } from "@/types/astralEncounters";

const themeColors: Partial<Record<AdversaryTheme, string>> = {
  doubt: "from-gray-600 to-slate-800",
  fear: "from-purple-900 to-indigo-950",
  chaos: "from-red-600 to-orange-800",
  stagnation: "from-stone-600 to-zinc-800",
  anxiety: "from-violet-900 to-purple-950",
  distraction: "from-cyan-700 to-blue-900",
  laziness: "from-amber-700 to-orange-900",
  overthinking: "from-indigo-800 to-slate-900",
  confusion: "from-pink-800 to-rose-950",
  vulnerability: "from-emerald-800 to-teal-950",
  imbalance: "from-rose-700 to-red-900",
};

const themeIcons: Partial<Record<AdversaryTheme, typeof Skull>> = {
  doubt: Eye,
  fear: Skull,
  chaos: Zap,
  stagnation: Shield,
  anxiety: Eye,
  distraction: Sparkles,
  laziness: Shield,
  overthinking: Eye,
  confusion: Zap,
  vulnerability: Shield,
  imbalance: Zap,
};

interface BossBattleIntroProps {
  context: BossBattleContext;
  onBeginBattle: () => void;
  onCancel: () => void;
}

export const BossBattleIntro = ({ context, onBeginBattle, onCancel }: BossBattleIntroProps) => {
  const [phase, setPhase] = useState<"lore" | "intel" | "ready">("lore");

  const ThemeIcon = themeIcons[context.bossTheme] || Skull;
  const gradient = themeColors[context.bossTheme] || "from-slate-900 to-black";

  useEffect(() => {
    // Auto-advance through phases
    const timer1 = setTimeout(() => setPhase("intel"), 3000);
    const timer2 = setTimeout(() => setPhase("ready"), 6000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
    >
      <div className="max-w-lg w-full mx-4">
        <AnimatePresence mode="wait">
          {/* Phase 1: Lore Reveal */}
          {phase === "lore" && (
            <motion.div
              key="lore"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className={cn(
                  "w-24 h-24 mx-auto rounded-full flex items-center justify-center",
                  "bg-gradient-to-br shadow-2xl",
                  gradient
                )}>
                  <ThemeIcon className="w-12 h-12 text-white/80" />
                </div>
              </motion.div>

              <div className="space-y-2">
                <Badge variant="destructive" className="text-xs">
                  Final Confrontation
                </Badge>
                <h2 className="text-3xl font-bold">{context.bossName}</h2>
                <p className="text-sm text-muted-foreground italic">
                  "{context.bookTitle}"
                </p>
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed">
                {context.bossLore}
              </p>
            </motion.div>
          )}

          {/* Phase 2: Intel Gathered */}
          {phase === "intel" && (
            <motion.div
              key="intel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <Badge variant="outline" className="mb-2">
                  <Info className="w-3 h-3 mr-1" />
                  Intel Gathered
                </Badge>
                <h3 className="text-xl font-semibold">Your Journey Has Revealed...</h3>
              </div>

              <Card className="p-4 space-y-3 bg-primary/5 border-primary/20">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Weakness Hints
                </h4>
                <ul className="space-y-2">
                  {context.weaknessHints.map((hint, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.3 }}
                      className="text-sm text-foreground/80 flex items-start gap-2"
                    >
                      <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <span>{hint}</span>
                    </motion.li>
                  ))}
                </ul>
              </Card>

              {context.prophecyLines.length > 0 && (
                <Card className="p-4 space-y-3 bg-accent/5 border-accent/20">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-accent" />
                    Prophecy Fragments
                  </h4>
                  <div className="space-y-2">
                    {context.prophecyLines.map((line, index) => (
                      <motion.p
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 + index * 0.2 }}
                        className="text-sm italic text-foreground/70"
                      >
                        "{line}"
                      </motion.p>
                    ))}
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {/* Phase 3: Ready for Battle */}
          {phase === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="text-center space-y-6"
            >
              <motion.div
                animate={{ 
                  boxShadow: [
                    "0 0 20px hsl(var(--destructive) / 0.3)",
                    "0 0 40px hsl(var(--destructive) / 0.6)",
                    "0 0 20px hsl(var(--destructive) / 0.3)",
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className={cn(
                  "w-32 h-32 mx-auto rounded-full flex items-center justify-center",
                  "bg-gradient-to-br",
                  gradient
                )}
              >
                <Sword className="w-16 h-16 text-white" />
              </motion.div>

              <div>
                <h2 className="text-2xl font-bold mb-2">Face Your Destiny</h2>
                <p className="text-sm text-muted-foreground">
                  All your preparations have led to this moment.
                  <br />
                  Are you ready to complete your story?
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={onCancel}>
                  Not Yet
                </Button>
                <Button 
                  onClick={onBeginBattle}
                  className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                >
                  Begin Battle
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skip button (always visible) */}
        {phase !== "ready" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-center"
          >
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setPhase("ready")}
              className="text-muted-foreground"
            >
              Skip to Battle →
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
