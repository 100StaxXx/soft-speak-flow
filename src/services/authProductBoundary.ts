import type { Session, User } from "@supabase/supabase-js";
import { PRODUCT_RUNTIME, productScopedStorageKey } from "@/config/productRuntime";
import { supabase } from "@/integrations/supabase/client";
import type { AuthProductMode } from "@/utils/authUser";

export const AUTH_PRODUCT_MISMATCH_EVENT = productScopedStorageKey("auth-product-mismatch");

export type AuthProductBoundaryReason =
  | "no_session"
  | "trusted_binding"
  | "companion_binding"
  | "profile_binding"
  | "legacy_binding"
  | "boundary_lookup_failed"
  | "unscoped_apple_session"
  | "unscoped_non_apple_session";

export interface AuthProductBoundaryResult {
  allowed: boolean;
  expectedProductMode: AuthProductMode;
  actualProductMode: AuthProductMode | null;
  reason: AuthProductBoundaryReason;
}

export const getExpectedAuthProductMode = (): AuthProductMode =>
  PRODUCT_RUNTIME.authProductMode;

const normalizeProductMode = (value: unknown): AuthProductMode | null => {
  if (value === "graceward" || value === "christian") return "graceward";
  if (value === "cosmiq") return "cosmiq";
  return null;
};

const getTrustedProductMode = (user: User): AuthProductMode | null => {
  const metadataMode = normalizeProductMode(
    user.app_metadata?.auth_product_mode,
  );
  if (metadataMode) return metadataMode;

  const audience = user.app_metadata?.apple_audience;
  if (audience === "com.darrylgraham.graceward") return "graceward";
  if (audience === "com.darrylgraham.revolution") return "cosmiq";
  return null;
};

const isAppleUser = (user: User): boolean => {
  if (user.app_metadata?.provider === "apple") return true;
  if (
    Array.isArray(user.app_metadata?.providers) &&
    user.app_metadata.providers.includes("apple")
  ) {
    return true;
  }

  return (
    Array.isArray(user.identities) &&
    user.identities.some((identity) => identity.provider === "apple")
  );
};

const result = (
  allowed: boolean,
  expectedProductMode: AuthProductMode,
  actualProductMode: AuthProductMode | null,
  reason: AuthProductBoundaryReason,
): AuthProductBoundaryResult => ({
  allowed,
  expectedProductMode,
  actualProductMode,
  reason,
});

export const validateSessionProductBoundary = async (
  session: Session | null,
): Promise<AuthProductBoundaryResult> => {
  const expectedProductMode = getExpectedAuthProductMode();
  if (!session?.user) {
    return result(true, expectedProductMode, null, "no_session");
  }

  const trustedProductMode = getTrustedProductMode(session.user);
  if (trustedProductMode) {
    return result(
      trustedProductMode === expectedProductMode,
      expectedProductMode,
      trustedProductMode,
      "trusted_binding",
    );
  }

  try {
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("product_mode, preset_id")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (companionError) {
      console.warn("Unable to check the companion product boundary", companionError);
      return result(false, expectedProductMode, null, "boundary_lookup_failed");
    }

    const companionProductMode =
      normalizeProductMode(companion?.product_mode) ??
      (companion?.preset_id ? "cosmiq" : null);
    if (companionProductMode) {
      return result(
        companionProductMode === expectedProductMode,
        expectedProductMode,
        companionProductMode,
        "companion_binding",
      );
    }
  } catch (error) {
    console.warn("Unable to check the companion product boundary", error);
    return result(false, expectedProductMode, null, "boundary_lookup_failed");
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) {
      console.warn("Unable to check the profile product boundary", profileError);
      return result(false, expectedProductMode, null, "boundary_lookup_failed");
    }

    const onboardingData = profile?.onboarding_data;
    const profileProductMode =
      onboardingData &&
      typeof onboardingData === "object" &&
      !Array.isArray(onboardingData)
        ? normalizeProductMode(
            (onboardingData as Record<string, unknown>).product_mode,
          )
        : null;
    if (profileProductMode) {
      return result(
        profileProductMode === expectedProductMode,
        expectedProductMode,
        profileProductMode,
        "profile_binding",
      );
    }
  } catch (error) {
    console.warn("Unable to check the profile product boundary", error);
    return result(false, expectedProductMode, null, "boundary_lookup_failed");
  }

  // A native Apple session created by apple-native-auth always has a trusted
  // product binding. An unbound Apple session came through the shared web OAuth
  // path, so Graceward must fail closed instead of treating a Cosmiq identity as
  // a new Graceward account. Cosmiq remains the legacy default for old sessions.
  if (isAppleUser(session.user)) {
    return result(
      expectedProductMode === "cosmiq",
      expectedProductMode,
      expectedProductMode === "cosmiq" ? "cosmiq" : null,
      "unscoped_apple_session",
    );
  }

  // User metadata is intentionally not accepted as a product binding because
  // account holders can edit it themselves. Password accounts created by the
  // auth gateway receive trusted app metadata; genuinely unscoped legacy
  // accounts must have a matching companion or profile binding above.
  return result(false, expectedProductMode, null, "unscoped_non_apple_session");
};

export const announceAuthProductMismatch = (
  boundary: AuthProductBoundaryResult,
): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUTH_PRODUCT_MISMATCH_EVENT, {
      detail: boundary,
    }),
  );
};
