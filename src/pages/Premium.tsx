import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Crown, Sparkles, Zap, Bell, Download, Check, Moon, RefreshCw, CreditCard } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { IAP_PRODUCTS } from "@/utils/appleIAP";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type PlanType = "monthly" | "yearly";

export default function Premium() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isActive } = useSubscription();
  const { 
    handlePurchase, 
    handleRestore, 
    loading, 
    isAvailable,
    products,
    productsLoading,
    productError,
    reloadProducts,
    hasLoadedProducts,
  } = useAppleSubscription();
  const { isInTrial, trialDaysRemaining } = useTrialStatus();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("yearly");

  const productMap = useMemo(() => {
    return products.reduce<Record<string, (typeof products)[number]>>((acc, product) => {
      acc[product.productId] = product;
      return acc;
    }, {});
  }, [products]);

  const selectedProductId = selectedPlan === "yearly" 
    ? IAP_PRODUCTS.YEARLY 
    : IAP_PRODUCTS.MONTHLY;

  const selectedProduct = productMap[selectedProductId];

  const handleSubscribe = useCallback(async () => {
    if (!selectedProduct) {
      toast({
        title: "Almost ready",
        description: "We're still loading Apple pricing information. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    const productId = selectedPlan === "yearly" 
      ? IAP_PRODUCTS.YEARLY 
      : IAP_PRODUCTS.MONTHLY;
    const success = await handlePurchase(productId);
    if (success) {
      navigate('/premium-success');
    }
  }, [selectedProduct, selectedPlan, handlePurchase, navigate, toast]);

  const plans = useMemo(() => ({
    monthly: {
      fallbackPrice: "$9.99",
      period: "/month",
      savings: null,
      description: "Billed monthly",
    },
    yearly: {
      fallbackPrice: "$59.99",
      period: "/year",
      savings: "Save 50%",
      description: "Just $4.99/month",
    },
  }), []);

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
            {isInTrial ? "Upgrade to Premium" : "Subscribe to Continue"}
          </h1>
          {isInTrial && trialDaysRemaining > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
              <span className="text-sm font-medium text-foreground">
                {trialDaysRemaining === 1 
                  ? "1 day left in your free trial" 
                  : `${trialDaysRemaining} days left in your free trial`}
              </span>
            </div>
          )}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Full access to all features. No commitment.
          </p>
        </div>

        {/* Plan Toggle Cards */}
        <div className="flex gap-4 max-w-md mx-auto">
          {(["monthly", "yearly"] as PlanType[]).map((plan) => (
            <Card
              key={plan}
              onClick={() => setSelectedPlan(plan)}
              className={cn(
                "flex-1 cursor-pointer transition-all relative overflow-hidden",
                selectedPlan === plan
                  ? "border-2 border-primary bg-primary/5 shadow-glow"
                  : "border border-border hover:border-primary/50"
              )}
            >
              {plans[plan].savings && (
                <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded-bl-lg">
                  {plans[plan].savings}
                </div>
              )}
              <CardContent className="p-5 text-center">
                <p className="text-sm font-medium text-muted-foreground capitalize mb-2">
                  {plan}
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {(plan === "yearly" ? productMap[IAP_PRODUCTS.YEARLY]?.price : productMap[IAP_PRODUCTS.MONTHLY]?.price) ?? plans[plan].fallbackPrice}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plans[plan].period}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {plans[plan].description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pricing Card */}
        <Card className="border-2 border-primary/20 shadow-2xl bg-card/80 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-foreground">What's included</CardTitle>
            <CardDescription className="text-base">
              Everything you need for your self-improvement journey
            </CardDescription>
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
                  icon: Moon,
                  title: "Personalized Cosmiq Insight",
                  description: "Daily horoscope with rising sign and planetary transit influences"
                },
                {
                  icon: Crown,
                  title: "Unlimited Quests & Epics",
                  description: "Create unlimited daily quests and join shared epics with friends"
                },
                {
                  icon: Zap,
                  title: "Mentor Chat",
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
                  description: "Pet Mode, Guild Stories, Weekly Challenges, and more"
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

            <Alert className="bg-primary/5 border-primary/30">
              <CreditCard className="h-4 w-4" />
              <AlertTitle>Billing clarity</AlertTitle>
              <AlertDescription>
                Cosmiq uses Apple&apos;s native subscription sheet (StoreKit) when you tap Subscribe. There is no separate Apple Pay button—PassKit is only bundled because the Capgo Native Purchases plugin links it. You can manage or cancel anytime in Settings ▸ {`[Your Name]`} ▸ Subscriptions.
              </AlertDescription>
            </Alert>

            {/* Apple IAP Notice */}
            {!isAvailable && (
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground text-center">
                  In-App Purchases are only available on iOS devices
                </p>
              </div>
            )}

            {productsLoading && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-muted-foreground" />
                Contacting the App Store...
              </div>
            )}

            {productError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex flex-col gap-2">
                <span>{productError}</span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { void reloadProducts(); }}>
                    Try Again
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toast({
                      title: "Need help?",
                      description: "Please ensure you're signed in to the App Store and connected to the internet.",
                    })}
                  >
                    Contact support
                  </Button>
                </div>
              </div>
            )}

            {/* CTA Button */}
            <Button
              onClick={handleSubscribe}
              disabled={
                loading || 
                !isAvailable || 
                productsLoading || 
                !hasLoadedProducts ||
                !selectedProduct
              }
              className="w-full py-7 text-lg font-black uppercase tracking-wider bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground shadow-glow"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-2" />
                  Processing...
                </>
              ) : (
                `Subscribe ${selectedPlan === "yearly" ? "Yearly" : "Monthly"} - ${(selectedProduct?.price ?? plans[selectedPlan].fallbackPrice)}${selectedPlan === "yearly" ? " /year" : " /month"}`
              )}
            </Button>

            {/* Restore Purchases */}
            <Button
              variant="ghost"
              onClick={handleRestore}
              disabled={loading}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Restore Purchases
            </Button>

            <p className="text-xs text-center text-muted-foreground leading-relaxed">
              Payment will be charged to your Apple ID account at confirmation of purchase.
              Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
              Your account will be charged for renewal within 24 hours prior to the end of the current period.
              You can manage and cancel your subscriptions by going to Settings {">"} [Your Name] {">"} Subscriptions after purchase.
            </p>
            <div className="flex justify-center gap-4 text-xs">
              <a href="/privacy" className="text-muted-foreground underline hover:text-foreground">Privacy Policy</a>
              <a href="/terms" className="text-muted-foreground underline hover:text-foreground">Terms of Use</a>
            </div>
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
