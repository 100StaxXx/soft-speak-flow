import { useState, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Sparkles, Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playMissionComplete } from "@/utils/soundEffects";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { useMotionProfile } from "@/hooks/useMotionProfile";

interface QuestClearCelebrationProps {
  show: boolean;
  totalXP: number;
  currentStreak: number;
  onDismiss: () => void;
}

export const QuestClearCelebration = memo(function QuestClearCelebration({ 
  show, 
  totalXP, 
  currentStreak, 
  onDismiss 
}: QuestClearCelebrationProps) {
  const [stage, setStage] = useState<'entering' | 'main' | 'exiting'>('entering');
  const { capabilities, profile } = useMotionProfile();
  
  useEffect(() => {
    if (show) {
      setStage('entering');
      
      // Play sound and haptic
      playMissionComplete();
      haptics.success();
      
      if (capabilities.allowBackgroundAnimation) {
        const baseCount = profile === "enhanced" ? 90 : 55;
        confetti({
          particleCount: baseCount,
          spread: 65,
          origin: { y: 0.62 },
          colors: ['#FFD700', '#A855F7', '#EC4899', '#3B82F6'],
          scalar: profile === "enhanced" ? 0.9 : 0.8,
        });

        setTimeout(() => {
          confetti({
            particleCount: Math.round(baseCount * 0.45),
            angle: 60,
            spread: 50,
            origin: { x: 0, y: 0.7 },
            colors: ['#FFD700', '#A855F7'],
          });
          confetti({
            particleCount: Math.round(baseCount * 0.45),
            angle: 120,
            spread: 50,
            origin: { x: 1, y: 0.7 },
            colors: ['#FFD700', '#A855F7'],
          });
        }, 160);
      }
      
      // Transition to main stage
      setTimeout(() => setStage('main'), 300);
    }
  }, [capabilities.allowBackgroundAnimation, profile, show]);
  
  const handleDismiss = () => {
    setStage('exiting');
    setTimeout(onDismiss, 300);
  };
  
  if (!show) return null;
  
  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-6",
        "bg-background/90 backdrop-blur-md",
        stage === 'entering' && "animate-fade-in",
        stage === 'exiting' && "animate-fade-out"
      )}
      onClick={handleDismiss}
    >
      <div 
        className={cn(
          "relative max-w-sm w-full",
          stage === 'main' && "animate-scale-in"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ring */}
        <div className="absolute inset-0 -m-4 bg-gradient-to-r from-stardust-gold via-primary to-stardust-gold rounded-3xl blur-xl opacity-50 animate-pulse" />
        
        {/* Main card */}
        <div className="relative bg-gradient-to-br from-card via-secondary to-card rounded-2xl p-8 border border-stardust-gold/50 shadow-2xl">
          {/* Top decoration */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-stardust-gold blur-lg opacity-60" />
              <div className="relative bg-gradient-to-br from-stardust-gold to-amber-500 p-4 rounded-full shadow-lg">
                <Trophy className="h-8 w-8 text-background" />
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="text-center space-y-4 pt-8">
            {/* Title */}
            <div className="relative">
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-stardust-gold via-amber-300 to-stardust-gold animate-gradient-shift">
                QUEST CLEAR!
              </h2>
              <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-stardust-gold animate-sparkle" />
              <Sparkles className="absolute -bottom-1 -left-2 h-4 w-4 text-primary animate-sparkle" style={{ animationDelay: '200ms' }} />
            </div>
            
            {/* Subtitle */}
            <p className="text-lg text-muted-foreground">
              Legendary Performance! 🏆
            </p>
            
            {/* Stats */}
            <div className="flex justify-center gap-6 py-4">
              {/* Total XP */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-stardust-gold">
                  <Star className="h-5 w-5 fill-stardust-gold" />
                  {totalXP}
                </div>
                <p className="text-xs text-muted-foreground">Total XP</p>
              </div>
              
              {/* Divider */}
              <div className="w-px bg-border" />
              
              {/* Streak */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-orange-500">
                  <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
                  {currentStreak}
                </div>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
            
            {/* Continue button */}
            <Button
              onClick={handleDismiss}
              className="w-full bg-gradient-to-r from-stardust-gold to-amber-500 hover:opacity-90 text-background font-bold text-lg py-6"
            >
              Continue
            </Button>
          </div>
          
          {/* Corner decorations */}
          <Star className="absolute top-4 left-4 h-4 w-4 text-stardust-gold/30" />
          <Star className="absolute top-4 right-4 h-4 w-4 text-stardust-gold/30" />
          <Star className="absolute bottom-4 left-4 h-4 w-4 text-primary/30" />
          <Star className="absolute bottom-4 right-4 h-4 w-4 text-primary/30" />
        </div>
      </div>
    </div>
  );
});
