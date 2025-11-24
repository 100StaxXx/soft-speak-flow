import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy, Star, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduleCelebrationProps {
  trigger: boolean;
  type: "perfect_week" | "power_hour" | "deep_work" | "conflict_free";
  onComplete?: () => void;
}

const celebrationMessages = {
  perfect_week: {
    title: "🎯 Perfect Week Planned!",
    message: "Every quest scheduled with zero conflicts. You're unstoppable!",
    icon: Crown,
    color: "text-amber-500"
  },
  power_hour: {
    title: "⚡ Power Hour Activated!",
    message: "3+ consecutive quests locked in. Maximum productivity mode!",
    icon: Sparkles,
    color: "text-violet-500"
  },
  deep_work: {
    title: "🎯 Deep Work Beast!",
    message: "90+ minute focus block scheduled. This is how legends are made!",
    icon: Star,
    color: "text-blue-500"
  },
  conflict_free: {
    title: "✨ Conflict-Free Zone!",
    message: "All quests perfectly spaced. Your schedule flows like water!",
    icon: Trophy,
    color: "text-emerald-500"
  }
};

export const ScheduleCelebration = ({ trigger, type, onComplete }: ScheduleCelebrationProps) => {
  const [show, setShow] = useState(false);
  const config = celebrationMessages[type];
  const Icon = config.icon;

  useEffect(() => {
    if (trigger) {
      setShow(true);
      
      // Fire confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const colors = type === "perfect_week" 
        ? ['#FFD700', '#FFA500', '#FF6347']
        : ['#a76cff', '#7c3aed', '#8b5cf6'];

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          setTimeout(() => {
            setShow(false);
            onComplete?.();
          }, 1000);
          return;
        }

        confetti({
          particleCount: type === "perfect_week" ? 3 : 2,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: randomInRange(0.1, 0.9),
            y: Math.random() - 0.2
          },
          colors
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [trigger, type, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className={cn(
        "pointer-events-auto animate-in zoom-in-50 fade-in-0 duration-500",
        "bg-card/95 backdrop-blur-xl border-2 rounded-2xl p-8 shadow-2xl max-w-md mx-4",
        type === "perfect_week" && "border-amber-500 shadow-amber-500/50",
        type !== "perfect_week" && "border-primary shadow-primary/50"
      )}>
        <div className="text-center space-y-4">
          <div className={cn(
            "inline-flex p-4 rounded-full animate-pulse",
            type === "perfect_week" ? "bg-amber-500/20" : "bg-primary/20"
          )}>
            <Icon className={cn("h-12 w-12", config.color)} />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold mb-2">{config.title}</h2>
            <p className="text-muted-foreground">{config.message}</p>
          </div>
          
          <div className="flex items-center justify-center gap-2 pt-4">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-6 w-6 fill-current",
                  config.color,
                  "animate-in zoom-in-50 fade-in-0"
                )}
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
