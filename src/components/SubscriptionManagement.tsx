import { useMemo, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, Settings, Bug, RefreshCw } from "lucide-react";
import { IAP_PRODUCTS } from "@/utils/appleIAP";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

export const SubscriptionManagement = memo(function SubscriptionManagement() {
  const navigate = useNavigate();
  const { subscription, isLoading, isActive, nextBillingDate, planPrice, plan, isCancelled } = useSubscription();
  const {
    handlePurchase,
    handleRestore,
    handleManageSubscriptions,
    loading: purchasing,
    manageLoading,
    isAvailable,
    products,
    productsLoading,
    productError,
    hasLoadedProducts,
    reloadProducts,
  } = useAppleSubscription();

  const [selectedPlan, setSelectedPlan] = useState<PlanOption['id']>('yearly');
  const [debugOpen, setDebugOpen] = useState(false);

  const productMap = useMemo(() => {
    return products.reduce<Record<string, (typeof products)[number]>>((acc, product) => {
      acc[product.identifier] = product;
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

  const subscriptionStatusText = subscription
    ? `You're on Cosmiq Premium (${plan === 'yearly' ? 'Yearly' : 'Monthly'})`
    : "You're on the free plan";

  const statusLabel = subscription
    ? subscription.status === "cancelled"
      ? "Cancelling"
      : subscription.status === "past_due"
        ? "Past due"
        : "Active"
    : "Inactive";

  const renewalText = subscription
    ? nextBillingDate
      ? isCancelled
        ? `Access until ${nextBillingDate.toLocaleDateString()}`
        : `Renews on ${nextBillingDate.toLocaleDateString()}`
      : "Renewal date not available yet"
    : "Manage or restore to update your status";

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

          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground">
            {subscriptionStatusText}
          </div>

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
                <Button size="sm" variant="ghost" onClick={() => navigate("/support/report")}>
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

          {/* Debug Panel */}
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                <Bug className="h-3 w-3 mr-1" />
                {debugOpen ? "Hide Debug Info" : "Show Debug Info"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/60 text-xs font-mono space-y-2">
                <div className="flex justify-between">
                  <span>IAP Available:</span>
                  <span className={isAvailable ? "text-green-500" : "text-red-500"}>
                    {isAvailable ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Products Loading:</span>
                  <span>{productsLoading ? "YES" : "NO"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Has Attempted Fetch:</span>
                  <span>{hasLoadedProducts ? "YES" : "NO"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Products Count:</span>
                  <span className={products.length > 0 ? "text-green-500" : "text-red-500"}>
                    {products.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Error:</span>
                  <span className="text-red-500 truncate max-w-[60%]">
                    {productError || "None"}
                  </span>
                </div>
                <div className="border-t border-border/60 pt-2">
                  <p className="text-muted-foreground mb-1">Expected Product IDs:</p>
                  <p className="break-all">{IAP_PRODUCTS.MONTHLY}</p>
                  <p className="break-all">{IAP_PRODUCTS.YEARLY}</p>
                </div>
                <div className="border-t border-border/60 pt-2">
                  <p className="text-muted-foreground mb-1">Loaded Products:</p>
                  {products.length > 0 ? (
                    products.map((p) => (
                      <div key={p.identifier} className="text-green-500">
                        ✓ {p.identifier}: {p.priceString}
                      </div>
                    ))
                  ) : (
                    <p className="text-red-500">No products loaded</p>
                  )}
                </div>
                <div className="border-t border-border/60 pt-2">
                  <p className="text-muted-foreground mb-1">ProductMap Keys:</p>
                  <p className="break-all">
                    {Object.keys(productMap).length > 0 
                      ? Object.keys(productMap).join(", ") 
                      : "Empty"}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full mt-2"
                  onClick={() => { void reloadProducts(); }}
                  disabled={productsLoading}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${productsLoading ? 'animate-spin' : ''}`} />
                  {productsLoading ? "Loading..." : "Reload Products"}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid gap-4 md:grid-cols-2">
            {planOptions.map((planOption) => {
              const price = getPriceForProduct(planOption.productId);
              const isSelected = selectedPlan === planOption.id;

              const handleSelect = () => setSelectedPlan(planOption.id);

              return (
                <div
                  key={planOption.id}
                  onClick={handleSelect}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleSelect();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect();
                    }
                  }}
                  className={[
                    "rounded-2xl border p-4 flex flex-col gap-3 bg-card/60 backdrop-blur cursor-pointer transition-colors select-none",
                    isSelected ? "border-primary shadow-glow" : "border-border/60 hover:border-primary/40"
                  ].join(" ")}
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                  }}
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

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="w-full sm:flex-1"
              onClick={() => navigate("/premium")}
            >
              View premium details
            </Button>
            <Button
              variant="outline"
              className="w-full sm:flex-1"
              disabled={manageLoading}
              onClick={handleManageSubscriptions}
            >
              {manageLoading ? "Opening..." : "Manage subscription"}
            </Button>
            <Button
              variant="ghost"
              className="w-full sm:flex-1"
              disabled={purchasing}
              onClick={handleRestore}
            >
              {purchasing ? "Restoring..." : "Restore purchases"}
            </Button>
          </div>

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
        <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <p className="font-semibold text-foreground">{subscriptionStatusText}</p>
          <p className="text-sm text-muted-foreground">{renewalText}</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={isActive ? "default" : "secondary"}>
              {statusLabel}
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
              <span className="text-sm text-muted-foreground">{isCancelled ? "Access until" : "Renews on"}</span>
              <span className="font-medium">
                {nextBillingDate.toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={handleManageSubscriptions}
          variant="outline"
          className="w-full"
          disabled={manageLoading}
        >
          <Settings className="mr-2 h-4 w-4" />
          {manageLoading ? "Opening subscriptions..." : "Manage in iOS Settings"}
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
});
