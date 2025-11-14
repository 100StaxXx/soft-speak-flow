import { Crown, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";

const Premium = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { toast } = useToast();

  const handleSubscribe = () => {
    // Placeholder for Stripe integration
    toast({
      title: "Coming Soon",
      description: "Payment integration will be added here",
    });
  };

  if (profile?.is_premium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-gradient-to-r from-gold-accent to-soft-mauve p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <Crown className="h-12 w-12 text-white" />
          </div>
          <h1 className="font-display text-4xl text-warm-charcoal mb-4">
            You're Premium!
          </h1>
          <p className="text-warm-charcoal/70 mb-8">
            Enjoy unlimited access to all content
          </p>
          <Button
            onClick={() => navigate("/")}
            className="bg-gradient-to-r from-blush-rose to-soft-mauve hover:opacity-90 text-white font-medium px-8 py-6 rounded-3xl shadow-soft"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-r from-gold-accent to-soft-mauve p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <Crown className="h-12 w-12 text-white" />
          </div>
          <h1 className="font-display text-5xl text-warm-charcoal mb-4">
            Unlock Your Full Lil Push Experience
          </h1>
          <p className="text-warm-charcoal/70 text-lg">
            Get unlimited access to everything that lifts you up
          </p>
        </div>

        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-8 shadow-elegant border border-petal-pink/30 mb-8">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blush-rose/20 to-lavender-mist/20 p-3 rounded-2xl flex-shrink-0">
                <Check className="h-6 w-6 text-blush-rose" />
              </div>
              <div>
                <h3 className="font-medium text-warm-charcoal mb-1">
                  Unlimited Pep Talks & Videos
                </h3>
                <p className="text-warm-charcoal/60 text-sm">
                  Access our entire library of motivational content
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blush-rose/20 to-lavender-mist/20 p-3 rounded-2xl flex-shrink-0">
                <Check className="h-6 w-6 text-blush-rose" />
              </div>
              <div>
                <h3 className="font-medium text-warm-charcoal mb-1">
                  Full Quotes & Affirmations Library
                </h3>
                <p className="text-warm-charcoal/60 text-sm">
                  Thousands of quotes to inspire and uplift
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blush-rose/20 to-lavender-mist/20 p-3 rounded-2xl flex-shrink-0">
                <Check className="h-6 w-6 text-blush-rose" />
              </div>
              <div>
                <h3 className="font-medium text-warm-charcoal mb-1">
                  Playlists for Every Mood
                </h3>
                <p className="text-warm-charcoal/60 text-sm">
                  Curated collections for heartbreak, confidence, healing & more
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blush-rose/20 to-lavender-mist/20 p-3 rounded-2xl flex-shrink-0">
                <Check className="h-6 w-6 text-blush-rose" />
              </div>
              <div>
                <h3 className="font-medium text-warm-charcoal mb-1">
                  Daily Reminders & Alarms
                </h3>
                <p className="text-warm-charcoal/60 text-sm">
                  Get gentle pushes when you need them most
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blush-rose/20 to-lavender-mist/20 p-3 rounded-2xl flex-shrink-0">
                <Check className="h-6 w-6 text-blush-rose" />
              </div>
              <div>
                <h3 className="font-medium text-warm-charcoal mb-1">
                  Offline Downloads
                </h3>
                <p className="text-warm-charcoal/60 text-sm">
                  Save content for when you're away from wifi
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-gradient-to-br from-blush-rose/20 to-lavender-mist/20 p-3 rounded-2xl flex-shrink-0">
                <Sparkles className="h-6 w-6 text-blush-rose" />
              </div>
              <div>
                <h3 className="font-medium text-warm-charcoal mb-1">
                  Ad-Free Experience
                </h3>
                <p className="text-warm-charcoal/60 text-sm">
                  Enjoy uninterrupted motivation
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="mb-6">
            <p className="text-warm-charcoal/60 text-sm mb-2">Starting at</p>
            <p className="font-display text-5xl text-warm-charcoal">
              $4.99<span className="text-2xl">/month</span>
            </p>
          </div>

          <Button
            onClick={handleSubscribe}
            className="w-full bg-gradient-to-r from-blush-rose to-soft-mauve hover:opacity-90 text-white font-medium text-lg px-8 py-8 rounded-3xl shadow-elegant mb-4"
          >
            <Crown className="h-5 w-5 mr-2" />
            Start Free Trial
          </Button>

          <p className="text-warm-charcoal/50 text-xs">
            Cancel anytime. No commitments.
          </p>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => navigate(-1)}
            className="text-warm-charcoal/60 hover:text-blush-rose transition-colors text-sm"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default Premium;
