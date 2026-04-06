import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

const FUNCTION_TRANSPORT_ERROR_MESSAGES = new Set([
  "failed to send a request to the edge function",
  "edge function returned a non-2xx status code",
]);

const isFunctionTransportErrorMessage = (message: string | null | undefined): boolean => {
  if (typeof message !== "string") return false;

  const normalized = message.trim().toLowerCase();
  return (
    FUNCTION_TRANSPORT_ERROR_MESSAGES.has(normalized) ||
    normalized.includes("functionsfetcherror") ||
    normalized.includes("relay error invoking the edge function")
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

  if (backendMessage && !isFunctionTransportErrorMessage(backendMessage)) {
    return { message: backendMessage, reason };
  }

  if (directMessage && !isFunctionTransportErrorMessage(directMessage)) {
    return { message: directMessage, reason };
  }

  return {
    message: toUserFacingFunctionError(parsed, { action: "redeem your promo code" }),
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
        throw new PromoCodeRedeemError(
          result?.message || "Unable to redeem this promo code.",
          toFailureReason(result?.status),
        );
      }

      return result;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscription"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
      ]);
    },
  });

  return {
    redeemPromoCode,
  };
};
