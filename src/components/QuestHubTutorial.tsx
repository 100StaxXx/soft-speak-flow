import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Swords, 
  Target, 
  Sparkles, 
  Zap,
  MapPin,
  Repeat,
  Brain,
  ChevronLeft
} from "lucide-react";
import { LucideIcon } from "lucide-react";

interface QuestHubTutorialProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
}

interface Feature {
  icon: LucideIcon;
  text: string;
}

interface Step {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  features: Feature[];
}

const STEPS: Step[] = [
  {
    id: "quests",
    icon: Swords,
    title: "Daily Quests",
    subtitle: "Every hero starts somewhere...",
    features: [
      { icon: Brain, text: "Use the Quick Add Bar to create quests naturally" },
      { icon: Zap, text: "Complete quests to earn XP and grow your companion" },
      { icon: Sparkles, text: "Set a Main Quest for 1.5x XP bonus" },
    ],
  },
  {
    id: "campaigns",
    icon: Target,
    title: "Epic Campaigns",
    subtitle: "Great journeys need direction...",
    features: [
      { icon: MapPin, text: "Turn big goals into guided adventures" },
      { icon: Brain, text: "AI Pathfinder creates custom plans for you" },
      { icon: Repeat, text: "Link rituals to campaigns for auto-progress" },
    ],
  },
];

export function QuestHubTutorial({ open, onClose, userName }: QuestHubTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Generate stable particle positions
  const particles = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
    })), 
  []);

  // Reset step when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setIsAnimating(false);
    }
  }, [open]);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const StepIcon = step.icon;

  const handleNext = () => {
    if (isAnimating) return;
    
    if (isLastStep) {
      onClose();
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setIsAnimating(false);
      }, 250);
    }
  };

  const handleBack = () => {
    if (isAnimating || currentStep === 0) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((prev) => prev - 1);
      setIsAnimating(false);
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="max-w-sm rounded-3xl bg-background/80 backdrop-blur-2xl border-white/10 shadow-2xl shadow-black/20 p-0 overflow-hidden"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            type: "spring", 
            damping: 25, 
            stiffness: 300 
          }}
          className="relative"
        >
          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full bg-primary/20"
                style={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  width: particle.size,
                  height: particle.size,
                }}
                animate={{
                  y: [0, -15, 0],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Progress indicator */}
          <div className="flex justify-center gap-2 pt-6 pb-2">
            {STEPS.map((_, index) => (
              <motion.div
                key={index}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentStep 
                    ? "w-6 bg-primary" 
                    : index < currentStep 
                      ? "w-3 bg-primary/40" 
                      : "w-3 bg-muted-foreground/20"
                }`}
                layoutId={`progress-${index}`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Hero section */}
              <div className="pt-4 pb-4 flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", damping: 15 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150" />
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-white/10 shadow-lg">
                    <StepIcon className="w-8 h-8 text-primary" />
                  </div>
                </motion.div>
                
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mt-5 text-xl font-semibold tracking-tight text-foreground"
                >
                  {step.title}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-1 text-sm text-muted-foreground italic"
                >
                  {step.subtitle}
                </motion.p>
              </div>

              {/* Feature list */}
              <div className="px-5 pb-4">
                <div className="rounded-2xl bg-card/50 backdrop-blur-sm divide-y divide-border/30 overflow-hidden">
                  {step.features.map((feature, i) => {
                    const FeatureIcon = feature.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.05 }}
                        className="flex items-center gap-3 px-4 py-3.5"
                      >
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FeatureIcon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm text-foreground/90">{feature.text}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Personalized message on last step */}
              {isLastStep && userName && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-center text-sm text-muted-foreground pb-2"
                >
                  Ready to begin, <span className="text-primary font-medium">{userName}</span>?
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="px-5 pb-6 pt-2 flex gap-3">
            {currentStep > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  disabled={isAnimating}
                  className="h-12 w-12 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </motion.div>
            )}
            
            <motion.div
              className="flex-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Button
                onClick={handleNext}
                disabled={isAnimating}
                className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 font-medium text-base shadow-lg shadow-primary/25 transition-all duration-200 active:scale-[0.98]"
              >
                {isLastStep ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Begin Adventure
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
