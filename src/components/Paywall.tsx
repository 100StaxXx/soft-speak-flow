import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Crown, Gift, Lock, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppleSubscription } from "@/hooks/useAppleSubscription";
import { getProductForPlan, getPurchaseProductIdForPlan } from "@/utils/appleIAP";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteCurrentAccount,
  getAccountDeletionErrorMetadata,
  getAccountDeletionFailureMessage,
  isAccountDeletionAuthError,
} from "@/services/accountDeletion";
import { logger } from "@/utils/logger";
import { useReferrals } from "@/hooks/useReferrals";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useLocation, useNavigate } from "react-router-dom";
import paywallPrimaryBackground from "@/assets/backgrounds/paywall-primary.webp";
import { trackPaywallEvent } from "@/utils/paywallTelemetry";

type PlanType = "monthly" | "yearly";
export type PaywallVariant = "pre_trial_signup" | "trial_expired";

interface PaywallProps {
  variant?: PaywallVariant;
}

const blurActiveElement = () => {
  if (typeof document === "undefined") return;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
};

export const Paywall = ({ variant = "pre_trial_signup" }: PaywallProps) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("yearly");
  const [offerCode, setOfferCode] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const deleteConfirmationInputRef = useRef<HTMLInputElement | null>(null);
  const deleteSubmitButtonRef = useRef<HTMLButtonElement | null>(null);

  const {
    handlePurchase,
    handleRestore,
    loading,
    isAvailable,
    products,
    productsLoading,
    productError,
    reloadProducts,
    hasOfferCode,
    hasAppliedReferralCode,
    appliedReferralCode,
    offerCodePurchaseReady,
  } = useAppleSubscription();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { applyReferralCode } = useReferrals();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  const monthlyProduct = useMemo(() => getProductForPlan("monthly", products), [products]);
  const yearlyProduct = useMemo(() => getProductForPlan("yearly", products), [products]);
  const selectedProduct = selectedPlan === "yearly" ? yearlyProduct : monthlyProduct;
  const selectedProductId = useMemo(
    () => getPurchaseProductIdForPlan(selectedPlan, products),
    [selectedPlan, products],
  );

  useEffect(() => {
    trackPaywallEvent("paywall_viewed", {
      surface: "paywall",
      variant,
      hasOfferCode,
    });
  }, [hasOfferCode, variant]);

  const handleSubscribe = async () => {
    if (!selectedProduct) {
      toast({
        title: "Almost ready",
        description: "We're still fetching pricing details. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    trackPaywallEvent("package_selected", {
      surface: "paywall",
      plan: selectedPlan,
      productId: selectedProductId,
      hasOfferCode,
    });
    const success = await handlePurchase(selectedProductId, "paywall");
    if (success) {
      navigate("/premium/success");
    }
  };

  const handleApplyOfferCode = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sanitized = offerCode.trim().toUpperCase();
    if (!sanitized || !user?.id) return;

    try {
      trackPaywallEvent("offer_code_applied", {
        surface: "paywall",
        offerCode: sanitized,
      });
      await applyReferralCode.mutateAsync(sanitized);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["referral-stats", user.id] }),
      ]);
      setOfferCode("");
      toast({
        title: "Creator code applied",
        description: "Your yearly plan is now discounted to $69.99/year.",
      });
    } catch (error) {
      trackPaywallEvent("offer_code_failed", {
        surface: "paywall",
        offerCode: sanitized,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }, [applyReferralCode, queryClient, offerCode, toast, user?.id]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate("/auth");
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Please type DELETE to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      if (!user?.id) {
        throw new Error("Session expired. Please sign in again.");
      }

      const { warnings } = await deleteCurrentAccount({
        queryClient,
        userId: user.id,
        signOut,
      });

      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      navigate("/auth", {
        replace: true,
        state: { message: "Your account has been deleted." },
      });
      toast({
        title: "Account deleted",
        description:
          warnings.length > 0
            ? "Your account was deleted. Some media cleanup tasks will finish in the background."
            : "Your account has been permanently deleted.",
      });
    } catch (error) {
      console.error("Delete account error:", error);

      if (isAccountDeletionAuthError(error)) {
        toast({
          title: "Session expired",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        try {
          await signOut();
        } catch (signOutError) {
          console.warn("Sign out after deletion auth error failed:", signOutError);
        }
        navigate("/auth", { replace: true });
      } else {
        const errorMetadata = getAccountDeletionErrorMetadata(error);
        logger.error("[Account Deletion] Paywall deletion failed", {
          surface: variant,
          userId: user?.id ?? null,
          code: errorMetadata.code,
          status: errorMetadata.status,
          requestId: errorMetadata.requestId,
          stage: errorMetadata.stage,
          message: error instanceof Error ? error.message : String(error),
        });
        toast({
          title: "Error",
          description: getAccountDeletionFailureMessage(error),
          variant: "destructive",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccountSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleDeleteAccount();
  }, [handleDeleteAccount]);

  const handleDeleteButtonPointerDown = useCallback((_: PointerEvent<HTMLButtonElement>) => {
    blurActiveElement();
  }, []);

  const handleDeleteConfirmationChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDeleteConfirmText(nextValue);

    if (nextValue !== "DELETE") return;

    window.setTimeout(() => {
      if (document.activeElement !== deleteConfirmationInputRef.current) return;
      deleteConfirmationInputRef.current?.blur();
      deleteSubmitButtonRef.current?.focus();
    }, 0);
  }, []);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (isDeleting) return;
    setShowDeleteDialog(open);
    if (!open) {
      setDeleteConfirmText("");
    }
  }, [isDeleting]);

  const plans = {
    monthly: {
      fallbackPrice: "$9.99",
      period: "/month",
      savings: null,
    },
    yearly: {
      fallbackPrice: hasOfferCode ? "$69.99" : "$99.99",
      period: "/year",
      savings: hasOfferCode ? "Code applied" : "Best value",
    },
  };

  const copy = variant === "trial_expired"
    ? {
        title: "Your Free Trial Has Ended",
        subtitle: "Subscribe to keep building momentum with your companion",
        cta: `Subscribe ${selectedPlan === "yearly" ? "Yearly" : "Monthly"}`,
        legalIntro: "Payment will be charged to your Apple ID account at confirmation of purchase.",
      }
    : {
        title: "Keep Your Journey Going",
        subtitle: "Start your free trial to unlock premium guidance, quests, and companion growth",
        cta: "Start 7-Day Free Trial",
        legalIntro:
          "No charge today. Your Apple ID account will be charged when the free trial ends unless canceled at least 24 hours before the end of the trial.",
      };
  const ctaLabel = selectedPlan === "yearly" && hasOfferCode
    ? (offerCodePurchaseReady ? "Subscribe Yearly" : "Redeem Discount with Apple")
    : copy.cta;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-start px-6 pt-safe pb-[var(--bottom-nav-runtime-offset,var(--bottom-nav-safe-offset))] overflow-y-auto">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${paywallPrimaryBackground})` }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-background/30 via-background/55 to-background/95" aria-hidden="true" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_38%)]" aria-hidden="true" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/90 to-accent/90 shadow-glow backdrop-blur-sm">
            <Crown className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl text-foreground">
            {copy.title}
          </h1>
          <p className="text-muted-foreground">
            {copy.subtitle}
          </p>
        </div>

        {/* Offer Code Section */}
        <Card className="border-white/15 bg-background/60 backdrop-blur-md shadow-2xl">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-primary/15 p-2">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Have a creator code?</h2>
                <p className="text-sm text-muted-foreground">
                  Enter it here to unlock the discounted annual price.
                </p>
              </div>
            </div>

            {hasAppliedReferralCode ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {hasOfferCode ? "Creator code applied" : "Referral code applied"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {hasOfferCode
                        ? "Your annual plan is discounted to $69.99/year."
                        : "This code is saved to your account, but it does not unlock the Apple creator discount."}
                    </p>
                    {hasOfferCode && appliedReferralCode ? (
                      <p className="text-xs text-muted-foreground">
                        Use <span className="font-mono tracking-[0.18em] text-foreground">{appliedReferralCode}</span> in Apple&apos;s offer-code redemption screen.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={handleApplyOfferCode}>
                <Input
                  placeholder="ENTER CREATOR CODE"
                  value={offerCode}
                  onChange={(event) => setOfferCode(event.target.value.toUpperCase())}
                  maxLength={24}
                  className="h-12 border-white/15 bg-background/70 text-center text-base tracking-[0.2em] uppercase"
                />
                <Button
                  type="submit"
                  disabled={applyReferralCode.isPending || !offerCode.trim()}
                  className="w-full"
                >
                  {applyReferralCode.isPending ? "Applying..." : "Apply Creator Code"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Entering a valid code unlocks discounted annual pricing.
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Plan Selection */}
        <div className="flex gap-3">
          {(["monthly", "yearly"] as PlanType[]).map((plan) => (
            <Card
              key={plan}
              onClick={() => setSelectedPlan(plan)}
              className={cn(
                "flex-1 cursor-pointer transition-all relative overflow-hidden border-white/10 bg-background/55 backdrop-blur-md",
                selectedPlan === plan
                  ? "border-2 border-primary bg-primary/10 shadow-glow"
                  : "border hover:border-primary/50"
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
                  {(plan === "yearly" ? yearlyProduct?.displayPrice : monthlyProduct?.displayPrice) ?? plans[plan].fallbackPrice}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plans[plan].period}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features */}
        <Card className="border-white/10 bg-background/50 backdrop-blur-md">
          <CardContent className="p-5 space-y-3">
            {[
              { icon: Sparkles, text: "All 15 evolution stages" },
              { icon: MessageCircle, text: "Unlimited guide chat" },
              { icon: Lock, text: "Unlimited Quests & Epics" },
              { icon: Crown, text: "All premium features" },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <feature.icon className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-foreground">{feature.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Subscribe Button */}
        <Button
          onClick={() => { void handleSubscribe(); }}
          disabled={!isAvailable || loading || productsLoading || !selectedProduct}
          className="w-full py-6 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground shadow-glow"
        >
          {loading ? "Processing..." : ctaLabel}
          {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>

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

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() => navigate("/promo-code", { state: { returnTo } })}
            className="border-white/15 bg-background/45 backdrop-blur-md"
          >
            Redeem Promo Code
          </Button>
          <Button
            variant="ghost"
            onClick={() => { void handleRestore("paywall"); }}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Restore Purchases
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground leading-relaxed">
          {copy.legalIntro}
        </p>
        <div className="flex justify-center gap-4 text-xs">
          <a href="/privacy" className="text-muted-foreground underline hover:text-foreground">Privacy Policy</a>
          <a href="/terms" className="text-muted-foreground underline hover:text-foreground">Terms of Use</a>
        </div>

        {/* Account options */}
        <div className="pt-1 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Need another account?</p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="link"
              size="sm"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
            <span className="text-xs text-muted-foreground/60">•</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
            >
              Delete account
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This action is permanent and cannot be undone. All your data,
                  including your companion, progress, and achievements will be
                  permanently deleted.
                </p>
                <p className="font-medium text-foreground">
                  Type <span className="font-bold text-destructive">DELETE</span> to confirm:
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form className="space-y-4" onSubmit={handleDeleteAccountSubmit}>
            <Input
              id="paywall-delete-confirmation-input"
              aria-label="Type DELETE to confirm"
              ref={deleteConfirmationInputRef}
              value={deleteConfirmText}
              onChange={handleDeleteConfirmationChange}
              placeholder="Type DELETE"
              className="mt-2"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              disabled={isDeleting}
            />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <Button
                ref={deleteSubmitButtonRef}
                type="submit"
                variant="destructive"
                onPointerDown={handleDeleteButtonPointerDown}
                disabled={isDeleting || deleteConfirmText !== "DELETE"}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete Account"
                )}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
