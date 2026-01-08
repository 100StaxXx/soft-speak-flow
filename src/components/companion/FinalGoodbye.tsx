import { memo, useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, Star, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface LegacyTrait {
  trait: string;
  description: string;
  bonus: string;
}

interface FinalGoodbyeProps {
  open: boolean;
  onComplete: (legacyTraits: LegacyTrait[]) => void;
  companionName: string;
  spiritAnimal: string;
  coreElement: string;
  daysTogtogether: number;
  finalStage: number;
  finalImageUrl: string | null;
}

// Determine legacy traits based on companion stats
const determineLegacyTraits = (
  daysTogtogether: number,
  finalStage: number,
  coreElement: string
): LegacyTrait[] => {
  const traits: LegacyTrait[] = [];

  // Longevity trait
  if (daysTogtogether >= 30) {
    traits.push({
      trait: "Enduring Bond",
      description: `Inherited from a companion of ${daysTogtogether} days`,
      bonus: "+5% XP gain for first 7 days",
    });
  }

  // Evolution achievement trait
  if (finalStage >= 10) {
    traits.push({
      trait: "Evolutionary Wisdom",
      description: `Learned from a companion who reached stage ${finalStage}`,
      bonus: "+10 starting XP",
    });
  }

  // Element mastery trait
  if (coreElement) {
    traits.push({
      trait: `${coreElement} Affinity`,
      description: `A spark of ${coreElement.toLowerCase()} energy passed on`,
      bonus: `Enhanced ${coreElement.toLowerCase()} visual effects`,
    });
  }

  // If no traits earned, give a basic one
  if (traits.length === 0) {
    traits.push({
      trait: "Remembered Love",
      description: "The memory of connection lives on",
      bonus: "Warmer greeting on first day",
    });
  }

  return traits;
};

export const FinalGoodbye = memo(({
  open,
  onComplete,
  companionName,
  spiritAnimal,
  coreElement,
  daysTogtogether,
  finalStage,
  finalImageUrl,
}: FinalGoodbyeProps) => {
  const [phase, setPhase] = useState<'farewell' | 'legacy' | 'complete'>('farewell');
  const [legacyTraits, setLegacyTraits] = useState<LegacyTrait[]>([]);

  useEffect(() => {
    if (open) {
      setPhase('farewell');
      const traits = determineLegacyTraits(daysTogtogether, finalStage, coreElement);
      setLegacyTraits(traits);
    }
  }, [open, daysTogtogether, finalStage, coreElement]);

  const handleAdvance = () => {
    if (phase === 'farewell') {
      setPhase('legacy');
      // Gentle sparkle confetti for legacy reveal
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#C084FC', '#818CF8', '#F472B6'],
        scalar: 0.8,
      });
    } else if (phase === 'legacy') {
      setPhase('complete');
    } else {
      onComplete(legacyTraits);
    }
  };

  const displayName = companionName || `The ${spiritAnimal}`;

  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-md border-muted/30 bg-card/95 backdrop-blur-xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AnimatePresence mode="wait">
          {phase === 'farewell' && (
            <motion.div
              key="farewell"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 text-center py-4"
            >
              {/* Fading companion image */}
              <div className="relative mx-auto w-40 h-40">
                <motion.div
                  animate={{ 
                    opacity: [0.7, 0.5, 0.7],
                    scale: [1, 1.02, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0"
                >
                  <img
                    src={finalImageUrl || '/placeholder.svg'}
                    alt={displayName}
                    className="w-full h-full object-cover rounded-full grayscale opacity-60"
                  />
                </motion.div>
                
                {/* Ascending particles */}
                <div className="absolute inset-0 overflow-hidden">
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-primary/60 rounded-full"
                      initial={{ 
                        x: `${30 + Math.random() * 40}%`, 
                        y: '80%',
                        opacity: 0,
                      }}
                      animate={{ 
                        y: '-20%',
                        opacity: [0, 0.8, 0],
                      }}
                      transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        delay: i * 0.4,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-heading font-bold text-foreground/80">
                  Farewell, {displayName}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed px-4">
                  {daysTogtogether} days of adventures, laughter, and growth.
                  Though your form fades, the bond you shared will never truly end.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-primary/60">
                <Heart className="w-4 h-4 fill-primary/30" />
                <span className="text-sm italic">
                  "Thank you for every moment we shared..."
                </span>
              </div>

              <Button onClick={handleAdvance} variant="ghost" className="text-muted-foreground">
                <Sparkles className="w-4 h-4 mr-2" />
                Continue
              </Button>
            </motion.div>
          )}

          {phase === 'legacy' && (
            <motion.div
              key="legacy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 text-center py-4"
            >
              <div className="space-y-2">
                <Star className="w-12 h-12 mx-auto text-primary" />
                <h2 className="text-2xl font-heading font-bold">
                  Legacy Traits Unlocked
                </h2>
                <p className="text-sm text-muted-foreground">
                  {displayName}'s spirit lives on through these gifts
                </p>
              </div>

              <div className="space-y-3 px-2">
                {legacyTraits.map((trait, i) => (
                  <motion.div
                    key={trait.trait}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.2 }}
                    className="bg-muted/20 rounded-lg p-3 text-left"
                  >
                    <h4 className="font-semibold text-primary flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      {trait.trait}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {trait.description}
                    </p>
                    <p className="text-xs text-accent mt-1">
                      → {trait.bonus}
                    </p>
                  </motion.div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground italic px-4">
                These traits will be inherited by your next companion
              </p>

              <Button onClick={handleAdvance} variant="ghost" className="text-muted-foreground">
                I understand
              </Button>
            </motion.div>
          )}

          {phase === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 text-center py-4"
            >
              <div className="space-y-4">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Heart className="w-16 h-16 mx-auto text-primary/60 fill-primary/30" />
                </motion.div>
                
                <h2 className="text-xl font-heading font-bold text-foreground/80">
                  Rest Well, Dear Friend
                </h2>
                
                <p className="text-sm text-muted-foreground leading-relaxed px-4">
                  {displayName} has been added to your Memorial Wall.
                  Their memory will forever shine among the stars.
                </p>

                <p className="text-sm text-foreground/60">
                  When you're ready, a new egg awaits...
                </p>
              </div>

              <Button 
                onClick={handleAdvance} 
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Begin New Journey
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
});

FinalGoodbye.displayName = 'FinalGoodbye';
