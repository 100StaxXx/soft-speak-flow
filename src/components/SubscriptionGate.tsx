import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanion } from "@/hooks/useCompanion";
import { useSubscription } from "@/hooks/useSubscription";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Lock } from "lucide-react";

export const SubscriptionGate = () => {
  const navigate = useNavigate();
  const { companion } = useCompanion();
  const { isActive } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasShownPaywall, setHasShownPaywall] = useState(false);

  useEffect(() => {
    // Don't show if already subscribed
    if (isActive) {
      setShowPaywall(false);
      return;
    }

    // Show paywall after first evolution (stage 1) - only once per session
    if (companion && companion.current_stage >= 1 && !hasShownPaywall) {
      setShowPaywall(true);
      setHasShownPaywall(true);
    }
  }, [companion, isActive, hasShownPaywall]);

  return (
    <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow animate-pulse">
              <Crown className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Unlock Full Evolution
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Your companion has evolved! Continue their journey with a premium subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Features */}
          <div className="space-y-3">
            {[
              { icon: Sparkles, text: "Continue evolution through all 21 stages" },
              { icon: Crown, text: "Unlock Battle Arena & Pet Mode" },
              { icon: Lock, text: "Full access to Quests, Epics, and Challenges" },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <feature.icon className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Trial Info */}
          <div className="bg-accent/10 rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">
              🎉 7-Day Free Trial
            </p>
            <p className="text-xs text-muted-foreground">
              Then $9.99/month • Full access • Cancel anytime
            </p>
          </div>

          {/* CTA */}
          <Button
            onClick={() => {
              setShowPaywall(false);
              navigate("/premium");
            }}
            className="w-full py-6 text-lg font-bold bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            Start Free Trial →
          </Button>

          <Button
            variant="ghost"
            onClick={() => setShowPaywall(false)}
            className="w-full text-sm text-muted-foreground"
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
