import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from '@capacitor/core';
import { IAP_PRODUCTS } from "@/utils/appleIAP";

type PlanOption = {
  id: 'monthly' | 'yearly';
  label: string;
  productId: string;
  description: string;
  hint: string;
  fallbackPrice: string;
  billingPeriodLabel: string;
  badge?: string;
};

export function SubscriptionManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscription, isLoading, isActive, nextBillingDate, planPrice, plan } = useSubscription();
  const { 
    handlePurchase, 
    handleRestore, 
    loading: purchasing, 
    isAvailable,
    products,
    productsLoading,
    productError,
    hasLoadedProducts,
    reloadProducts,
  } = useAppleSubscription();

  const [selectedPlan, setSelectedPlan] = useState<PlanOption['id']>('yearly');

  const productMap = useMemo(() => {
    return products.reduce<Record<string, (typeof products)[number]>>((acc, product) => {
      acc[product.productId] = product;
      return acc;
    }, {});
  }, [products]);

  const planOptions: PlanOption[] = [
    {
      id: 'monthly',
      label: 'Monthly',
      productId: IAP_PRODUCTS.MONTHLY,
      description: 'Full access billed every month',
      hint: 'Cancel anytime',
      fallbackPrice: "$9.99",
      billingPeriodLabel: '/month',
    },
    {
      id: 'yearly',
      label: 'Yearly',
      productId: IAP_PRODUCTS.YEARLY,
      description: 'Best value with 7-day trial',
      hint: 'Equivalent to $4.99/month',
      fallbackPrice: "$59.99",
      billingPeriodLabel: '/year',
      badge: 'Most popular',
    },
  ] as const;

  const selectedPlanOption = planOptions.find((plan) => plan.id === selectedPlan);
  const selectedProduct = selectedPlanOption ? productMap[selectedPlanOption.productId] : undefined;

  const getPriceForProduct = (productId: string) => {
    const product = productMap[productId];
    if (product?.price) {
      return product.price;
    }
    return productId === IAP_PRODUCTS.YEARLY ? "$59.99" : "$9.99";
  };

  const canPurchasePlan = (productId: string) => {
    if (!isAvailable || purchasing || productsLoading) return false;
    if (productError) return false;
    if (!hasLoadedProducts) return false;
    return Boolean(productMap[productId]);
  };

  const handleManageSubscription = async () => {
    if (Capacitor.isNativePlatform()) {
      // On iOS, direct users to Settings
      toast({
        title: "Manage Subscription",
        description: "Open Settings > [Your Name] > Subscriptions to manage your Cosmiq subscription",
      });
    } else {
      toast({
        title: "iOS Only",
        description: "Subscription management is only available on iOS devices",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Go Premium
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <CardDescription className="text-base">
            Unlock all quests, mentor chat, Cosmiq Insights, and every future feature across iPhone and iPad.
          </CardDescription>

          {productsLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
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
                <Button size="sm" variant="ghost" onClick={() => toast({
                  title: "Need help?",
                  description: "Please ensure you're signed in to the App Store and try again.",
                })}>
                  Need help?
                </Button>
              </div>
            </div>
          )}

          {!isAvailable && (
            <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground text-center">
              In-App Purchases are only available on iOS devices
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {planOptions.map((planOption) => {
              const price = getPriceForProduct(planOption.productId);
              const isSelected = selectedPlan === planOption.id;

              return (
                <div
                  key={planOption.id}
                  onClick={() => setSelectedPlan(planOption.id)}
                  className={[
                    "rounded-2xl border p-4 flex flex-col gap-3 bg-card/60 backdrop-blur cursor-pointer transition-colors",
                    isSelected ? "border-primary shadow-glow" : "border-border/60 hover:border-primary/40"
                  ].join(" ")}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm uppercase tracking-wide text-muted-foreground">
                        {planOption.label}
                      </p>
                      {planOption.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {planOption.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-semibold text-foreground mt-1">
                      {price}
                      <span className="text-sm font-normal text-muted-foreground">
                        {planOption.billingPeriodLabel}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {planOption.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {planOption.hint}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => selectedPlanOption && handlePurchase(selectedPlanOption.productId)}
            disabled={
              !isAvailable ||
              !selectedPlanOption ||
              !canPurchasePlan(selectedPlanOption.productId)
            }
            className="w-full"
          >
            {(!isAvailable && "Available on iOS only") ||
              (purchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Subscribe ${selectedPlanOption?.label ?? ''} • ${selectedProduct?.price ?? selectedPlanOption?.fallbackPrice}${selectedPlanOption?.billingPeriodLabel}`
              ))}
          </Button>
          
          {!isAvailable && (
            <p className="text-xs text-muted-foreground text-center">
              Purchases must be completed inside the Cosmiq iOS app. Open the iOS app to subscribe.
            </p>
          )}

          <div className="space-y-2">
            {[
              "All 21 companion evolutions",
              "Unlimited quests, epics, and mentor chat",
              "Daily Cosmiq Insight across iPhone + iPad",
              "Early access to new companions & stories",
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="h-4 w-4 text-primary" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate("/premium")}
            >
              View premium details
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={purchasing}
              onClick={handleRestore}
            >
              {purchasing ? "Restoring..." : "Restore purchases"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Subscription Details
        </CardTitle>
        <CardDescription>
          Manage your Cosmiq Premium subscription
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          {plan && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="font-medium capitalize">{plan}</span>
            </div>
          )}

          {planPrice && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="font-medium">{planPrice}</span>
            </div>
          )}

          {nextBillingDate && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Renews On</span>
              <span className="font-medium">
                {nextBillingDate.toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={handleManageSubscription}
          variant="outline"
          className="w-full"
        >
          <Settings className="mr-2 h-4 w-4" />
          Manage in iOS Settings
        </Button>
        <Button
          onClick={handleRestore}
          disabled={purchasing}
          variant="ghost"
          className="w-full"
        >
          {purchasing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Restoring...
            </>
          ) : (
            "Restore Purchases"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
