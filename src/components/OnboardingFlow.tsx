import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, MessageCircleHeart, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const slides = [
  {
    icon: Target,
    title: "Build Better Habits",
    description: "Track your daily habits with visual streaks and celebrate your consistency with confetti animations!",
    gradient: "from-primary/20 to-primary/5"
  },
  {
    icon: TrendingUp,
    title: "Monitor Your Progress",
    description: "See your journey with weekly insights, 30-day heatmaps, and achievement badges that keep you motivated.",
    gradient: "from-accent/20 to-accent/5"
  },
  {
    icon: MessageCircleHeart,
    title: "Get Inspired Daily",
    description: "Receive personalized pep talks from your AI mentor, tailored quotes, and proactive nudges when you need them most.",
    gradient: "from-pink-500/20 to-pink-500/5"
  },
  {
    icon: Sparkles,
    title: "Ready to Transform?",
    description: "You're all set! Start building habits, crushing challenges, and becoming the best version of yourself.",
    gradient: "from-primary/20 to-accent/5"
  }
];

interface OnboardingFlowProps {
  open: boolean;
  onComplete: () => void;
}

export const OnboardingFlow = ({ open, onComplete }: OnboardingFlowProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user } = useAuth();
  const progress = ((currentSlide + 1) / slides.length) * 100;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
    }
    onComplete();
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleComplete()}>
      <DialogContent className="max-w-lg">
        <div className="space-y-6 py-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {currentSlide + 1} of {slides.length}
            </p>
          </div>

          {/* Slide Content */}
          <div className={`p-8 rounded-2xl bg-gradient-to-br ${slide.gradient} space-y-6 animate-fade-in`}>
            <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold">{slide.title}</h2>
              <p className="text-muted-foreground">{slide.description}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            {currentSlide < slides.length - 1 ? (
              <>
                <Button variant="ghost" onClick={handleSkip}>
                  Skip
                </Button>
                <Button onClick={handleNext}>
                  Next
                </Button>
              </>
            ) : (
              <>
                <div />
                <Button onClick={handleComplete} size="lg" className="px-8">
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
