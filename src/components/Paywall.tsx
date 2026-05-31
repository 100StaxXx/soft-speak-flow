import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Crown,
  Gift,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  APP_STORE_SUBSCRIPTION_ALREADY_LINKED_MESSAGE,
  useAppleSubscription,
} from "@/hooks/useAppleSubscription";
import { getProductForPlan, getPurchaseProductIdForPlan } from "@/utils/appleIAP";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import {
  deleteCurrentAccount,
  getAccountDeletionErrorMetadata,
  getAccountDeletionFailureMessage,
  isAccountDeletionAuthError,
} from "@/services/accountDeletion";
import { logger } from "@/utils/logger";
import { isInvalidReferralCodeError, useReferrals } from "@/hooks/useReferrals";
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
import { useNavigate } from "react-router-dom";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import { AppleOfferCodeRedemption } from "@/plugins/AppleOfferCodeRedemptionPlugin";
import type { StaticBackgroundAsset } from "@/assets/backgrounds";
import { trackPaywallEvent } from "@/utils/paywallTelemetry";
import {
  PREMIUM_APPLE_BILLING_DISCLOSURE,
  PREMIUM_PLAN_NOTE,
  PREMIUM_SUBSCRIPTION_LEGAL_LINKS,
} from "@/config/premiumBenefits";
import { DISCORD_INVITE_URL } from "@/constants/community";
import {
  buildAppleOfferCodeRedeemUrl,
  isAppleOneTimeOfferCode,
  normalizePaywallOfferCodeInput,
} from "@/utils/appleOfferCodeRedemption";
import { queryKeys } from "@/lib/queryKeys";

type PlanType = "monthly" | "yearly";
export type PaywallVariant = "pre_trial_signup" | "trial_expired";

interface PaywallProps {
  variant?: PaywallVariant;
}

interface PaywallStorySection {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  background: StaticBackgroundAsset;
  icon: LucideIcon;
  imagePosition: string;
}

interface PaywallBenefit {
  icon: LucideIcon;
  title: string;
  text: string;
}

interface PaywallLandscapeSectionProps {
  id: string;
  background: StaticBackgroundAsset;
  imagePosition?: string;
  loading?: "eager" | "lazy";
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

const PAYWALL_CHECKOUT_ID = "cosmiq-pro-plans";
const APPLE_OFFER_CODE_LOCAL_LOOKUP_TIMEOUT_MS = 4500;
const APPLE_OFFER_CODE_LOOKUP_TIMEOUT_MESSAGE = "Cosmiq code lookup timed out";
const APPLE_OFFER_CODE_REDEMPTION_HANDOFF_TIMEOUT_MS = 6000;
const APPLE_OFFER_CODE_REDEMPTION_HANDOFF_TIMEOUT_MESSAGE = "Apple redemption handoff timed out";

const createPaywallBackdrop = (src: string, src2x = src): StaticBackgroundAsset => ({
  src,
  src2x,
});

const paywallBackdrops = {
  quests: createPaywallBackdrop("/landing-backdrops/quests.jpg", "/landing-backdrops/quests@2x.jpg"),
  companion: createPaywallBackdrop("/landing-backdrops/companion.jpg", "/landing-backdrops/companion@2x.jpg"),
  profile: createPaywallBackdrop("/landing-backdrops/profile.jpg", "/landing-backdrops/profile@2x.jpg"),
};

const paywallStorySections: PaywallStorySection[] = [
  {
    id: "paywall-quests",
    eyebrow: "Daily quests",
    title: "A companion that turns your goals into daily quests.",
    body: "Start with what matters, shape the day, follow through, and let your progress become part of a world that keeps calling you back.",
    background: paywallBackdrops.quests,
    icon: Target,
    imagePosition: "50% 42%",
  },
  {
    id: "paywall-companion",
    eyebrow: "Built for growth",
    title: "Your companion grows when you follow through.",
    body: "XP, daily missions, evolutions, stories, collection, and memories turn ordinary consistency into a world worth returning to.",
    background: paywallBackdrops.companion,
    icon: Sparkles,
    imagePosition: "50% 48%",
  },
];

const paywallBenefits: PaywallBenefit[] = [
  {
    icon: MessageCircle,
    title: "Unlimited companion chat",
    text: "Ask your companion for planning help, motivation, reflection, and calmer next steps whenever the day gets noisy.",
  },
  {
    icon: Target,
    title: "Unlimited quests and campaigns",
    text: "Turn daily responsibilities and bigger goals into quests, rituals, milestones, and day plans.",
  },
  {
    icon: Sparkles,
    title: "100+ levels and 12+ evolutions",
    text: "Keep the full companion growth arc open, including missions, stories, collection, and growth rewards.",
  },
  {
    icon: Crown,
    title: "Offline downloaded content",
    text: "Keep downloaded guidance and content close when focus matters and connection is not guaranteed.",
  },
];

const blurActiveElement = () => {
  if (typeof document === "undefined") return;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
};

const isReferralCodeBusinessRuleError = (error: unknown): boolean => {
  if (isInvalidReferralCodeError(error)) return true;

  if (!error || typeof error !== "object" || !("parsed" in error)) {
    return false;
  }

  const parsed = (error as { parsed?: { category?: string; status?: number } }).parsed;
  return parsed?.category === "http" && (parsed.status === 404 || parsed.status === 409);
};

const isAppleOfferCodeLookupTimeoutError = (error: unknown): boolean =>
  error instanceof Error && error.message === APPLE_OFFER_CODE_LOOKUP_TIMEOUT_MESSAGE;

const shouldOpenAppleRedemptionAfterReferralFailure = (error: unknown): boolean =>
  isAppleOfferCodeLookupTimeoutError(error) || isReferralCodeBusinessRuleError(error);

function withAppleOfferCodeLookupTimeout<T>(promise: Promise<T>, enabled: boolean): Promise<T> {
  if (!enabled) return promise;

  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(APPLE_OFFER_CODE_LOOKUP_TIMEOUT_MESSAGE));
    }, APPLE_OFFER_CODE_LOCAL_LOOKUP_TIMEOUT_MS);

    promise.then(resolve, reject).finally(() => {
      globalThis.clearTimeout(timeoutId);
    });
  });
}

async function withAppleRedemptionHandoffTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(APPLE_OFFER_CODE_REDEMPTION_HANDOFF_TIMEOUT_MESSAGE));
        }, APPLE_OFFER_CODE_REDEMPTION_HANDOFF_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const PaywallLandscapeSection = ({
  id,
  background,
  imagePosition = "50% 50%",
  loading = "lazy",
  className,
  contentClassName,
  children,
}: PaywallLandscapeSectionProps) => (
  <section
    id={id}
    className={cn("relative isolate min-h-[100svh] snap-start snap-always overflow-hidden", className)}
  >
    <StaticBackgroundImage
      background={background}
      className="absolute inset-0 -z-20 h-full w-full object-cover pointer-events-none select-none"
      objectPosition={imagePosition}
      loading={loading}
    />
    <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,7,12,0.66)_0%,rgba(3,7,12,0.28)_40%,rgba(3,7,12,0.93)_100%),linear-gradient(90deg,rgba(3,7,12,0.84)_0%,rgba(3,7,12,0.3)_54%,rgba(3,7,12,0.72)_100%)]" />
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.13),transparent_34%)]" />
    <div
      className={cn(
        "relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl px-5",
        contentClassName,
      )}
    >
      {children}
    </div>
  </section>
);

export const Paywall = ({ variant = "pre_trial_signup" }: PaywallProps) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("yearly");
  const [offerCode, setOfferCode] = useState("");
  const [isRedeemingAppleCode, setIsRedeemingAppleCode] = useState(false);
  const [appleRedemptionFallbackUrl, setAppleRedemptionFallbackUrl] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pendingAppleRedemptionRecoveryRef = useRef(false);

  const {
    handlePurchase,
    handleRestore,
    handleRecoverExistingSubscription,
    loading,
    isAvailable,
    products,
    productsLoading,
    productError,
    reloadProducts,
    hasOfferCode,
    activeYearlyOffer,
    hasAppliedReferralCode,
    appliedReferralCode,
    offerCodePurchaseReady,
    recoveringExistingSubscription,
  } = useAppleSubscription();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { hasAccess, loading: accessStatusLoading } = useAccessStatus();
  const { applyReferralCode } = useReferrals();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const monthlyProduct = useMemo(() => getProductForPlan("monthly", products), [products]);
  const yearlyProduct = useMemo(
    () => getProductForPlan("yearly", products),
    [products],
  );
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

  const handleContactSupport = useCallback(() => {
    const currentIssue = productError === APP_STORE_SUBSCRIPTION_ALREADY_LINKED_MESSAGE
      ? [
          "I am stuck on the paywall because my App Store subscription is already linked to another Cosmiq account.",
          `Current Cosmiq account: ${user?.id ?? "unknown"}.`,
          "Please help reassign the purchase if this subscription belongs to me.",
        ].join("\n")
      : productError
        ? `I need help with this subscription error:\n${productError}`
        : "I need help with my App Store subscription.";

    navigate("/support/report", {
      state: {
        defaultCategory: "billing",
        defaultMessage: currentIssue,
      },
    });
  }, [navigate, productError, user?.id]);

  const invalidateAppleRedemptionState = useCallback(async () => {
    if (!user?.id) return;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.access.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: ["subscription"] }),
      queryClient.invalidateQueries({ queryKey: ["referral-stats", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["applied-referral-code-state", user.id] }),
    ]);
  }, [queryClient, user?.id]);

  const recoverAfterAppleOfferRedemption = useCallback(async () => {
    if (!pendingAppleRedemptionRecoveryRef.current) return;

    pendingAppleRedemptionRecoveryRef.current = false;
    setIsRedeemingAppleCode(true);
    try {
      const result = await handleRecoverExistingSubscription("paywall_apple_offer_code", {
        showSuccessToast: false,
      });
      await invalidateAppleRedemptionState();

      if (result === "verified") {
        setAppleRedemptionFallbackUrl(null);
        toast({
          title: "Cosmiq unlocked",
          description: "Your Apple offer code is active on this account.",
        });
        navigate("/premium/success");
        return;
      }

      toast({
        title: "Apple redemption checked",
        description: "If Apple accepted the code, access can take a moment to appear. Try Restore Purchases if it does not unlock.",
      });
    } catch (error) {
      toast({
        title: "Unable to refresh Apple redemption",
        description: error instanceof Error ? error.message : "Try Restore Purchases after redeeming your code.",
        variant: "destructive",
      });
    } finally {
      setIsRedeemingAppleCode(false);
    }
  }, [handleRecoverExistingSubscription, invalidateAppleRedemptionState, navigate, toast]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let sawInactiveState = false;
    let isMounted = true;
    let listener: { remove: () => Promise<void> } | undefined;

    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!pendingAppleRedemptionRecoveryRef.current) return;
      if (!isActive) {
        sawInactiveState = true;
        return;
      }

      if (sawInactiveState) {
        sawInactiveState = false;
        void recoverAfterAppleOfferRedemption();
      }
    }).then((handle) => {
      if (!isMounted) {
        void handle.remove();
        return;
      }
      listener = handle;
    });

    return () => {
      isMounted = false;
      void listener?.remove();
    };
  }, [recoverAfterAppleOfferRedemption]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let isMounted = true;
    let listener: { remove: () => Promise<void> } | undefined;

    void Browser.addListener("browserFinished", () => {
      void recoverAfterAppleOfferRedemption();
    }).then((handle) => {
      if (!isMounted) {
        void handle.remove();
        return;
      }
      listener = handle;
    });

    return () => {
      isMounted = false;
      void listener?.remove();
    };
  }, [recoverAfterAppleOfferRedemption]);

  const openAppleOfferCodeRedemption = useCallback(async (code: string) => {
    const redeemUrl = buildAppleOfferCodeRedeemUrl(code);
    pendingAppleRedemptionRecoveryRef.current = true;
    setIsRedeemingAppleCode(true);
    setAppleRedemptionFallbackUrl(redeemUrl);
    trackPaywallEvent("offer_code_redemption_started", {
      surface: "paywall",
      offerCode: normalizePaywallOfferCodeInput(code),
      redemptionType: "apple_one_time_code",
    });

    toast({
      title: "Redeeming with Apple...",
      description: "Opening Apple's offer-code redemption flow.",
    });

    try {
      if (Capacitor.isNativePlatform()) {
        await withAppleRedemptionHandoffTimeout(
          AppleOfferCodeRedemption.openRedemptionUrl({ url: redeemUrl }).catch(async (error) => {
            logger.warn("[Paywall] Native Apple redemption handoff failed; trying browser fallback", {
              message: error instanceof Error ? error.message : String(error),
            });
            await Browser.open({ url: redeemUrl });
          }),
        );
        setIsRedeemingAppleCode(false);
        return;
      }

      window.location.href = redeemUrl;
    } catch (error) {
      pendingAppleRedemptionRecoveryRef.current = false;
      setIsRedeemingAppleCode(false);
      setAppleRedemptionFallbackUrl(redeemUrl);
      const handoffTimedOut = error instanceof Error
        && error.message === APPLE_OFFER_CODE_REDEMPTION_HANDOFF_TIMEOUT_MESSAGE;
      toast({
        title: handoffTimedOut ? "Apple redemption did not open" : "Unable to open Apple redemption",
        description: handoffTimedOut
          ? "Use the Apple redemption link below, then return and tap Restore Purchases if access does not unlock."
          : error instanceof Error
            ? error.message
            : "Use the Apple redemption link below, then return and tap Restore Purchases.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const showOfferCodeApplyError = useCallback((error: unknown) => {
    toast({
      title: "Unable to apply code",
      description: error instanceof Error ? error.message : "Please check the code and try again.",
      variant: "destructive",
    });
  }, [toast]);

  const handleApplyOfferCode = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sanitized = normalizePaywallOfferCodeInput(offerCode);
    setAppleRedemptionFallbackUrl(null);
    if (!sanitized) {
      toast({
        title: "Enter a code",
        description: "Paste a creator code or Apple offer code, then try again.",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in again before applying an offer code.",
        variant: "destructive",
      });
      return;
    }

    const appleOneTimeCode = isAppleOneTimeOfferCode(sanitized);
    try {
      trackPaywallEvent("offer_code_applied", {
        surface: "paywall",
        offerCode: sanitized,
      });
      if (appleOneTimeCode) {
        toast({
          title: "Apple offer code detected",
          description: "Checking Cosmiq first. Apple redemption will open if this is not a local code.",
        });
      }

      const result = await withAppleOfferCodeLookupTimeout(
        applyReferralCode.mutateAsync({
          code: sanitized,
          suppressToast: true,
        }),
        appleOneTimeCode,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["referral-stats", user.id] }),
      ]);
      setOfferCode("");
      setAppleRedemptionFallbackUrl(null);
      if (result.code_type === "special") {
        toast({
          title: "Genesis code applied",
          description: "Your yearly plan is now discounted to $49.99 for the first year.",
        });
      } else if (result.code_type === "affiliate") {
        toast({
          title: "Creator code applied",
          description: "Your yearly plan is now discounted to $69.99 for the first year.",
        });
      } else {
        toast({
          title: "Referral code applied",
          description: "This code is saved to your account, but it does not unlock the Apple creator discount.",
        });
      }
    } catch (error) {
      if (appleOneTimeCode && shouldOpenAppleRedemptionAfterReferralFailure(error)) {
        if (isAppleOfferCodeLookupTimeoutError(error)) {
          toast({
            title: "Cosmiq code lookup timed out",
            description: "Opening Apple's redemption flow for this Apple offer code.",
          });
        }
        await openAppleOfferCodeRedemption(sanitized);
        return;
      }

      trackPaywallEvent("offer_code_failed", {
        surface: "paywall",
        offerCode: sanitized,
        message: error instanceof Error ? error.message : "unknown_error",
      });
      showOfferCodeApplyError(error);
    }
  }, [
    applyReferralCode,
    offerCode,
    openAppleOfferCodeRedemption,
    queryClient,
    showOfferCodeApplyError,
    toast,
    user?.id,
  ]);

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
      const deleteConfirmationInput = document.getElementById("paywall-delete-confirmation-input");
      const deleteSubmitButton = document.getElementById("paywall-delete-submit-button");
      if (document.activeElement !== deleteConfirmationInput) return;
      deleteConfirmationInput?.blur();
      deleteSubmitButton?.focus();
    }, 0);
  }, []);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (isDeleting) return;
    setShowDeleteDialog(open);
    if (!open) {
      setDeleteConfirmText("");
    }
  }, [isDeleting]);

  const scrollToCheckout = useCallback(() => {
    document.getElementById(PAYWALL_CHECKOUT_ID)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const activeYearlyOfferPrice = activeYearlyOffer?.price ?? "$69.99";
  const activeYearlyOfferUnitPrice = activeYearlyOffer?.unitPrice ?? "$5.83/month for the first year";

  const plans = {
    monthly: {
      title: "Cosmiq Pro Monthly",
      duration: "1 month",
      fallbackPrice: "$9.99",
      period: "/month",
      savings: null,
      fallbackUnitPrice: "$9.99/month",
    },
    yearly: {
      title: "Cosmiq Pro Yearly",
      duration: "1 year",
      fallbackPrice: hasOfferCode ? activeYearlyOfferPrice : "$99.99",
      period: "/year",
      savings: hasOfferCode ? "Code applied" : "Best value",
      fallbackUnitPrice: hasOfferCode
        ? activeYearlyOfferUnitPrice
        : "$8.33/month when billed yearly",
    },
  };
  const hasSelectedCreatorYearlyOffer = hasOfferCode && selectedPlan === "yearly";
  const getPlanDisplayPrice = (plan: PlanType) => {
    if (plan === "yearly" && hasOfferCode) return plans.yearly.fallbackPrice;
    return (plan === "yearly" ? yearlyProduct?.displayPrice : monthlyProduct?.displayPrice)
      ?? plans[plan].fallbackPrice;
  };
  const getPlanUnitPrice = (plan: PlanType) => {
    if (plan === "yearly" && hasOfferCode) return plans.yearly.fallbackUnitPrice;

    const product = plan === "yearly" ? yearlyProduct : monthlyProduct;
    if (plan === "yearly" && product?.pricePerMonthString) {
      return `${product.pricePerMonthString}/month when billed yearly`;
    }

    return plan === "monthly"
      ? `${getPlanDisplayPrice("monthly")}/month`
      : plans.yearly.fallbackUnitPrice;
  };
  const selectedPlanPrice = getPlanDisplayPrice(selectedPlan);
  const selectedPlanUnitPrice = getPlanUnitPrice(selectedPlan);
  const selectedPlanPriceText = selectedPlan === "monthly"
    ? `${selectedPlanPrice}/month`
    : `${selectedPlanPrice}/year (${selectedPlanUnitPrice})`;
  const selectedPlanRenewalText = hasSelectedCreatorYearlyOffer
    ? `${selectedPlanPrice} for the first year (${selectedPlanUnitPrice}), then renews yearly at the standard yearly price unless canceled.`
    : `${selectedPlanPriceText}; renews every ${plans[selectedPlan].duration} until canceled.`;
  const isSubscriptionAlreadyLinkedError = productError === APP_STORE_SUBSCRIPTION_ALREADY_LINKED_MESSAGE;

  const copy = variant === "trial_expired"
    ? {
        checkoutEyebrow: "Keep the world open",
        title: "Your journey is ready to continue.",
        subtitle: "Subscribe to keep your companion, unlimited quests, campaigns, companion chat, and the full growth path active.",
        cta: `Subscribe ${selectedPlan === "yearly" ? "Yearly" : "Monthly"}`,
        legalIntro: hasSelectedCreatorYearlyOffer
          ? `Your creator code unlocks ${activeYearlyOfferPrice} for the first year. After the first year, this plan renews at the standard yearly price unless canceled.`
          : "Payment will be charged to your Apple ID account at confirmation of purchase.",
        heroBadge: "Continue with Cosmiq",
        shortcutLabel: "Plans",
      }
    : {
        checkoutEyebrow: "Start Cosmiq",
        title: "Start the trial. Keep the story moving.",
        subtitle: "Unlock the full experience: plan with your companion, follow your quests, and watch the world grow from real progress.",
        cta: hasSelectedCreatorYearlyOffer ? "Redeem Discount with Apple" : "Start 3-Day Free Trial",
        legalIntro: hasSelectedCreatorYearlyOffer
          ? `Your creator code unlocks ${activeYearlyOfferPrice} for the first year. After the first year, this plan renews at the standard yearly price unless canceled.`
          : "No charge today. Your Apple ID account will be charged when the free trial ends unless canceled at least 24 hours before the end of the trial.",
        heroBadge: "3-day free trial",
        shortcutLabel: "Start trial",
      };
  const ctaLabel = hasSelectedCreatorYearlyOffer
    ? (offerCodePurchaseReady ? "Subscribe Yearly" : "Redeem Discount with Apple")
    : copy.cta;
  const purchaseActionDisabled = !isAvailable || loading || productsLoading || recoveringExistingSubscription || isRedeemingAppleCode;

  if (!accessStatusLoading && hasAccess) {
    return null;
  }

  return (
    <div data-testid="paywall-overlay" className="fixed inset-0 z-[120] overflow-hidden bg-[#05080d] text-white">
      <button
        type="button"
        onClick={scrollToCheckout}
        className="fixed right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-[130] inline-flex h-10 items-center gap-2 border border-white/18 bg-black/32 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/84 backdrop-blur-xl transition hover:border-white/36 hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
        aria-label="View Cosmiq plans"
      >
        {copy.shortcutLabel}
        <ArrowDown className="h-3.5 w-3.5" />
      </button>

      <main className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {paywallStorySections.map((section, index) => {
          const Icon = section.icon;

          return (
            <PaywallLandscapeSection
              key={section.id}
              id={section.id}
              background={section.background}
              imagePosition={section.imagePosition}
              loading={index === 0 ? "eager" : "lazy"}
              contentClassName={cn(
                "flex-col justify-end pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] pt-[calc(env(safe-area-inset-top,0px)+4.75rem)]",
                index === 0 ? "items-center text-center sm:items-start sm:text-left" : "items-start text-left",
              )}
            >
              <div className={cn("w-full", index === 0 ? "max-w-3xl" : "max-w-2xl")}>
                <div className="mb-5 inline-flex items-center gap-2 border border-white/18 bg-black/24 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 backdrop-blur-md">
                  <Icon className="h-4 w-4" />
                  {section.eyebrow}
                </div>
                <h1 className={cn(
                  "font-display font-semibold leading-[0.96] tracking-normal text-white",
                  index === 0 ? "text-5xl sm:text-7xl lg:text-8xl" : "text-4xl sm:text-6xl lg:text-7xl",
                )}>
                  {section.title}
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-7 text-white/82 sm:text-2xl sm:leading-8">
                  {section.body}
                </p>
                {index === 0 ? (
                  <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={scrollToCheckout}
                      className="inline-flex h-14 items-center justify-center gap-2 border border-cyan-100/70 bg-cyan-100 px-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 sm:min-w-[15rem]"
                    >
                      See plans
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleSubscribe(); }}
                      disabled={purchaseActionDisabled}
                      className="inline-flex h-14 items-center justify-center border border-white/18 bg-black/20 px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/72 backdrop-blur-md transition hover:border-white/36 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {copy.heroBadge}
                    </button>
                  </div>
                ) : null}
              </div>
            </PaywallLandscapeSection>
          );
        })}

        <PaywallLandscapeSection
          id={PAYWALL_CHECKOUT_ID}
          background={paywallBackdrops.profile}
          imagePosition="50% 55%"
          contentClassName="items-start py-[calc(env(safe-area-inset-top,0px)+4.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3rem)]"
        >
          <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-center">
            <div className="space-y-6">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 border border-white/18 bg-black/24 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 backdrop-blur-md">
                  <Crown className="h-4 w-4" />
                  {copy.checkoutEyebrow}
                </div>
                <h2 className="max-w-3xl font-display text-4xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-7xl">
                  {copy.title}
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-7 text-white/82 sm:text-xl sm:leading-8">
                  {copy.subtitle}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {paywallBenefits.map((benefit) => {
                  const Icon = benefit.icon;

                  return (
                    <div
                      key={benefit.title}
                      className="border border-white/14 bg-black/24 p-4 backdrop-blur-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center border border-cyan-100/22 bg-cyan-100/10 text-cyan-100">
                          <Icon className="h-4 w-4" />
                        </span>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                          {benefit.title}
                        </h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/72">
                        {benefit.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border border-white/16 bg-black/42 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-5">
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                      Cosmiq
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      Choose your path
                    </h3>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center border border-white/16 bg-white/10">
                    <Trophy className="h-5 w-5 text-stardust-gold" />
                  </div>
                </div>

                {variant === "pre_trial_signup" ? (
                  <div
                    data-testid="paywall-trial-callout"
                    className="border border-cyan-100/36 bg-cyan-100/12 p-4 shadow-[0_0_34px_rgba(165,243,252,0.12)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-cyan-100 p-2 text-slate-950">
                        <Gift className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                          3-day free trial
                        </p>
                        <p className="mt-1 text-base font-semibold text-white">
                          No charge today.
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/72">
                          Try the full Cosmiq experience before your Apple ID account is charged.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3 border border-white/12 bg-white/[0.04] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 bg-cyan-100/12 p-2 text-cyan-100">
                      <Gift className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold text-white">Have a creator or Apple offer code?</h4>
                      <p className="text-sm text-white/68">
                        Enter it here to unlock Apple offer pricing.
                      </p>
                    </div>
                  </div>

                  {hasAppliedReferralCode ? (
                    <div className="border border-cyan-100/26 bg-cyan-100/10 p-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-cyan-100" />
                        <div className="space-y-1">
                          <p className="font-medium text-white">
                            {hasOfferCode ? "Creator code applied" : "Referral code applied"}
                          </p>
                          <p className="text-sm text-white/70">
                            {hasOfferCode
                              ? `Your annual plan is discounted to ${activeYearlyOfferPrice} for the first year.`
                              : "This code is saved to your account, but it does not unlock the Apple creator discount."}
                          </p>
                          {hasOfferCode && appliedReferralCode ? (
                            <p className="text-xs text-white/64">
                              Use <span className="font-mono tracking-[0.18em] text-white">{appliedReferralCode}</span> in Apple&apos;s offer-code redemption screen.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form className="space-y-3" onSubmit={handleApplyOfferCode}>
                      <Input
                        placeholder="ENTER CODE"
                        value={offerCode}
                        onChange={(event) => {
                          setOfferCode(event.target.value.toUpperCase());
                          setAppleRedemptionFallbackUrl(null);
                        }}
                        maxLength={256}
                        className="h-12 border-white/15 bg-black/40 text-center text-base uppercase tracking-[0.2em] text-white placeholder:text-white/36"
                      />
                      <Button
                        type="submit"
                        disabled={applyReferralCode.isPending || isRedeemingAppleCode || !offerCode.trim()}
                        className="w-full"
                      >
                        {isRedeemingAppleCode
                          ? "Redeeming with Apple..."
                          : applyReferralCode.isPending
                            ? "Applying..."
                            : "Apply Code"}
                      </Button>
                      <p className="text-center text-xs text-white/54">
                        Entering a valid creator or Apple offer code unlocks discounted annual pricing.
                      </p>
                      {appleRedemptionFallbackUrl ? (
                        <div className="border border-cyan-100/24 bg-cyan-100/10 p-3 text-center">
                          <p className="text-xs leading-5 text-white/68">
                            If Apple redemption did not appear, open the link below, redeem the code, then return and tap Restore Purchases.
                          </p>
                          <a
                            href={appleRedemptionFallbackUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 underline underline-offset-4"
                          >
                            Open Apple redemption link
                          </a>
                        </div>
                      ) : null}
                    </form>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(["monthly", "yearly"] as PlanType[]).map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                      className={cn(
                        "relative min-h-[124px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100",
                        selectedPlan === plan
                          ? "border-cyan-100 bg-cyan-100/12 shadow-[0_0_34px_rgba(165,243,252,0.16)]"
                          : "border-white/14 bg-white/[0.04] hover:border-white/32",
                      )}
                    >
                      {plans[plan].savings && (
                        <span className="absolute right-2 top-2 bg-cyan-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-950">
                          {plans[plan].savings}
                        </span>
                      )}
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/58">
                        {plans[plan].title}
                      </p>
                      <p className="mt-5 text-2xl font-bold text-white">
                        {getPlanDisplayPrice(plan)}
                      </p>
                      <p className="text-xs text-white/58">
                        {plans[plan].period}
                      </p>
                      <p className="mt-2 text-xs text-white/62">
                        Length: {plans[plan].duration}
                      </p>
                      <p className="text-xs text-white/62">
                        {getPlanUnitPrice(plan)}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="border border-white/12 bg-white/[0.04] p-3 text-xs leading-relaxed text-white/64">
                  <p className="font-semibold text-white">
                    {plans[selectedPlan].title}
                  </p>
                  <p>
                    Length: {plans[selectedPlan].duration}. Price: {selectedPlanRenewalText}
                  </p>
                </div>

                <Button
                  onClick={() => { void handleSubscribe(); }}
                  disabled={purchaseActionDisabled}
                  className="h-14 w-full bg-cyan-100 text-sm font-semibold uppercase tracking-[0.16em] text-slate-950 shadow-[0_18px_44px_rgba(165,243,252,0.18)] hover:bg-white"
                >
                  {loading ? "Processing..." : ctaLabel}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full border-cyan-100/34 bg-cyan-100/10 text-cyan-50 hover:bg-cyan-100/18 hover:text-white"
                >
                  <a
                    href={DISCORD_INVITE_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Join our Discord
                  </a>
                </Button>

                {!isAvailable && (
                  <div className="bg-white/[0.06] p-4">
                    <p className="text-center text-sm text-white/68">
                      In-App Purchases are only available on iOS devices
                    </p>
                  </div>
                )}

                {productsLoading && (
                  <div className="flex items-center gap-2 border border-dashed border-white/22 px-3 py-2 text-sm text-white/64">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                    Contacting the App Store...
                  </div>
                )}

                {productError && (
                  <div className="flex flex-col gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <span>{productError}</span>
                    <div className="flex flex-wrap gap-2">
                      {isSubscriptionAlreadyLinkedError ? (
                        <Button size="sm" variant="outline" onClick={handleSignOut} disabled={isSigningOut}>
                          {isSigningOut ? "Signing out..." : "Sign out"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { void reloadProducts(); }}>
                          Try Again
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleContactSupport}
                      >
                        Contact support
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  variant="ghost"
                  onClick={() => { void handleRestore("paywall"); }}
                  disabled={loading || recoveringExistingSubscription}
                  className="w-full text-white/64 hover:bg-white/8 hover:text-white"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Restore Purchases
                </Button>

                <div className="space-y-2 border-t border-white/12 pt-4">
                  <p className="text-center text-xs leading-relaxed text-white/54">
                    {PREMIUM_PLAN_NOTE}
                  </p>
                  <p className="text-center text-xs leading-relaxed text-white/54">
                    {copy.legalIntro}
                  </p>
                  <p className="text-center text-xs leading-relaxed text-white/54">
                    {PREMIUM_APPLE_BILLING_DISCLOSURE}
                  </p>
                  <div className="flex justify-center gap-4 text-xs">
                    <a
                      href={PREMIUM_SUBSCRIPTION_LEGAL_LINKS.privacy.inAppHref}
                      className="text-white/58 underline hover:text-white"
                    >
                      {PREMIUM_SUBSCRIPTION_LEGAL_LINKS.privacy.label}
                    </a>
                    <a
                      href={PREMIUM_SUBSCRIPTION_LEGAL_LINKS.terms.inAppHref}
                      className="text-white/58 underline hover:text-white"
                    >
                      {PREMIUM_SUBSCRIPTION_LEGAL_LINKS.terms.label}
                    </a>
                    <a
                      href={PREMIUM_SUBSCRIPTION_LEGAL_LINKS.appleEula.publicHref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-white/58 underline hover:text-white"
                    >
                      EULA
                    </a>
                  </div>
                </div>

                <div className="space-y-2 text-center">
                  <p className="text-xs text-white/46">Need another account?</p>
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="h-auto p-0 text-xs text-white/58 hover:text-white"
                    >
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </Button>
                    <span className="text-xs text-white/28">•</span>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="h-auto p-0 text-xs text-white/58 hover:text-destructive"
                    >
                      Delete account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PaywallLandscapeSection>
      </main>

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
                id="paywall-delete-submit-button"
                type="submit"
                variant="destructive"
                onPointerDown={handleDeleteButtonPointerDown}
                disabled={isDeleting || deleteConfirmText !== "DELETE"}
              >
                {isDeleting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
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
