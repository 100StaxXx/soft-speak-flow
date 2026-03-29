import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const redeemPromoCode = useMutation({
    mutationFn: async (rawCode: string) => {
      if (!user) {
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
      });

      if (error) {
        let backendMessage =
          (error as { message?: string }).message ||
          "Unable to redeem promo code right now. Please try again.";
        let failureReason: PromoCodeFailureReason = "unknown";

        const errorWithContext = error as { context?: Response };
        if (errorWithContext.context instanceof Response) {
          try {
            const errorPayload = await errorWithContext.context.json() as Partial<PromoCodeRpcResult> | null;
            backendMessage = errorPayload?.message || backendMessage;
            failureReason = toFailureReason(errorPayload?.status);
          } catch {
            if (errorWithContext.context.status === 429) {
              backendMessage = "Too many promo redemption attempts. Please try again later.";
              failureReason = "rate_limited";
            }
          }
        }

        throw new PromoCodeRedeemError(backendMessage, failureReason);
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
