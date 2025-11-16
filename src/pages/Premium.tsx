import { Crown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativePaymentButton } from "@/components/NativePaymentButton";

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
                  <p className="text-steel">Access all pep talks, videos, and quotes</p>
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
                  <p className="font-bold text-pure-white text-lg">Curated Playlists</p>
                  <p className="text-steel">Premium collections for every mood</p>
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

            <NativePaymentButton
              amount={999}
              currency="usd"
              label="Premium Subscription - $9.99"
              onSuccess={() => {
                toast({
                  title: "Welcome to Premium!",
                  description: "Your subscription is now active.",
                });
              }}
            />
            
            <p className="text-xs text-steel text-center mt-2">
              Supports Apple Pay and Google Pay
            </p>
            
            <p className="text-xs text-steel text-center">
              Cancel anytime. No commitments.
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
