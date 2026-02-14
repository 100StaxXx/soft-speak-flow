import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionHealth, CompanionMoodState } from "@/hooks/useCompanionHealth";
import { useCompanion } from "@/hooks/useCompanion";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useLivingCompanionSafe } from "@/hooks/useLivingCompanion";

interface WelcomeBackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeBackModal = ({ isOpen, onClose }: WelcomeBackModalProps) => {
  const { health, markUserActive } = useCompanionHealth();
  const { companion } = useCompanion();
  const { awardCustomXP, XP_REWARDS } = useXPRewards();
  const { triggerComeback } = useLivingCompanionSafe();
  const [showReunion, setShowReunion] = useState(false);
  const [hasAwarded, setHasAwarded] = useState(false);

  // Calculate stats lost during absence
  const statsLost = Math.min(health.daysInactive * 5, 50); // -5 per day, max 50

  const getMoodEmoji = (mood: CompanionMoodState) => {
    switch (mood) {
      case 'happy': return '😊';
      case 'content': return '🙂';
      case 'neutral': return '😐';
      case 'worried': return '😟';
      case 'sad': return '😢';
      case 'sick': return '🤒';
      default: return '😊';
    }
  };

  const handleWelcomeBack = async () => {
    // Trigger reunion animation
    setShowReunion(true);

    // Award welcome back XP bonus (only once) before activity reset.
    if (!hasAwarded) {
      await awardCustomXP(
        XP_REWARDS.WELCOME_BACK_BONUS,
        "welcome_back_bonus",
        "Welcome Back Bonus! 🎉",
        { days_inactive: health.daysInactive }
      );
      setHasAwarded(true);
    }

    // Mark user as active after XP gating has evaluated inactivity.
    await markUserActive();
    
    // Trigger comeback reaction for returning users (3+ days inactive)
    if (health.daysInactive >= 3) {
      triggerComeback().catch(err => 
        console.log('[LivingCompanion] Comeback reaction failed:', err)
      );
    }
    
    // Close after animation
    setTimeout(() => {
      onClose();
      setShowReunion(false);
    }, 2000);
  };

  // Reset hasAwarded when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasAwarded(false);
      setShowReunion(false);
    }
  }, [isOpen]);

  if (!companion) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="cosmiq-glass border-celestial-blue/40 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-center">
            {showReunion ? "Welcome Back! 🎉" : `${getMoodEmoji(health.moodState)} We Missed You!`}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {showReunion 
              ? "Your companion is so happy to see you!"
              : `Your companion has been waiting for you for ${health.daysInactive} day${health.daysInactive !== 1 ? 's' : ''}...`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Companion Image with Animation */}
          <div className="flex justify-center">
            <AnimatePresence mode="wait">
              {!showReunion ? (
                <motion.div
                  key="sad"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative"
                >
                  {/* Sad state - use neglected image or filtered normal image */}
                  <img
                    src={health.neglectedImageUrl || companion.current_image_url || ""}
                    alt="Your sad companion"
                    className="w-48 h-48 object-cover rounded-2xl"
                    style={{
                      filter: !health.neglectedImageUrl 
                        ? 'saturate(0.4) brightness(0.8)' 
                        : undefined
                    }}
                  />
                  <div className="absolute -bottom-2 -right-2 text-4xl">💔</div>
                </motion.div>
              ) : (
                <motion.div
                  key="happy"
                  initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                  animate={{ 
                    opacity: 1, 
                    scale: [1, 1.1, 1], 
                    rotate: [0, 5, -5, 0] 
                  }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  {/* Happy state - normal image */}
                  <img
                    src={companion.current_image_url || ""}
                    alt="Your happy companion"
                    className="w-48 h-48 object-cover rounded-2xl ring-4 ring-primary/50"
                  />
                  <motion.div 
                    className="absolute -top-2 -right-2 text-4xl"
                    animate={{ 
                      scale: [1, 1.3, 1],
                      rotate: [0, 15, -15, 0]
                    }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    ❤️
                  </motion.div>
                  <Sparkles className="absolute -top-4 left-1/2 -translate-x-1/2 h-8 w-8 text-stardust-gold animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Stats Impact */}
          {!showReunion && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-center text-muted-foreground">
                While you were away...
              </h4>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <TrendingDown className="h-4 w-4 mx-auto text-destructive mb-1" />
                  <p className="text-xs text-muted-foreground">Body</p>
                  <p className="text-sm font-bold text-destructive">-{statsLost}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <TrendingDown className="h-4 w-4 mx-auto text-destructive mb-1" />
                  <p className="text-xs text-muted-foreground">Mind</p>
                  <p className="text-sm font-bold text-destructive">-{statsLost}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <TrendingDown className="h-4 w-4 mx-auto text-destructive mb-1" />
                  <p className="text-xs text-muted-foreground">Soul</p>
                  <p className="text-sm font-bold text-destructive">-{statsLost}</p>
                </div>
              </div>

              {/* Recovery Bonus */}
              <div className="p-3 rounded-lg bg-stardust-gold/10 border border-stardust-gold/20">
                <div className="flex items-center gap-2 justify-center">
                  <TrendingUp className="h-4 w-4 text-stardust-gold" />
                  <span className="text-sm font-medium">Come back and earn:</span>
                </div>
                <div className="flex items-center gap-4 justify-center mt-2">
                  <span className="text-sm text-muted-foreground">+10 to all stats</span>
                  <span className="text-sm text-stardust-gold font-bold">+25 XP bonus!</span>
                </div>
              </div>
            </div>
          )}

          {/* Reunion Message */}
          {showReunion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-2"
            >
              <p className="text-lg font-medium text-stardust-gold">
                Your companion is overjoyed! 
              </p>
              <p className="text-sm text-muted-foreground">
                +10 Body, +10 Mind, +10 Soul restored
              </p>
              <p className="text-sm font-bold text-stardust-gold">
                +25 XP Welcome Back Bonus!
              </p>
            </motion.div>
          )}

          {/* Action Button */}
          {!showReunion && (
            <Button 
              onClick={handleWelcomeBack}
              className="w-full rounded-2xl min-h-[48px] bg-gradient-to-r from-stardust-gold to-amber-500 text-black hover:from-stardust-gold/90 hover:to-amber-500/90"
            >
              <Heart className="h-5 w-5 mr-2" />
              Reunite with Your Companion
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
