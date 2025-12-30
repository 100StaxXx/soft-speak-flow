import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanion } from "@/hooks/useCompanion";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useEvolution } from "@/contexts/EvolutionContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Lock, MessageCircle } from "lucide-react";
import { safeLocalStorage } from "@/utils/storage";

const SUBSCRIPTION_MODAL_LAST_SHOWN_KEY = "subscription_modal_last_shown";

const getTodayDateString = () => new Date().toLocaleDateString('en-CA');

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Your Companion Has Evolved! 🎉
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {isInTrial && trialDaysRemaining > 0 ? (
              <>
                You're enjoying your <span className="font-semibold text-foreground">free trial</span> — {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining!
              </>
            ) : (
              <>
                Enjoy <span className="font-semibold text-foreground">7 days of full access</span> — no credit card required.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Features */}
          <div className="space-y-3">
          {[
            { icon: Sparkles, text: "All 21 evolution stages" },
            { icon: MessageCircle, text: "Unlimited AI Mentor Chat" },
            { icon: Crown, text: "Pet Mode, Guild Stories & all features" },
            { icon: Lock, text: "Unlimited Quests, Epics & Challenges" },
          ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <feature.icon className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-foreground">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Trial Info */}
          <div className="bg-accent/10 rounded-lg p-4 text-center border border-accent/20">
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

          {/* CTA */}
          <Button
            onClick={() => setShowPaywall(false)}
            className="w-full py-6 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {isInTrial && trialDaysRemaining > 0 ? "Continue to App" : "Start My Free Trial"}
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setShowPaywall(false);
              navigate("/premium");
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            View pricing details
          </Button>

          {!isInTrial && (
            <p className="text-xs text-center text-muted-foreground">
              No credit card required. We'll remind you before the trial ends.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
