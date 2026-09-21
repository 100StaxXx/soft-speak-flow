import type { User } from "@supabase/supabase-js";
import type { AuthProductMode } from "@/config/productRuntime";

export type { AuthProductMode } from "@/config/productRuntime";

export const getAuthUserAccountEmail = (
  user: User | null | undefined,
): string | null => {
  const trustedMetadataEmail = user?.app_metadata?.account_email;
  if (
    typeof trustedMetadataEmail === "string" &&
    trustedMetadataEmail.trim().length > 0
  ) {
    return trustedMetadataEmail.trim().toLowerCase();
  }

  const authEmail = user?.email;
  return typeof authEmail === "string" && authEmail.trim().length > 0
    ? authEmail.trim().toLowerCase()
    : null;
};

export const getAuthUserProductMode = (
  user: User | null | undefined,
): AuthProductMode | null => {
  const trustedProductMode = user?.app_metadata?.auth_product_mode;
  if (trustedProductMode === "graceward" || trustedProductMode === "cosmiq") {
    return trustedProductMode;
  }

  const trustedAudience = user?.app_metadata?.apple_audience;
  if (trustedAudience === "com.darrylgraham.graceward") return "graceward";
  if (trustedAudience === "com.darrylgraham.revolution") return "cosmiq";

  return null;
};
