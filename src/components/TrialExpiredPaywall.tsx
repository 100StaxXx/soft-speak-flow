import { useMemo, useState } from "react";
import { Crown, Sparkles, Moon, MessageCircle, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { IAP_PRODUCTS } from "@/utils/appleIAP";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type PlanType = "monthly" | "yearly";

export const TrialExpiredPaywall = () => {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("yearly");
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
  const { toast } = useToast();

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

  const handleSubscribe = async () => {
    if (!selectedProduct) {
      toast({
        title: "Almost ready",
        description: "We're still fetching Apple pricing details. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    const productId = selectedPlan === "yearly" 
      ? IAP_PRODUCTS.YEARLY 
      : IAP_PRODUCTS.MONTHLY;
    await handlePurchase(productId);
  };

  const plans = {
    monthly: {
      fallbackPrice: "$9.99",
      period: "/month",
      savings: null,
    },
    yearly: {
      fallbackPrice: "$59.99",
      period: "/year",
      savings: "Save 50%",
    },
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent shadow-glow">
            <Crown className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl text-foreground">
            Your Free Trial Has Ended
          </h1>
          <p className="text-muted-foreground">
            Subscribe to continue your journey with your companion
          </p>
        </div>

        {/* Plan Toggle */}
        <div className="flex gap-3">
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
              <CardContent className="p-4 text-center">
                <p className="text-sm font-medium text-muted-foreground capitalize mb-1">
                  {plan}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {(plan === "yearly" ? productMap[IAP_PRODUCTS.YEARLY]?.price : productMap[IAP_PRODUCTS.MONTHLY]?.price) ?? plans[plan].fallbackPrice}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plans[plan].period}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features */}
        <div className="space-y-3 py-2">
          {[
            { icon: Sparkles, text: "All 21 evolution stages" },
            { icon: Moon, text: "Daily Cosmiq Insight" },
            { icon: MessageCircle, text: "Unlimited AI Mentor Chat" },
            { icon: Lock, text: "Unlimited Quests & Epics" },
            { icon: Crown, text: "All premium features" },
          ].map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm">
              <feature.icon className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-foreground">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* IAP Notice */}
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
                  description: "Please ensure you're signed in to the App Store and retry.",
                })}
              >
                Contact support
              </Button>
            </div>
          </div>
        )}

        {/* Subscribe Button */}
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
            `Subscribe ${selectedPlan === "yearly" ? "Yearly" : "Monthly"}`
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

        <p className="text-xs text-center text-muted-foreground">
          Processed via Apple • Manage in iOS Settings • Cancel anytime
        </p>
      </div>
    </div>
  );
};
