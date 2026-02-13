import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanion } from "@/hooks/useCompanion";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useEvolution } from "@/contexts/EvolutionContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Lock, MessageCircle } from "lucide-react";
import { safeLocalStorage } from "@/utils/storage";
import { motion } from "framer-motion";

const SUBSCRIPTION_MODAL_LAST_SHOWN_KEY = "subscription_modal_last_shown";

const getTodayDateString = () => new Date().toLocaleDateString('en-CA');

const features = [
  { icon: Sparkles, text: "All 21 evolution stages" },
  { icon: MessageCircle, text: "Unlimited mentor chat" },
  { icon: Crown, text: "Pet Mode, Guild Stories & all features" },
  { icon: Lock, text: "Unlimited Quests, Epics & Challenges" },
];

export const SubscriptionGate = () => {
  const navigate = useNavigate();
  const { companion } = useCompanion();
  const { hasAccess, isInTrial, trialDaysRemaining } = useAccessStatus();
  const { isEvolvingLoading } = useEvolution();
  const [showPaywall, setShowPaywall] = useState(false);
  const todayString = getTodayDateString();
  const [lastShownDate, setLastShownDate] = useState<string | null>(() =>
    safeLocalStorage.getItem(SUBSCRIPTION_MODAL_LAST_SHOWN_KEY)
  );
  const [shouldShowAfterEvolution, setShouldShowAfterEvolution] = useState(false);
  const hasShownToday = lastShownDate === todayString;

  useEffect(() => {
    // Don't show if already subscribed (not just in trial)
    if (hasAccess && !isInTrial) {
      setShowPaywall(false);
      setShouldShowAfterEvolution(false);
      return;
    }

    // Don't trigger while evolution is in progress - wait for it to complete
    if (isEvolvingLoading) {
      // Queue paywall to show after evolution completes if companion is at stage 1+
      if (companion && companion.current_stage >= 1 && !hasShownToday) {
        setShouldShowAfterEvolution(true);
      }
      return;
    }

    // Show modal if companion is at stage 1+ and we haven't shown it yet
    if (companion && companion.current_stage >= 1 && !hasShownToday) {
      setShowPaywall(true);
      setLastShownDate(todayString);
      safeLocalStorage.setItem(SUBSCRIPTION_MODAL_LAST_SHOWN_KEY, todayString);
    }
  }, [companion, hasAccess, isInTrial, hasShownToday, isEvolvingLoading, todayString]);

  // Listen for evolution completion
  useEffect(() => {
    if (shouldShowAfterEvolution && !isEvolvingLoading) {
      // Small delay to let evolution modal fully dismiss
      const timer = setTimeout(() => {
        setShowPaywall(true);
        setLastShownDate(todayString);
        safeLocalStorage.setItem(SUBSCRIPTION_MODAL_LAST_SHOWN_KEY, todayString);
        setShouldShowAfterEvolution(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [shouldShowAfterEvolution, isEvolvingLoading, todayString]);

  return (
    <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
      <DialogContent 
        className="max-w-sm rounded-3xl bg-background/80 backdrop-blur-2xl border-white/10 shadow-2xl shadow-black/20 p-0 overflow-hidden"
        hideCloseButton
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            type: "spring", 
            damping: 25, 
            stiffness: 300 
          }}
        >
          {/* Hero section with centered icon */}
          <div className="pt-8 pb-4 flex flex-col items-center">
            {/* Soft glow behind icon */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", damping: 15 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-white/10 shadow-lg">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
            </motion.div>
            
            {/* Title with clean typography */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-5 text-xl font-semibold tracking-tight text-foreground text-center"
            >
              Your companion has evolved! 🎉
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-sm text-muted-foreground text-center px-6 leading-relaxed"
            >
              {isInTrial && trialDaysRemaining > 0 ? (
                <>
                  You're enjoying your <span className="font-semibold text-foreground">free trial</span> — {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining!
                </>
              ) : (
                <>
                  Enjoy <span className="font-semibold text-foreground">7 days of full access</span> — no credit card required.
                </>
              )}
            </motion.p>
          </div>

          {/* Feature list (iOS Settings-style) */}
          <div className="px-5 pb-4">
            <div className="rounded-2xl bg-card/50 backdrop-blur-sm divide-y divide-border/30 overflow-hidden">
              {features.map((feature, i) => {
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

          {/* Trial Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="px-5 pb-4"
          >
            <div className="rounded-2xl bg-accent/10 backdrop-blur-sm p-4 text-center border border-accent/20">
              {isInTrial && trialDaysRemaining > 0 ? (
                <>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Your free trial is active
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Subscribe anytime: $9.99/month or $59.99/year • Cancel anytime
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    After your free trial
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Just $9.99/month or $59.99/year • Cancel anytime in iOS Settings
                  </p>
                </>
              )}
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <div className="px-5 pb-6 pt-1 space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Button 
                onClick={() => setShowPaywall(false)}
                className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 font-medium text-base shadow-lg shadow-primary/25 transition-all duration-200 active:scale-[0.98]"
              >
                {isInTrial && trialDaysRemaining > 0 ? "Continue to app" : "Start my free trial"}
              </Button>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPaywall(false);
                  navigate("/premium");
                }}
                className="w-full h-10 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                View pricing details
              </Button>
            </motion.div>

            {!isInTrial && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="text-xs text-center text-muted-foreground pt-1"
              >
                No credit card required. We'll remind you before the trial ends.
              </motion.p>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
