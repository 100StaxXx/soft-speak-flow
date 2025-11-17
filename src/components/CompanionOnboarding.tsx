import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Target, TrendingUp, Heart, ChevronRight } from "lucide-react";
import confetti from "canvas-confetti";

interface OnboardingStep {
  title: string;
  description: string;
  icon: typeof Sparkles;
  highlight?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Meet Your Companion",
    description: "This is your personal growth companion. It evolves as you complete habits, missions, and achieve goals!",
    icon: Heart,
    highlight: "companion-image"
  },
  {
    title: "Earn XP to Evolve",
    description: "Complete daily habits, missions, and challenges to earn XP. Your companion will evolve through 7 stages as you grow!",
    icon: TrendingUp,
    highlight: "xp-progress"
  },
  {
    title: "Daily Missions",
    description: "Complete 3 daily missions for bonus XP. Many missions auto-complete when you do the actual activity!",
    icon: Target,
    highlight: "missions"
  },
  {
    title: "Attributes Matter",
    description: "Your companion's Spirit Animal, Element, and Color were chosen based on your preferences. They make your companion unique!",
    icon: Sparkles,
    highlight: "attributes"
  }
];

export const CompanionOnboarding = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem("companion-onboarding-complete");
    if (!hasSeenOnboarding) {
      // Delay to let page load
      setTimeout(() => setIsVisible(true), 800);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem("companion-onboarding-complete", "true");
    setIsVisible(false);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#A76CFF', '#C084FC', '#E879F9']
    });
  };

  const handleSkip = () => {
    localStorage.setItem("companion-onboarding-complete", "true");
    setIsVisible(false);
  };

  const step = ONBOARDING_STEPS[currentStep];
  const Icon = step.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={handleSkip}
          />

          {/* Onboarding Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-card via-primary/5 to-accent/10 border-primary/40 shadow-glow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
              
              <div className="relative p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-heading font-bold">
                        {step.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSkip}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>

                {/* Progress Dots */}
                <div className="flex items-center justify-center gap-2">
                  {ONBOARDING_STEPS.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full transition-all ${
                        index === currentStep
                          ? "w-8 bg-primary"
                          : index < currentStep
                          ? "w-2 bg-primary/50"
                          : "w-2 bg-muted"
                      }`}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="flex-1"
                  >
                    Skip Tour
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex-1 gap-2"
                  >
                    {currentStep < ONBOARDING_STEPS.length - 1 ? (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Get Started
                        <Sparkles className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
