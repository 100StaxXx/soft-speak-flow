import { useMemo, useState, memo } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { getProductForPlan, getPurchaseProductIdForPlan, type IAPPlan } from "@/utils/appleIAP";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, RefreshCw, Settings } from "lucide-react";
import {
  PREMIUM_APPLE_BILLING_DISCLOSURE,
  PREMIUM_BENEFITS,
  PREMIUM_BENEFITS_SUMMARY,
  PREMIUM_PLAN_NOTE,
  PREMIUM_PRODUCT_NAME,
  PREMIUM_SUBSCRIPTION_LEGAL_LINKS,
} from "@/config/premiumBenefits";
import { PRODUCT } from "@/config/product";

type PlanOption = {
  id: IAPPlan;
  label: string;
  productTitle: string;
  description: string;
  hint: string;
  fallbackPrice: string;
  billingPeriodLabel: string;
  subscriptionLength: string;
  fallbackUnitPrice: string;
  badge?: string;
};

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "monthly",
    label: "Monthly",
    productTitle: `${PREMIUM_PRODUCT_NAME} Monthly`,
    description: PREMIUM_BENEFITS_SUMMARY,
    hint: `Full ${PREMIUM_PRODUCT_NAME} access billed monthly.`,
    fallbackPrice: PRODUCT.mode === "cosmiq" ? "$9.99" : "$8.99",
    billingPeriodLabel: "/month",
    subscriptionLength: "1 month",
    fallbackUnitPrice: PRODUCT.mode === "cosmiq" ? "$9.99/month" : "$8.99/month",
  },
  {
    id: "yearly",
    label: "Yearly",
    productTitle: `${PREMIUM_PRODUCT_NAME} Yearly`,
    description: PREMIUM_BENEFITS_SUMMARY,
    hint: `Full ${PREMIUM_PRODUCT_NAME} access billed yearly with the best recurring value.`,
    fallbackPrice: PRODUCT.mode === "cosmiq" ? "$99.99" : "$49.99",
    billingPeriodLabel: "/year",
    subscriptionLength: "1 year",
    fallbackUnitPrice: PRODUCT.mode === "cosmiq"
      ? "$8.33/month when billed yearly"
      : "$4.17/month when billed yearly",
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
    hasOfferCode,
    activeYearlyOffer,
  } = useAppleSubscription();

  const [selectedPlan, setSelectedPlan] = useState<IAPPlan>("yearly");
  const selectedProductId = getPurchaseProductIdForPlan(selectedPlan, products, hasOfferCode);
  const activeYearlyOfferPrice = activeYearlyOffer?.price ?? "$29.99";
  const activeYearlyOfferUnitPrice = activeYearlyOffer?.unitPrice ?? "$2.50/month, locked while active";

  const subscriptionStatusText = subscription
    ? `You have ${PREMIUM_PRODUCT_NAME} (${plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Active"})`
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
    : `Subscribe for ${PREMIUM_BENEFITS_SUMMARY.toLowerCase()}`;

  const priceByPlan = useMemo(() => {
    return PLAN_OPTIONS.reduce<Record<string, string>>((acc, option) => {
      acc[option.id] = option.id === "yearly" && hasOfferCode
        ? activeYearlyOfferPrice
        : getProductForPlan(option.id, products, hasOfferCode)?.displayPrice ?? option.fallbackPrice;
      return acc;
    }, {});
  }, [activeYearlyOfferPrice, hasOfferCode, products]);
  const unitPriceByPlan = useMemo(() => {
    return PLAN_OPTIONS.reduce<Record<string, string>>((acc, option) => {
      const product = getProductForPlan(option.id, products, hasOfferCode);
      if (option.id === "yearly" && hasOfferCode) {
        acc[option.id] = activeYearlyOfferUnitPrice;
        return acc;
      }

      acc[option.id] = option.id === "yearly" && product?.pricePerMonthString
        ? `${product.pricePerMonthString}/month when billed yearly`
        : option.id === "monthly"
          ? `${priceByPlan[option.id]}/month`
          : option.fallbackUnitPrice;
      return acc;
    }, {});
  }, [activeYearlyOfferUnitPrice, hasOfferCode, priceByPlan, products]);

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
            Unlock daily practices, Guide reflections, and offline access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground">
            {subscriptionStatusText}
          </div>

          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <p className="text-sm font-medium text-foreground">Every plan includes:</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {PREMIUM_BENEFITS.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
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
                      <p className="text-sm uppercase tracking-wide text-muted-foreground">{planOption.productTitle}</p>
                    </div>
                    {planOption.badge && <Badge variant="secondary" className="text-xs">{planOption.badge}</Badge>}
                  </div>
                  <p className="text-2xl font-semibold text-foreground">
                    {priceByPlan[planOption.id]}
                    <span className="text-sm font-normal text-muted-foreground">
                      {planOption.billingPeriodLabel}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Length: {planOption.subscriptionLength}</p>
                  <p className="text-xs text-muted-foreground">{unitPriceByPlan[planOption.id]}</p>
                  <p className="text-xs text-muted-foreground">{planOption.description}</p>
                  <p className="text-xs text-muted-foreground">{planOption.hint}</p>
                </button>
              );
            })}
          </div>

          <Button
            onClick={() => { void handlePurchase(selectedProductId); }}
            disabled={!isAvailable || purchasing}
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

          <p className="text-xs text-center text-muted-foreground">
            {PREMIUM_PLAN_NOTE}
          </p>

          <div className="rounded-lg border border-border/60 bg-card/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">
              {PLAN_OPTIONS.find((option) => option.id === selectedPlan)?.productTitle}
            </p>
            <p>
              Subscription length: {PLAN_OPTIONS.find((option) => option.id === selectedPlan)?.subscriptionLength}.
              Price: {priceByPlan[selectedPlan]}{PLAN_OPTIONS.find((option) => option.id === selectedPlan)?.billingPeriodLabel}
              {" "}({unitPriceByPlan[selectedPlan]}).
            </p>
            <p className="mt-2">{PREMIUM_APPLE_BILLING_DISCLOSURE}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <a href={PREMIUM_SUBSCRIPTION_LEGAL_LINKS.privacy.inAppHref} className="underline">
                {PREMIUM_SUBSCRIPTION_LEGAL_LINKS.privacy.label}
              </a>
              <a href={PREMIUM_SUBSCRIPTION_LEGAL_LINKS.terms.inAppHref} className="underline">
                {PREMIUM_SUBSCRIPTION_LEGAL_LINKS.terms.label}
              </a>
              <a
                href={PREMIUM_SUBSCRIPTION_LEGAL_LINKS.appleEula.publicHref}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                EULA
              </a>
            </div>
          </div>

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
