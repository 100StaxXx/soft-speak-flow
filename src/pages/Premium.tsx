import { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Crown, Sparkles, Zap, Bell, Download, Check, Moon, RefreshCw, CreditCard, TicketPercent } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { getProductForPlan, getPurchaseProductIdForPlan, type IAPPlan } from "@/utils/appleIAP";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import paywallSubscriptionBackground from "@/assets/backgrounds/paywall-subscription.jpg";
import { trackPaywallEvent } from "@/utils/paywallTelemetry";

type PlanType = IAPPlan;

const PLAN_ORDER: PlanType[] = ["monthly", "yearly"];

export default function Premium() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isActive } = useSubscription();
  const {
    handlePurchase,
    handleRestore,
    handleManageSubscriptions,
    loading,
    isAvailable,
    products,
    productsLoading,
    productError,
    reloadProducts,
    hasReferralPricing,
  } = useAppleSubscription();
  const { isInTrial, trialDaysRemaining } = useTrialStatus();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("yearly");

  const selectedProduct = useMemo(
    () => getProductForPlan(selectedPlan, products, { preferReferral: hasReferralPricing }),
    [hasReferralPricing, products, selectedPlan],
  );
  const selectedProductId = useMemo(
    () => getPurchaseProductIdForPlan(selectedPlan, products, { preferReferral: hasReferralPricing }),
    [hasReferralPricing, selectedPlan, products],
  );

  useEffect(() => {
    trackPaywallEvent("paywall_viewed", {
      surface: "premium",
      hasReferralPricing,
      isInTrial,
      selectedPlan,
      selectedProductId,
    });
  }, [hasReferralPricing, isInTrial, selectedPlan, selectedProductId]);

  const handleSubscribe = useCallback(async () => {
    if (!selectedProduct) {
      toast({
        title: "Almost ready",
        description: "We’re still loading RevenueCat pricing information. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    trackPaywallEvent("package_selected", {
      surface: "premium",
      plan: selectedPlan,
      productId: selectedProductId,
      hasReferralPricing,
    });
    const success = await handlePurchase(selectedProductId, "premium");
    if (success) {
      navigate("/premium/success");
    }
  }, [handlePurchase, navigate, selectedProduct, selectedProductId, toast]);

  const plans = useMemo<Record<PlanType, { fallbackPrice: string; period: string; savings: string | null; description: string }>>(() => ({
    monthly: {
      fallbackPrice: "$9.99",
      period: "/month",
      savings: null,
      description: "Flexible monthly billing",
    },
    yearly: {
      fallbackPrice: hasReferralPricing ? "$69.99" : "$99.99",
      period: "/year",
      savings: hasReferralPricing ? "Referral price" : "Best value",
      description: hasReferralPricing ? "Referral unlock annual price" : "Lower effective monthly price",
    },
  }), [hasReferralPricing]);

  if (isActive) {
    return (
      <div className="min-h-screen pb-nav-safe bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center shadow-glow">
            <Crown className="h-12 w-12 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl text-foreground mb-4">You’re Pro!</h1>
          <p className="text-muted-foreground mb-4">
            Cosmiq Pro is active, so you have full access to premium guidance, companions, and quests.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/")}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium px-8 py-6 rounded-3xl shadow-soft"
            >
              Back to Home
            </Button>
            <Button variant="ghost" onClick={handleManageSubscriptions} className="w-full">
              Manage Subscription
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-nav-safe p-6 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${paywallSubscriptionBackground})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-background/65 to-background/95" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_38%)]" aria-hidden="true" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/90 to-accent/90 mb-4 shadow-glow animate-pulse backdrop-blur-sm">
            <Crown className="h-10 w-10 text-primary-foreground" />
          </div>
          <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Step 2 of 2</p>
          <h1 className="font-display text-5xl text-foreground">
            {isInTrial ? "Choose Your Cosmiq Pro Plan" : "Finish Unlocking Cosmiq Pro"}
          </h1>
          {isInTrial && trialDaysRemaining > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
              <span className="text-sm font-medium text-foreground">
                {trialDaysRemaining === 1 ? "1 day left in your free trial" : `${trialDaysRemaining} days left in your free trial`}
              </span>
            </div>
          )}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your referral step is complete. Choose the plan that fits your rhythm and finish checkout here.
          </p>
          {hasReferralPricing && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
              <TicketPercent className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-foreground">Referral pricing unlocked: annual is $69.99/year</span>
            </div>
          )}
        </div>

        <div className="grid gap-4 max-w-3xl mx-auto md:grid-cols-2">
          {PLAN_ORDER.map((plan) => {
            const product = getProductForPlan(plan, products, { preferReferral: hasReferralPricing });
            const isSelected = selectedPlan === plan;
            const Icon = plan === "yearly" && hasReferralPricing ? TicketPercent : Crown;

            return (
              <Card
                key={plan}
                onClick={() => {
                  setSelectedPlan(plan);
                  trackPaywallEvent("package_selected", {
                    surface: "premium",
                    plan,
                    productId: product?.identifier ?? plan,
                    hasReferralPricing,
                  });
                }}
                className={cn(
                  "cursor-pointer transition-all relative overflow-hidden",
                  isSelected
                    ? "border-2 border-primary bg-primary/5 shadow-glow"
                    : "border border-border hover:border-primary/50",
                )}
              >
                {plans[plan].savings && (
                  <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded-bl-lg">
                    {plans[plan].savings}
                  </div>
                )}
                <CardContent className="p-5 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground capitalize mb-2">{plan}</p>
                  <p className="text-3xl font-bold text-foreground">
                    {product?.priceString ?? plans[plan].fallbackPrice}
                  </p>
                  <p className="text-sm text-muted-foreground">{plans[plan].period}</p>
                  <p className="text-xs text-muted-foreground mt-1">{plans[plan].description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-2 border-primary/20 shadow-2xl bg-card/72 backdrop-blur-md">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-foreground">What’s included</CardTitle>
            <CardDescription className="text-base">
              Everything you need for your self-improvement journey
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              {[
                { icon: Sparkles, title: "Full Companion Evolution", description: "Watch your companion grow all the way to Ascended." },
                { icon: Moon, title: "Personalized Cosmiq Insight", description: "Daily astrology guidance tuned to your chart." },
                { icon: Crown, title: "Unlimited Quests & Epics", description: "Create more structure, rituals, and big goals." },
                { icon: Zap, title: "Guide Chat", description: "Unlimited personalized guidance from your chosen guide." },
                { icon: Bell, title: "Smart Quest Reminders", description: "Stay on track with timely nudges." },
                { icon: Download, title: "All Premium Features", description: "New stories, companion perks, and future unlocks." },
              ].map((feature, index) => (
                <div key={index} className="flex items-start gap-3 group hover:bg-primary/5 p-3 rounded-lg transition-colors">
                  <div className="mt-1 p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                  <Check className="h-5 w-5 text-primary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>

            <Alert className="bg-primary/5 border-primary/30">
              <CreditCard className="h-4 w-4" />
              <AlertTitle>Billing clarity</AlertTitle>
              <AlertDescription>
                RevenueCat handles plans, entitlements, paywalls, and Customer Center, while Apple still handles the actual billing sheet and renewal management.
              </AlertDescription>
            </Alert>

            {!isAvailable && (
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground text-center">
                  In-app purchases are only available inside the native iOS Cosmiq app.
                </p>
              </div>
            )}

            {productsLoading && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-muted-foreground" />
                Loading RevenueCat offering...
              </div>
            )}

            {productError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex flex-col gap-2">
                <span>{productError}</span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { void reloadProducts(); }}>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            <Button
              onClick={() => { void handleSubscribe(); }}
              disabled={!isAvailable || loading || productsLoading || !selectedProduct}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 rounded-2xl shadow-soft"
            >
              {loading ? "Processing..." : `Continue with ${selectedPlan}`}
            </Button>

            <div className="grid gap-3 md:grid-cols-2">
              <Button variant="outline" onClick={() => { void handleRestore("premium"); }}>
                Restore Purchases
              </Button>
              <Button variant="ghost" onClick={() => { void handleManageSubscriptions(); }}>
                Open Customer Center
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
