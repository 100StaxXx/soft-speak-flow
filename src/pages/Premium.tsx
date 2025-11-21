import { Crown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const Premium = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { subscription, isTrialing, trialDaysRemaining } = useSubscription();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (plan: "monthly" | "yearly" = "monthly") => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke("create-subscription-checkout", {
        body: { plan },
      });

      if (error) throw error;

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
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
          <p className="text-muted-foreground mb-4">
            Enjoy unlimited access to all content
          </p>
          {isTrialing && (
            <p className="text-sm text-muted-foreground mb-6 bg-accent/20 p-3 rounded-lg">
              🎉 Free trial • {trialDaysRemaining} days remaining
            </p>
          )}
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/")}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium px-8 py-6 rounded-3xl shadow-soft"
            >
              Back to Home
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/profile")}
              className="w-full"
            >
              Manage Subscription
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16 space-y-6">
          <div className="h-1 w-24 bg-royal-gold mx-auto mb-8" />
          <h1 className="text-6xl font-black text-pure-white uppercase tracking-tight animate-velocity-fade-in">
            Unlock Your Potential
          </h1>
          <p className="text-xl text-steel max-w-2xl mx-auto">
            Get unlimited access to all mentors, exclusive content, and personalized experiences.
          </p>
        </div>

        <Card className="mb-8 bg-graphite border-2 border-royal-gold/30 shadow-glow">
          <CardHeader className="text-center">
            <div className="inline-flex items-center gap-2 bg-royal-gold/10 text-royal-gold px-4 py-2 rounded-lg mx-auto mb-4">
              <Crown className="h-5 w-5" fill="currentColor" />
              <span className="font-black uppercase tracking-wide">Premium</span>
            </div>
            <CardTitle className="text-4xl font-black text-pure-white uppercase">
              Premium Access
            </CardTitle>
            <CardDescription className="text-steel text-xl mt-4">
              $9.99/month • 7-day free trial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded bg-royal-gold/20 flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-royal-gold" strokeWidth={3} />
                </div>
                <div>
                  <p className="font-bold text-pure-white text-lg">Unlimited Content</p>
                  <p className="text-steel">Access all pep talks, lessons, and quotes</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded bg-royal-gold/20 flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-royal-gold" strokeWidth={3} />
                </div>
                <div>
                  <p className="font-bold text-pure-white text-lg">All Mentors</p>
                  <p className="text-steel">Switch between any mentor anytime</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded bg-royal-gold/20 flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-royal-gold" strokeWidth={3} />
                </div>
                <div>
                  <p className="font-bold text-pure-white text-lg">AI Mentor Chat</p>
                  <p className="text-steel">Unlimited conversations with your mentor</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded bg-royal-gold/20 flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-royal-gold" strokeWidth={3} />
                </div>
                <div>
                  <p className="font-bold text-pure-white text-lg">Daily Reminders</p>
                  <p className="text-steel">Custom push notifications for your schedule</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded bg-royal-gold/20 flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-royal-gold" strokeWidth={3} />
                </div>
                <div>
                  <p className="font-bold text-pure-white text-lg">Offline Access</p>
                  <p className="text-steel">Download content for on-the-go motivation</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => handleSubscribe("monthly")}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-royal-gold to-gold-accent hover:opacity-90 text-obsidian font-black uppercase tracking-wide py-7 rounded-2xl shadow-glow transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Start 7-Day Free Trial"
              )}
            </Button>

            <p className="text-xs text-steel text-center mt-4">
              Then $9.99/month • Cancel anytime during trial • No charge until trial ends
            </p>

            <p className="text-xs text-steel text-center">
              Secure payment powered by Stripe
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="text-steel hover:text-pure-white uppercase tracking-wide font-semibold"
          >
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Premium;
