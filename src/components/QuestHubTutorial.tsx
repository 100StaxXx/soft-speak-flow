import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Swords, 
  Target, 
  Compass, 
  CheckCircle2, 
  Sparkles, 
  Zap,
  Flame,
  MapPin,
  Repeat,
  Brain
} from "lucide-react";

interface QuestHubTutorialProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
}

const STEPS = [
  {
    id: "quests",
    icon: Swords,
    title: "Daily Quests",
    subtitle: "Every hero starts somewhere...",
    features: [
      { icon: Brain, text: "Use the Quick Add Bar to create quests with natural language", color: "text-sky-400" },
      { icon: CheckCircle2, text: "Complete quests to earn XP and grow your companion", color: "text-green-400" },
      { icon: Zap, text: "First 3 quests earn full XP, then rewards gradually decrease", color: "text-amber-400" },
      { icon: Sparkles, text: "Set a Main Quest for 1.5x XP bonus", color: "text-primary" },
    ],
    gradient: "from-green-500/20 via-emerald-500/20 to-teal-500/20",
    iconGlow: "shadow-[0_0_60px_rgba(34,197,94,0.4)]",
  },
  {
    id: "campaigns",
    icon: Target,
    title: "Epic Campaigns",
    subtitle: "Great journeys need direction...",
    features: [
      { icon: MapPin, text: "Turn big goals into guided adventures with milestones", color: "text-purple-400" },
      { icon: Brain, text: "AI Pathfinder creates custom plans just for you", color: "text-sky-400" },
      { icon: Repeat, text: "Link daily rituals to campaigns for auto-progress", color: "text-pink-400" },
      { icon: Sparkles, text: "Unlock postcards as your companion reaches milestones", color: "text-amber-400" },
    ],
    gradient: "from-purple-500/20 via-pink-500/20 to-rose-500/20",
    iconGlow: "shadow-[0_0_60px_rgba(168,85,247,0.4)]",
  },
  {
    id: "hub",
    icon: Compass,
    title: "Your Quest Hub",
    subtitle: "This is your command center...",
    features: [
      { icon: Swords, text: "Daily quests keep you moving forward every day", color: "text-green-400" },
      { icon: Target, text: "Campaigns guide your bigger ambitions", color: "text-purple-400" },
      { icon: Zap, text: "Smart input understands natural language", color: "text-sky-400" },
      { icon: Flame, text: "Your companion grows stronger with every quest", color: "text-orange-400" },
    ],
    gradient: "from-primary/20 via-purple-500/20 to-pink-500/20",
    iconGlow: "shadow-[0_0_60px_rgba(var(--primary),0.4)]",
  },
];

export function QuestHubTutorial({ open, onClose, userName }: QuestHubTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Generate stable particle positions
  const particles = useMemo(() => 
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
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
      }, 300);
    }
  };

  const handleBack = () => {
    if (isAnimating || currentStep === 0) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((prev) => prev - 1);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="sm:max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-none"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative rounded-2xl overflow-hidden"
        >
          {/* Background with gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} opacity-50`} />
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />
          
          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full bg-primary/30"
                style={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  width: particle.size,
                  height: particle.size,
                }}
                animate={{
                  y: [0, -20, 0],
                  opacity: [0.3, 0.7, 0.3],
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

          {/* Content */}
          <div className="relative z-10 p-6 sm:p-8">
            {/* Progress indicator */}
            <div className="flex justify-center gap-2 mb-6">
              {STEPS.map((_, index) => (
                <motion.div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep 
                      ? "w-8 bg-primary" 
                      : index < currentStep 
                        ? "w-4 bg-primary/50" 
                        : "w-4 bg-muted-foreground/20"
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
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                {/* Icon with glow */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="relative mx-auto mb-6"
                >
                  {/* Outer glow ring */}
                  <motion.div
                    className={`absolute inset-0 rounded-full ${step.iconGlow} blur-xl`}
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  
                  {/* Icon container */}
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30">
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <StepIcon className="w-10 h-10 text-primary" />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Title and subtitle */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent"
                >
                  {step.title}
                </motion.h2>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-muted-foreground mb-6 italic"
                >
                  {step.subtitle}
                </motion.p>

                {/* Features list */}
                <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
                  {step.features.map((feature, index) => {
                    const FeatureIcon = feature.icon;
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        className="flex items-start gap-3 p-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30"
                      >
                        <div className={`mt-0.5 ${feature.color}`}>
                          <FeatureIcon className="w-5 h-5" />
                        </div>
                        <p className="text-sm text-foreground/90">{feature.text}</p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Personalized message on last step */}
                {isLastStep && userName && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-sm text-muted-foreground mb-4"
                  >
                    Ready to begin your adventure, <span className="text-primary font-medium">{userName}</span>?
                  </motion.p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={isAnimating}
                  className="flex-1"
                >
                  Back
                </Button>
              )}
              
              <motion.div
                className={currentStep === 0 ? "w-full" : "flex-1"}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleNext}
                  disabled={isAnimating}
                  className="w-full bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
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
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
