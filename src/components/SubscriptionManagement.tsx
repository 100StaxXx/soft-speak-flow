import { useMemo, useState, memo } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { getProductForPlan, getPurchaseProductIdForPlan, type IAPPlan } from "@/utils/appleIAP";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, RefreshCw, Settings } from "lucide-react";

type PlanOption = {
  id: IAPPlan;
  label: string;
  description: string;
  hint: string;
  fallbackPrice: string;
  billingPeriodLabel: string;
  badge?: string;
};

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "monthly",
    label: "Monthly",
    description: "Full access billed every month",
    hint: "Flexible billing",
    fallbackPrice: "$9.99",
    billingPeriodLabel: "/month",
  },
  {
    id: "yearly",
    label: "Yearly",
    description: "Best recurring value",
    hint: "Lower effective monthly price",
    fallbackPrice: "$99.99",
    billingPeriodLabel: "/year",
    badge: "Most popular",
  },
];

export const SubscriptionManagement = memo(function SubscriptionManagement() {
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
    reloadProducts,
  } = useAppleSubscription();

  const [selectedPlan, setSelectedPlan] = useState<IAPPlan>("yearly");
  const selectedProduct = getProductForPlan(selectedPlan, products);
  const selectedProductId = getPurchaseProductIdForPlan(selectedPlan, products);

  const subscriptionStatusText = subscription
    ? `You have Cosmiq Pro (${plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Active"})`
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
    : "Upgrade to unlock Cosmiq Pro";

  const priceByPlan = useMemo(() => {
    return PLAN_OPTIONS.reduce<Record<string, string>>((acc, option) => {
      acc[option.id] = getProductForPlan(option.id, products)?.displayPrice ?? option.fallbackPrice;
      return acc;
    }, {});
  }, [products]);

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
            Unlock Cosmiq Pro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground">
            {subscriptionStatusText}
          </div>

          {productsLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading products...
            </div>
          )}

          {productError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex flex-col gap-2">
              <span>{productError}</span>
              <Button size="sm" variant="outline" onClick={() => { void reloadProducts(); }}>
                <RefreshCw className="mr-2 h-3 w-3" />
                Try Again
              </Button>
            </div>
          )}

          {!isAvailable && (
            <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground text-center">
              In-app purchases are only available on iOS devices
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {PLAN_OPTIONS.map((planOption) => {
              const isSelected = selectedPlan === planOption.id;

              return (
                <button
                  key={planOption.id}
                  type="button"
                  onClick={() => setSelectedPlan(planOption.id)}
                  className={[
                    "rounded-2xl border p-4 flex flex-col gap-3 bg-card/60 backdrop-blur text-left transition-colors",
                    isSelected ? "border-primary shadow-glow" : "border-border/60 hover:border-primary/40",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      <p className="text-sm uppercase tracking-wide text-muted-foreground">{planOption.label}</p>
                    </div>
                    {planOption.badge && <Badge variant="secondary" className="text-xs">{planOption.badge}</Badge>}
                  </div>
                  <p className="text-2xl font-semibold text-foreground">
                    {priceByPlan[planOption.id]}
                    <span className="text-sm font-normal text-muted-foreground">
                      {planOption.billingPeriodLabel}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{planOption.description}</p>
                  <p className="text-xs text-muted-foreground">{planOption.hint}</p>
                </button>
              );
            })}
          </div>

          <Button
            onClick={() => { void handlePurchase(selectedProductId); }}
            disabled={!isAvailable || purchasing || productsLoading || !selectedProduct}
            className="w-full"
          >
            {purchasing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Unlock with ${PLAN_OPTIONS.find((o) => o.id === selectedPlan)?.label ?? "Plan"}`
            )}
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" className="w-full sm:flex-1" disabled={manageLoading} onClick={handleManageSubscriptions}>
              {manageLoading ? "Opening..." : "Manage Subscription"}
            </Button>
            <Button variant="ghost" className="w-full sm:flex-1" disabled={purchasing} onClick={() => { void handleRestore(); }}>
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
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <p className="font-semibold text-foreground">{subscriptionStatusText}</p>
          <p className="text-sm text-muted-foreground">{renewalText}</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={isActive ? "default" : "secondary"}>{statusLabel}</Badge>
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
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button onClick={handleManageSubscriptions} variant="outline" className="w-full" disabled={manageLoading}>
          <Settings className="mr-2 h-4 w-4" />
          {manageLoading ? "Opening..." : "Manage Subscription"}
        </Button>
        <Button onClick={() => { void handleRestore(); }} disabled={purchasing} variant="ghost" className="w-full">
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
