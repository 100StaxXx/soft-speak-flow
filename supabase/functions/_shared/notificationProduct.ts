import type { NotificationProductMode as OAuthProductMode } from "./notificationComposer.ts";

export const ACCOUNT_PRODUCT_MISMATCH_ERROR =
  "This account belongs to the other app.";
export const REDIRECT_PRODUCT_MISMATCH_ERROR =
  "This redirect URI belongs to the other app.";

export function getTrustedAuthProductMode(user: any): OAuthProductMode | null {
  const mode = user?.app_metadata?.auth_product_mode;
  return mode === "graceward" || mode === "cosmiq" ? mode : null;
}

export async function resolveUserProductMode(
  supabaseAdmin: any,
  userId: string,
): Promise<OAuthProductMode> {
  const { data: userData, error: userError } = typeof supabaseAdmin?.auth?.admin?.getUserById === "function"
    ? await supabaseAdmin.auth.admin.getUserById(userId)
    : { data: null, error: null };
  if (userError) {
    throw new Error(`Unable to resolve trusted account product: ${userError.message ?? "unknown error"}`);
  }
  const trustedMode = getTrustedAuthProductMode(userData?.user);
  if (trustedMode) return trustedMode;

  const [companionResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from("user_companion")
      .select("product_mode, preset_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("onboarding_data")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (companionResult.error) {
    throw new Error(
      `Unable to resolve companion product binding: ${companionResult.error.message ?? "unknown error"}`,
    );
  }
  if (profileResult.error) {
    throw new Error(
      `Unable to resolve profile product binding: ${profileResult.error.message ?? "unknown error"}`,
    );
  }

  const companion = companionResult.data;
  const profile = profileResult.data;

  if (companion?.product_mode === "graceward" || companion?.product_mode === "cosmiq") {
    return companion.product_mode;
  }
  if (companion?.preset_id) return "cosmiq";

  const profileMode = profile?.onboarding_data?.product_mode;
  if (profileMode === "graceward" || profileMode === "christian") return "graceward";
  if (profileMode === "cosmiq") return "cosmiq";

  // Cosmiq is the pre-split legacy product. A missing binding must never cause
  // legacy users to receive Graceward-specific guidance by default.
  return "cosmiq";
}

/** Share only within a worker run; failed lookups must never choose a template. */
export function createNotificationProductResolver(supabaseAdmin: any) {
  const pending = new Map<string, Promise<OAuthProductMode>>();
  return (userId: string): Promise<OAuthProductMode> => {
    if (!pending.has(userId)) pending.set(userId, resolveUserProductMode(supabaseAdmin, userId));
    return pending.get(userId)!;
  };
}
