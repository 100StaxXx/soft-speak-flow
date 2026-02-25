import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Sparkles, 
  Rocket, 
  Trophy, 
  Heart, 
  Zap,
  CheckCircle2,
  DollarSign,
  Users,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { StarfieldBackground } from "@/components/StarfieldBackground";

export default function Partners() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    handle: "",
    paypal_email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-influencer-code",
        {
          body: formData,
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Your referral code is ready!");
      const params = new URLSearchParams({ code: data.code });
      if (data.creator_access_token) {
        params.set("token", data.creator_access_token);
      }
      navigate(`/creator/dashboard?${params.toString()}`);
    } catch (error) {
      console.error("Failed to create code:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create referral code"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-nav-safe relative overflow-hidden">
      <StarfieldBackground />
      
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8 animate-pulse">
              <Sparkles className="h-20 w-20 text-primary mx-auto" />
            </div>
            <h1 className="font-heading text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Partner with Cosmiq
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Earn cash rewards when your audience transforms their habits
            </p>
            <div className="flex flex-wrap gap-8 justify-center mb-12 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Growing Community</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>Up to $12 per referral</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Passive Income</span>
              </div>
            </div>
            <Button 
              size="lg" 
              className="text-lg px-8"
              onClick={() => document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Get Your Referral Code
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>

        {/* About Cosmiq */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-center mb-16">
              What is Cosmiq?
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 cosmic-glass text-center">
                <Rocket className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Gamified Growth</h3>
                <p className="text-sm text-muted-foreground">
                  Transform habits into epic quests with XP, achievements, and rewards
                </p>
              </Card>
              <Card className="p-6 cosmic-glass text-center">
                <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Your Companion</h3>
                <p className="text-sm text-muted-foreground">
                  A magical creature that evolves as you complete quests and grow
                </p>
              </Card>
              <Card className="p-6 cosmic-glass text-center">
                <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Cosmiq Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Personalized astrology readings tailored to your zodiac profile
                </p>
              </Card>
              <Card className="p-6 cosmic-glass text-center">
                <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Epic Guilds</h3>
                <p className="text-sm text-muted-foreground">
                  Join shared goals with friends and compete on leaderboards
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4 bg-background/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-center mb-16">
              How It Works
            </h2>
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold">1</span>
                </div>
                <h3 className="font-semibold mb-2">Sign Up</h3>
                <p className="text-sm text-muted-foreground">
                  Get your unique referral code instantly
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold">2</span>
                </div>
                <h3 className="font-semibold mb-2">Share</h3>
                <p className="text-sm text-muted-foreground">
                  Share your code with your audience
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold">3</span>
                </div>
                <h3 className="font-semibold mb-2">Earn</h3>
                <p className="text-sm text-muted-foreground">
                  Get paid when they subscribe
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold">4</span>
                </div>
                <h3 className="font-semibold mb-2">Get Paid</h3>
                <p className="text-sm text-muted-foreground">
                  Receive payouts via PayPal
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Earnings Breakdown */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-center mb-16">
              Earnings Breakdown
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="p-8 cosmic-glass">
                <Zap className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-2">Monthly Subscription</h3>
                <p className="text-4xl font-bold text-primary mb-4">$5</p>
                <p className="text-muted-foreground">50% of first month ($9.99)</p>
              </Card>
              <Card className="p-8 cosmic-glass">
                <Trophy className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-2">Annual Subscription</h3>
                <p className="text-4xl font-bold text-primary mb-4">$12</p>
                <p className="text-muted-foreground">20% of first year ($59.99)</p>
              </Card>
            </div>
            <Card className="p-6 cosmic-glass">
              <h3 className="font-semibold mb-4">Important Details</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Minimum payout:</strong> $50 (accumulate at least $50 before payout eligibility)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Payment method:</strong> PayPal only
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Admin approval:</strong> Payouts require approval before transfer
                  </span>
                </li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Signup Form */}
        <section id="signup-form" className="py-20 px-4">
          <div className="max-w-md mx-auto">
            <Card className="p-8 cosmic-glass">
              <div className="text-center mb-8">
                <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="font-heading text-3xl font-bold mb-2">
                  Get Your Code
                </h2>
                <p className="text-muted-foreground">
                  Start earning rewards today
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <Label htmlFor="handle">Social Handle *</Label>
                  <Input
                    id="handle"
                    value={formData.handle}
                    onChange={(e) =>
                      setFormData({ ...formData, handle: e.target.value })
                    }
                    required
                    placeholder="@yourusername"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your TikTok, Instagram, or other social media handle
                  </p>
                </div>

                <div>
                  <Label htmlFor="paypal_email">PayPal Email *</Label>
                  <Input
                    id="paypal_email"
                    type="email"
                    value={formData.paypal_email}
                    onChange={(e) =>
                      setFormData({ ...formData, paypal_email: e.target.value })
                    }
                    required
                    placeholder="paypal@email.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Where we'll send your payouts
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Get My Referral Code"}
                </Button>
              </form>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-4 bg-background/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-center mb-16">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <Card className="p-6 cosmic-glass">
                <h3 className="font-semibold mb-2">When do I get paid?</h3>
                <p className="text-sm text-muted-foreground">
                  Payouts are processed after reaching the $50 minimum threshold and receiving admin approval. You'll be notified when your payout is ready.
                </p>
              </Card>
              <Card className="p-6 cosmic-glass">
                <h3 className="font-semibold mb-2">How do I track my referrals?</h3>
                <p className="text-sm text-muted-foreground">
                  After signing up, you'll receive a link to your personal dashboard where you can track signups, conversions, and earnings in real-time.
                </p>
              </Card>
              <Card className="p-6 cosmic-glass">
                <h3 className="font-semibold mb-2">Can I change my PayPal email later?</h3>
                <p className="text-sm text-muted-foreground">
                  Contact our support team to update your payout information. Make sure to do this before your payout is processed.
                </p>
              </Card>
              <Card className="p-6 cosmic-glass">
                <h3 className="font-semibold mb-2">Is there a limit to how much I can earn?</h3>
                <p className="text-sm text-muted-foreground">
                  No limits! The more people who subscribe using your code, the more you earn. Top creators are earning hundreds per month.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-border/50">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center gap-6 mb-6 text-sm">
              <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </a>
              <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Cosmiq. Transform your habits into an epic journey.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
