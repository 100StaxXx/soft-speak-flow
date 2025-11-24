import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Sparkles, Zap, Bell, Download, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

export default function Premium() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isActive, isTrialing, trialDaysRemaining } = useSubscription();
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout');

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setSubscribing(false);
    }
  };

  // Show premium user view
  if (isActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-glow">
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mb-4 shadow-glow animate-pulse">
            <Crown className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-5xl text-foreground">
            Start Your Free Trial
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            7 days free, then $9.99/month. Full access from day one.
          </p>
        </div>

        {/* Pricing Card */}
        <Card className="border-2 border-primary/20 shadow-2xl bg-card/80 backdrop-blur">
          <CardHeader className="text-center pb-8">
            <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-accent/20 text-accent font-semibold text-sm mb-4 mx-auto">
              🎉 7-Day Free Trial
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold text-foreground">R-Evolution Premium</CardTitle>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold text-foreground">$9.99</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </div>
              <CardDescription className="text-base">
                After 7-day free trial • Cancel anytime
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Features List */}
            <div className="space-y-4">
              {[
                {
                  icon: Sparkles,
                  title: "Full Companion Evolution",
                  description: "Watch your companion grow through all 21 evolution stages"
                },
                {
                  icon: Crown,
                  title: "Unlimited Quests & Epics",
                  description: "Create unlimited daily quests and join shared epics with friends"
                },
                {
                  icon: Zap,
                  title: "AI Mentor Chat",
                  description: "Unlimited personalized guidance from your chosen mentor"
                },
                {
                  icon: Bell,
                  title: "Smart Quest Reminders",
                  description: "Never miss a quest with intelligent notifications"
                },
                {
                  icon: Download,
                  title: "All Premium Features",
                  description: "Battle Arena, Pet Mode, Weekly Challenges, and more"
                }
              ].map((feature, index) => (
                <div key={index} className="flex items-start gap-3 group hover:bg-primary/5 p-3 rounded-lg transition-colors">
                  <div className="mt-1 p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  <Check className="h-5 w-5 text-primary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>

            {/* Trial Terms */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">How it works:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Start your 7-day free trial with full access</li>
                <li>✓ Payment method required (you won't be charged during trial)</li>
                <li>✓ After 7 days, you'll be charged $9.99/month</li>
                <li>✓ Cancel anytime during trial - no charge</li>
              </ul>
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full py-7 text-lg font-black uppercase tracking-wider bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground shadow-glow"
              size="lg"
            >
              {subscribing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-2" />
                  Opening Checkout...
                </>
              ) : (
                "Start 7-Day Free Trial →"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Secure payment • Cancel anytime • No hidden fees
            </p>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}
