import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Crown, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import Confetti from "react-confetti";
import { PREMIUM_BENEFITS } from "@/config/premiumBenefits";

const CHECKOUT_SESSION_WEBHOOK_DELAY_MS = 2000;
const ACTIVATION_RETRY_DELAYS_MS = [0, 1000, 2000, 4000] as const;

export default function PremiumSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    refetch: refetchSubscription,
    isActive,
    isLoading,
  } = useSubscription();
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasCheckedActivation, setHasCheckedActivation] = useState(false);
  const [activationTimedOut, setActivationTimedOut] = useState(false);
  const activeRef = useRef(isActive);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    activeRef.current = isActive;
    if (isActive) {
      setActivationTimedOut(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [isActive]);

  const checkActivation = useCallback(async () => {
    setActivationTimedOut(false);
    await refetchSubscription();
    setHasCheckedActivation(true);
    if (!activeRef.current) {
      setActivationTimedOut(true);
    }
  }, [refetchSubscription]);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const wait = (delayMs: number) => new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delayMs);
      timers.push(timer);
    });

    const verifySubscription = async () => {
      setHasCheckedActivation(false);
      setActivationTimedOut(false);

      if (sessionId) {
        await wait(CHECKOUT_SESSION_WEBHOOK_DELAY_MS);
      }

      for (const delayMs of ACTIVATION_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
          await wait(delayMs);
        }
        if (cancelled || activeRef.current) return;

        await refetchSubscription();
        if (cancelled || activeRef.current) return;

        setHasCheckedActivation(true);
      }

      if (!cancelled && !activeRef.current) {
        setActivationTimedOut(true);
      }
    };

    void verifySubscription();

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [sessionId, refetchSubscription]);

  if (!isActive && (!activationTimedOut || isLoading || !hasCheckedActivation)) {
    return (
      <div className="min-h-screen pb-nav-safe bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Activating your subscription...</h2>
          <p className="text-muted-foreground text-sm">This will only take a moment</p>
        </Card>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen pb-nav-safe bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Still activating your subscription</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Apple completed checkout, but your access is still syncing.
          </p>

          <div className="space-y-3">
            <Button onClick={checkActivation} className="w-full">
              Check Again
            </Button>
            <Button variant="outline" onClick={() => navigate("/profile")} className="w-full">
              View Subscription Details
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav-safe bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

      <Card className="p-8 text-center max-w-md shadow-2xl border-primary/20">
        <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-glow animate-bounce-slow">
          <Crown className="h-12 w-12 text-primary-foreground" />
        </div>

        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />

        <h1 className="font-display text-4xl text-foreground mb-3">
          Welcome to Graceward Plus!
        </h1>

        <p className="text-muted-foreground mb-6 text-lg">
          Your subscription is now active
        </p>

        <div className="space-y-3 mb-8 text-left bg-muted/30 rounded-lg p-4">
          <h3 className="font-semibold text-sm text-foreground mb-3">What you get:</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            {PREMIUM_BENEFITS.map((benefit) => (
              <p key={benefit}>✓ {benefit}</p>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 rounded-2xl shadow-soft"
          >
            Return to Today
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate("/profile")}
            className="w-full"
          >
            View Subscription Details
          </Button>
        </div>
      </Card>
    </div>
  );
}
