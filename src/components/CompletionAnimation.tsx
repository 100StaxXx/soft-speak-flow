import { useEffect } from "react";
import confetti from "canvas-confetti";
import { playLessonComplete } from "@/utils/soundEffects";
import { Check } from "lucide-react";

interface CompletionAnimationProps {
  show: boolean;
  message?: string;
  onComplete?: () => void;
}

export const CompletionAnimation = ({ 
  show, 
  message = "Completed!", 
  onComplete 
}: CompletionAnimationProps) => {
  useEffect(() => {
    if (show) {
      // Play gentle completion sound
      playLessonComplete();

      // Subtle confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#a76cff', '#b07fff', '#c094ff'],
        ticks: 100,
        gravity: 0.8,
        scalar: 0.8
      });

      // Auto-complete callback after animation
      if (onComplete) {
        const timer = setTimeout(onComplete, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-scale-in">
        <div className="bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-xl border-2 border-primary/30 rounded-3xl p-8 shadow-glow-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping" />
              <div className="relative bg-primary rounded-full p-4">
                <Check className="h-8 w-8 text-primary-foreground" strokeWidth={3} />
              </div>
            </div>
            <p className="text-xl font-heading font-bold text-foreground">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
