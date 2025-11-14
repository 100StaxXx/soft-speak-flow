import { Crown, Infinity, Zap, BookHeart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

const Premium = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { toast } = useToast();

  const handleSubscribe = () => {
    toast({
      title: "Coming Soon",
      description: "Payment integration will be available soon. Contact support for early access.",
    });
  };

  if (profile?.is_premium) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-soft">
            <Crown className="h-12 w-12 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl text-foreground mb-4">
            You're Premium!
          </h1>
          <p className="text-muted-foreground mb-8">
            Enjoy unlimited access to all content
          </p>
          <Button
            onClick={() => navigate("/")}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium px-8 py-6 rounded-3xl shadow-soft"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-3xl w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-soft">
            <Crown className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-4">
            Unlock your full growth experience
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Access unlimited content, all mentors, and personalized guidance for your journey
          </p>
        </div>

        <Card className="max-w-md mx-auto bg-card border-2 border-border shadow-medium mb-12 overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-accent p-6 text-center">
            <h2 className="font-display text-3xl text-primary-foreground mb-2">Premium</h2>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-5xl font-bold text-primary-foreground">$9.99</span>
              <span className="text-primary-foreground/80">/month</span>
            </div>
            <p className="text-primary-foreground/90 mt-2">7-day free trial</p>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-accent/20 p-3 rounded-2xl flex-shrink-0">
                <Infinity className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Unlimited Pep Talks & Videos
                </h3>
                <p className="text-muted-foreground text-sm">
                  Access our entire library of motivational audio and video content
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-accent/20 p-3 rounded-2xl flex-shrink-0">
                <Crown className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  All Mentors Available
                </h3>
                <p className="text-muted-foreground text-sm">
                  Switch between all 5 mentors and find your perfect guide
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-accent/20 p-3 rounded-2xl flex-shrink-0">
                <BookHeart className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Curated Playlists
                </h3>
                <p className="text-muted-foreground text-sm">
                  Access themed playlists for every mood and moment
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-accent/20 p-3 rounded-2xl flex-shrink-0">
                <Zap className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Daily Reminders
                </h3>
                <p className="text-muted-foreground text-sm">
                  Get personalized push notifications to stay motivated
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-accent/20 p-3 rounded-2xl flex-shrink-0">
                <Sparkles className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Offline Access
                </h3>
                <p className="text-muted-foreground text-sm">
                  Download content for motivation anywhere, anytime
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="max-w-md mx-auto space-y-4">
          <Button
            onClick={handleSubscribe}
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold py-6 rounded-3xl shadow-medium text-lg"
          >
            <Crown className="mr-2 h-5 w-5" />
            Start 7-Day Free Trial
          </Button>

          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </Button>
          
          <p className="text-xs text-muted-foreground text-center pt-4">
            Cancel anytime. No commitment required.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Premium;
