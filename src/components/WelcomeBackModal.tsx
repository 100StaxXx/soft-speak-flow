import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";

import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAchievements } from "@/hooks/useAchievements";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { useLivingCompanionSafe } from "@/hooks/useLivingCompanion";
import { useXPRewards } from "@/hooks/useXPRewards";
import {
  isCompanionSceneImageSource,
  shouldContainCompanionSceneImage,
} from "@/lib/companionImageFocal";

interface WelcomeBackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeBackModal = ({ isOpen, onClose }: WelcomeBackModalProps) => {
  const prefersReducedMotion = useReducedMotion();
  const { health, markUserActive } = useCompanionHealth();
  const { companion } = useCompanion();
  const { awardCustomXP, XP_REWARDS } = useXPRewards();
  const { checkComebackAchievement } = useAchievements();
  const { triggerComeback } = useLivingCompanionSafe();
  const [showReunion, setShowReunion] = useState(false);
  const [hasAwarded, setHasAwarded] = useState(false);
  const imageUrl = companion?.current_image_url || "";
  const usesContainedScene = shouldContainCompanionSceneImage(imageUrl);
  const usesPortraitShell = isCompanionSceneImageSource(imageUrl) && !usesContainedScene;

  const handleWelcomeBack = async () => {
    setShowReunion(true);

    if (!hasAwarded) {
      await awardCustomXP(
        XP_REWARDS.WELCOME_BACK_BONUS,
        "welcome_back_bonus",
        "Welcome Back Bonus",
        { days_inactive: health.daysInactive },
      );
      setHasAwarded(true);
    }

    await markUserActive();
    if (health.daysInactive >= 3) {
      void triggerComeback().catch(() => undefined);
    }
    await checkComebackAchievement(health.daysInactive);

    window.setTimeout(() => {
      onClose();
      setShowReunion(false);
    }, prefersReducedMotion ? 450 : 1400);
  };

  useEffect(() => {
    if (!isOpen) return;
    setHasAwarded(false);
    setShowReunion(false);
  }, [isOpen]);

  if (!companion) return null;

  const portrait = (
    <CompanionImage
      src={imageUrl}
      alt={companion.companion_name ? `${companion.companion_name}, your companion` : "Your companion"}
      fit={usesPortraitShell ? "portrait" : usesContainedScene ? "contain" : "cover"}
      element={companion.core_element}
      focalX={companion.current_image_focal_x ?? null}
      focalY={companion.current_image_focal_y ?? null}
      className={`h-full w-full rounded-2xl ${usesContainedScene ? "bg-black" : ""}`}
    />
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="cosmiq-glass max-w-md border-celestial-blue/40">
        <DialogHeader>
          <DialogTitle className="text-center font-heading text-2xl">
            {showReunion ? "A new beginning ✨" : "Welcome back"}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {showReunion
              ? "Your companion is ready for whatever today allows."
              : "Nothing to catch up on and nothing to make up for. Start wherever today allows."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="flex justify-center">
            <motion.div
              className="relative h-48 w-48"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.94 }}
              animate={showReunion && !prefersReducedMotion
                ? { opacity: 1, scale: [1, 1.04, 1], y: [0, -4, 0] }
                : { opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: showReunion ? 0.8 : 0.25 }}
            >
              {usesPortraitShell ? (
                <CompanionPortraitShell
                  src={imageUrl}
                  element={companion.core_element}
                  className="h-48 w-48 rounded-2xl ring-2 ring-cyan-200/25"
                >
                  {portrait}
                </CompanionPortraitShell>
              ) : portrait}
              {showReunion ? (
                <Sparkles className="absolute -right-3 -top-3 h-7 w-7 text-stardust-gold" aria-hidden="true" />
              ) : null}
            </motion.div>
          </div>

          {showReunion ? (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-stardust-gold/20 bg-stardust-gold/[0.07] p-3 text-center"
            >
              <p className="text-sm font-medium text-foreground">The door was always open.</p>
              <p className="mt-1 text-sm font-semibold text-stardust-gold">
                +{XP_REWARDS.WELCOME_BACK_BONUS} XP for beginning again
              </p>
            </motion.div>
          ) : (
            <Button
              onClick={() => void handleWelcomeBack()}
              className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-stardust-gold to-amber-500 text-black hover:from-stardust-gold/90 hover:to-amber-500/90"
            >
              <Heart className="mr-2 h-5 w-5" aria-hidden="true" />
              Start gently
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
