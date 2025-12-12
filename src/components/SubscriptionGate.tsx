import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCompanion } from "@/hooks/useCompanion";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useEvolution } from "@/contexts/EvolutionContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Lock, Moon, MessageCircle } from "lucide-react";
import { safeLocalStorage } from "@/utils/storage";

const SUBSCRIPTION_MODAL_LAST_SHOWN_KEY = "subscription_modal_last_shown";

const getTodayDateString = () => new Date().toLocaleDateString('en-CA');

export const SubscriptionGate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { companion } = useCompanion();
  const { hasAccess, isInTrial, trialDaysRemaining, loading: accessLoading } = useAccessStatus();
  const { isEvolvingLoading } = useEvolution();
  const [showPaywall, setShowPaywall] = useState(false);
  const todayString = getTodayDateString();
  const [lastShownDate, setLastShownDate] = useState<string | null>(() =>
    safeLocalStorage.getItem(SUBSCRIPTION_MODAL_LAST_SHOWN_KEY)
  );
  const [shouldShowAfterEvolution, setShouldShowAfterEvolution] = useState(false);
  const hasShownToday = lastShownDate === todayString;

  // Don't show paywall during onboarding - it should only be accessible from profile tab
  const isOnboarding = location.pathname === "/onboarding";

  useEffect(() => {
    // Don't show if still loading access status
    if (accessLoading) {
      return;
    }

    // Don't show if on onboarding route
    if (isOnboarding) {
      setShowPaywall(false);
      setShouldShowAfterEvolution(false);
      return;
    }

    // Don't show if already subscribed (not just in trial)
    if (hasAccess && !isInTrial) {
      setShowPaywall(false);
      setShouldShowAfterEvolution(false);
      return;
    }

    // Don't trigger while evolution is in progress - wait for it to complete
    if (isEvolvingLoading) {
      // Queue paywall to show after evolution completes if user is in trial
      if (isInTrial && !hasShownToday) {
        setShouldShowAfterEvolution(true);
      }
      return;
    }

    // Show modal once per day if user is in trial and we haven't shown it today
    if (isInTrial && !hasShownToday) {
      setShowPaywall(true);
      setLastShownDate(todayString);
      safeLocalStorage.setItem(SUBSCRIPTION_MODAL_LAST_SHOWN_KEY, todayString);
    }
  }, [accessLoading, hasAccess, isInTrial, hasShownToday, isEvolvingLoading, todayString, isOnboarding]);

  // Listen for evolution completion
  useEffect(() => {
    // Don't show if on onboarding route
    if (isOnboarding) {
      setShouldShowAfterEvolution(false);
      return;
    }

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
  }, [shouldShowAfterEvolution, isEvolvingLoading, todayString, isOnboarding]);

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
            {isInTrial && trialDaysRemaining > 0 
              ? `Just a friendly reminder ✨`
              : "Welcome to your free trial! ✨"}
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {isInTrial && trialDaysRemaining > 0 ? (
              <>
                You have <span className="font-bold text-lg text-primary">{trialDaysRemaining}</span> day{trialDaysRemaining !== 1 ? 's' : ''} left in your free trial. No pressure — just wanted to let you know!
              </>
            ) : (
              <>
                You have <span className="font-semibold text-foreground">7 days</span> to explore all features — no credit card required.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Features */}
          <div className="space-y-3">
          {[
            { icon: Sparkles, text: "All 21 evolution stages" },
            { icon: Moon, text: "Personalized Daily Cosmiq Insight" },
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
                <p className="text-sm text-foreground mb-1">
                  {trialDaysRemaining === 1 
                    ? "Today's your last day — enjoy it!" 
                    : `Take your time exploring. When you're ready, subscriptions start at $9.99/month.`}
                </p>
                {trialDaysRemaining > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Cancel anytime, no questions asked
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-foreground mb-1">
                  After your trial, subscriptions start at $9.99/month
                </p>
                <p className="text-xs text-muted-foreground">
                  Cancel anytime in iOS Settings
                </p>
              </>
            )}
          </div>

          {/* CTA */}
          <Button
            onClick={() => setShowPaywall(false)}
            className="w-full py-6 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {isInTrial && trialDaysRemaining > 0 ? "Got it, thanks!" : "Start Exploring"}
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setShowPaywall(false);
              navigate("/premium");
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Learn more about premium
          </Button>

          {!isInTrial && (
            <p className="text-xs text-center text-muted-foreground">
              No credit card required. We'll check in with you daily.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
