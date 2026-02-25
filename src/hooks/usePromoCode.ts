import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type PromoCodeFailureReason =
  | "invalid"
  | "used"
  | "expired"
  | "unauthorized"
  | "already_active"
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

      const { data, error } = await (supabase.rpc as any)(
        "redeem_promo_code_secure",
        {
          p_user_id: user.id,
          p_promo_code: normalizedCode,
        },
      ) as { data: PromoCodeRpcResult[] | PromoCodeRpcResult | null; error: Error | null };

      if (error) {
        const backendMessage =
          (error as { message?: string }).message ||
          "Unable to redeem promo code right now. Please try again.";
        throw new PromoCodeRedeemError(backendMessage, "unknown");
      }

      const result = (Array.isArray(data) ? data[0] : data) as PromoCodeRpcResult | undefined;
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
