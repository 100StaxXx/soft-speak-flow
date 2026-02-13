import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Crown, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import Confetti from "react-confetti";

export default function PremiumSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useProfile();
  const { refetch: refetchSubscription } = useSubscription();
  const [showConfetti, setShowConfetti] = useState(true);
  const [isVerifying, setIsVerifying] = useState(true);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Refetch profile and subscription to get updated premium status
    const verifySubscription = async () => {
      if (sessionId) {
        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        await refetchSubscription();
      }
      setIsVerifying(false);
    };

    verifySubscription();

    // Stop confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [sessionId, refetchSubscription]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Activating your subscription...</h2>
          <p className="text-muted-foreground text-sm">This will only take a moment</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}

      <Card className="p-8 text-center max-w-md shadow-2xl border-primary/20">
        <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-glow animate-bounce-slow">
          <Crown className="h-12 w-12 text-primary-foreground" />
        </div>

        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />

        <h1 className="font-display text-4xl text-foreground mb-3">
          Welcome to Premium!
        </h1>

        <p className="text-muted-foreground mb-6 text-lg">
          Your subscription is now active
        </p>

        <div className="space-y-3 mb-8 text-left bg-muted/30 rounded-lg p-4">
          <h3 className="font-semibold text-sm text-foreground mb-3">What you get:</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>✓ Unlimited access to all content</p>
            <p>✓ All mentors unlocked</p>
            <p>✓ Unlimited mentor chat</p>
            <p>✓ Offline downloads</p>
            <p>✓ Priority support</p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 rounded-2xl shadow-soft"
          >
            Start Exploring
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
