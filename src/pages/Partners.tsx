import { ArrowRight, CheckCircle2, DollarSign, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { toast } from "@/components/ui/sonner";

const toltPartnerPortalUrl = import.meta.env.VITE_TOLT_PARTNER_PORTAL_URL as string | undefined;

export default function Partners() {
  const openPortal = () => {
    if (!toltPartnerPortalUrl) {
      toast.error("Partner portal is not configured yet. Please add VITE_TOLT_PARTNER_PORTAL_URL.");
      return;
    }

    window.location.href = toltPartnerPortalUrl;
  };

  return (
    <div className="min-h-screen pb-nav-safe relative overflow-hidden">
      <StarfieldBackground />

      <div className="relative z-10">
        <section className="min-h-screen flex items-center justify-center px-4 py-20">
          <div className="max-w-5xl mx-auto text-center">
            <div className="mb-8 animate-pulse">
              <Sparkles className="h-20 w-20 text-primary mx-auto" />
            </div>
            <h1 className="font-heading text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Partner with Cosmiq
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Share your creator code, unlock the discounted annual offer for your audience, and earn 20% on the first yearly subscription.
            </p>

            <div className="flex flex-wrap gap-8 justify-center mb-12 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Affiliate portal powered by Tolt</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>20% of discounted yearly revenue only</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="text-lg px-8" onClick={openPortal}>
                Apply To The Partner Program
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" onClick={openPortal}>
                Open Partner Portal
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
            <Card className="p-8 cosmic-glass">
              <h2 className="font-heading text-2xl font-bold mb-4">1. Join Through Tolt</h2>
              <p className="text-sm text-muted-foreground">
                Creators now apply and manage their partnership through the Tolt portal instead of the legacy in-app signup form.
              </p>
            </Card>
            <Card className="p-8 cosmic-glass">
              <h2 className="font-heading text-2xl font-bold mb-4">2. Share Your Code</h2>
              <p className="text-sm text-muted-foreground">
                Your partner record syncs back to Cosmiq and creates a local <code>?ref=CODE</code> link that unlocks the discounted annual offer.
              </p>
            </Card>
            <Card className="p-8 cosmic-glass">
              <h2 className="font-heading text-2xl font-bold mb-4">3. Earn On Yearly Only</h2>
              <p className="text-sm text-muted-foreground">
                Monthly subscriptions do not earn commission. Partners receive 20% of the discounted yearly purchase amount when Apple confirms the first paid annual subscription.
              </p>
            </Card>
          </div>
        </section>

        <section className="py-20 px-4 bg-background/30">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-center">
              What Partners Need To Know
            </h2>

            <Card className="p-6 cosmic-glass">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Creator onboarding, reporting, and payouts now run through Tolt.
                </p>
              </div>
            </Card>

            <Card className="p-6 cosmic-glass">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Audience members still enter a referral code inside Cosmiq and then purchase through Apple’s in-app purchase flow.
                </p>
              </div>
            </Card>

            <Card className="p-6 cosmic-glass">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Eligible commission is created only after Apple confirms the first yearly purchase at the discounted promotional-offer price.
                </p>
              </div>
            </Card>
          </div>
        </section>

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
              © 2026 Cosmiq. Transform your habits into an epic journey.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
