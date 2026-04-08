import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "./useAuth";
import {
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";

export type PromoCodeFailureReason =
  | "invalid"
  | "used"
  | "expired"
  | "unauthorized"
  | "already_active"
  | "rate_limited"
  | "unknown";
type PromoCodeRpcResult = {
  success: boolean;
  status: string;
  message: string;
  access_expires_at: string | null;
};

export class PromoCodeRedeemError extends Error {
  reason: PromoCodeFailureReason;

  constructor(message: string, reason: PromoCodeFailureReason) {
    super(message);
    this.name = "PromoCodeRedeemError";
    this.reason = reason;
  }
}

const SAFE_PROMO_FAILURE_REASONS = new Set<PromoCodeFailureReason>([
  "invalid",
  "used",
  "expired",
  "already_active",
  "rate_limited",
]);

const isTechnicalPromoMessage = (message: string | null | undefined): boolean => {
  if (typeof message !== "string") return false;

  const normalized = message.trim().toLowerCase();
  return (
    normalized === "failed to send a request to the edge function" ||
    normalized === "edge function returned a non-2xx status code" ||
    normalized.includes("functionsfetcherror") ||
    normalized.includes("relay error invoking the edge function") ||
    normalized.includes("missing authorization header") ||
    normalized.includes("auth configuration missing") ||
    normalized.includes("unauthorized") ||
    normalized.includes("internal server error")
  );
};

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return undefined;
};

const getPromoCodeFallbackMessage = (reason: PromoCodeFailureReason): string => {
  switch (reason) {
    case "unauthorized":
      return "Your session has expired. Please sign in again and try to redeem your promo code.";
    case "rate_limited":
      return "You're making requests too quickly. Please wait a moment and try again.";
    default:
      return "Unable to redeem your promo code. Please try again.";
  }
};

const getSafePromoBusinessMessage = (
  message: string | null | undefined,
  reason: PromoCodeFailureReason,
): string | null => {
  if (!message || !SAFE_PROMO_FAILURE_REASONS.has(reason) || isTechnicalPromoMessage(message)) {
    return null;
  }

  return message;
};

const getPromoCodeRedeemErrorDetails = async (error: unknown): Promise<{
  message: string;
  reason: PromoCodeFailureReason;
}> => {
  const parsed = await parseFunctionInvokeError(error);
  const directMessage = getErrorMessage(error)?.trim();
  const backendMessage = parsed.backendMessage?.trim();

  const reasonFromPayload = toFailureReason(parsed.responsePayload?.status);
  let reason = reasonFromPayload;

  if (reason === "unknown") {
    if (parsed.category === "auth") {
      reason = "unauthorized";
    } else if (parsed.category === "rate_limit") {
      reason = "rate_limited";
    }
  }

  const safeBackendMessage = getSafePromoBusinessMessage(backendMessage, reason);
  if (safeBackendMessage) {
    return { message: safeBackendMessage, reason };
  }

  const safeDirectMessage = getSafePromoBusinessMessage(directMessage, reason);
  if (safeDirectMessage) {
    return { message: safeDirectMessage, reason };
  }

  const shouldForceFriendlyMessage =
    parsed.category === "network" ||
    parsed.category === "relay" ||
    parsed.category === "auth" ||
    (typeof parsed.status === "number" && parsed.status >= 500);

  if (shouldForceFriendlyMessage) {
    return {
      message: toUserFacingFunctionError(
        isTechnicalPromoMessage(parsed.backendMessage)
          ? { ...parsed, backendMessage: undefined }
          : parsed,
        { action: "redeem your promo code" },
      ),
      reason,
    };
  }

  return {
    message: getPromoCodeFallbackMessage(reason),
    reason,
  };
};

const toFailureReason = (status: string | null | undefined): PromoCodeFailureReason => {
  switch (status) {
    case "invalid":
    case "used":
    case "expired":
    case "unauthorized":
    case "already_active":
    case "rate_limited":
      return status;
    default:
      return "unknown";
  }
};

export const usePromoCode = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();

  const redeemPromoCode = useMutation({
    mutationFn: async (rawCode: string) => {
      if (!user || !session?.access_token) {
        throw new PromoCodeRedeemError("You must be signed in to redeem a promo code.", "unauthorized");
      }

      const normalizedCode = rawCode.trim().toUpperCase();
      if (!normalizedCode) {
        throw new PromoCodeRedeemError("Enter a promo code.", "invalid");
      }

      const { data, error } = await supabase.functions.invoke("redeem-promo-code", {
        body: {
          promoCode: normalizedCode,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        const promoError = await getPromoCodeRedeemErrorDetails(error);
        throw new PromoCodeRedeemError(promoError.message, promoError.reason);
      }

      const result = data as PromoCodeRpcResult | undefined;
      if (!result?.success) {
        const failureReason = toFailureReason(result?.status);
        throw new PromoCodeRedeemError(
          getSafePromoBusinessMessage(result?.message, failureReason) ?? getPromoCodeFallbackMessage(failureReason),
          failureReason,
        );
      }

      return result;
    },
    onSuccess: async () => {
      if (!user?.id) return;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.access.detail(user.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.all }),
      ]);
    },
  });

  return {
    redeemPromoCode,
  };
};
