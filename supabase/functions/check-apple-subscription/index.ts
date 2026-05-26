import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  buildAccessStateResponse,
  fetchAccountEntitlementForUser,
} from "../_shared/accountEntitlements.ts";
import {
  buildPromoSubscriptionResponse,
  buildSubscriptionResponse,
  fetchActivePromoAccessForUser,
  fetchSubscriptionForUser,
} from "../_shared/appleSubscriptions.ts";

type SupabaseClient = any;

type ProfileAccessSnapshot = {
  onboarding_completed?: boolean | null;
  onboarding_step?: string | null;
  onboarding_data?: Record<string, unknown> | null;
};

const completedOnboardingNoAccessResponse = {
  has_access: false,
  access_source: "manual" as const,
  trial_ends_at: null,
  subscribed: false,
  status: "inactive" as const,
  plan: undefined,
  subscription_end: undefined,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasCompletedOnboarding(
  profile: ProfileAccessSnapshot | null,
): boolean {
  if (!profile) return false;

  const onboardingData = isRecord(profile.onboarding_data)
    ? profile.onboarding_data
    : {};

  return (
    profile.onboarding_completed === true &&
    profile.onboarding_step === "complete" &&
    onboardingData.walkthrough_completed === true
  );
}

export function buildCompletedOnboardingNoAccessResponse(
  profile: ProfileAccessSnapshot | null,
) {
  return hasCompletedOnboarding(profile)
    ? completedOnboardingNoAccessResponse
    : null;
}

async function fetchProfileAccessSnapshotForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileAccessSnapshot | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed, onboarding_step, onboarding_data")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function handleCheckAppleSubscription(req: Request) {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return jsonResponse(req, buildAccessStateResponse(null));
    }

    const entitlement = await fetchAccountEntitlementForUser(
      supabaseClient,
      user.id,
    );
    const entitlementResponse = buildAccessStateResponse(entitlement);
    if (entitlementResponse.has_access) {
      return jsonResponse(req, entitlementResponse);
    }
    const hasInactiveSubscriptionEntitlement =
      entitlement?.source === "subscription";

    const subscription = await fetchSubscriptionForUser(
      supabaseClient,
      user.id,
    );
    const subscriptionResponse = buildSubscriptionResponse(subscription);
    if (
      subscriptionResponse.has_access && !hasInactiveSubscriptionEntitlement
    ) {
      return jsonResponse(req, subscriptionResponse);
    }

    const promoAccess = await fetchActivePromoAccessForUser(
      supabaseClient,
      user.id,
    );
    if (promoAccess?.granted_until) {
      return jsonResponse(
        req,
        buildPromoSubscriptionResponse(promoAccess.granted_until),
      );
    }

    if (hasInactiveSubscriptionEntitlement) {
      return jsonResponse(req, entitlementResponse);
    }

    if (!entitlement && !subscription) {
      const profile = await fetchProfileAccessSnapshotForUser(
        supabaseClient,
        user.id,
      );
      const completedNoAccessResponse =
        buildCompletedOnboardingNoAccessResponse(profile);
      if (completedNoAccessResponse) {
        return jsonResponse(req, completedNoAccessResponse);
      }
    }

    return jsonResponse(
      req,
      entitlement ? entitlementResponse : subscriptionResponse,
    );
  } catch (error) {
    console.error("Error checking subscription:", error);

    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    let statusCode = 500;

    if (errorMessage === "Unauthorized") {
      statusCode = 401;
    } else if (errorMessage.includes("not found")) {
      statusCode = 404;
    } else if (
      errorMessage.includes("invalid") || errorMessage.includes("required")
    ) {
      statusCode = 400;
    }

    return errorResponse(req, errorMessage, statusCode);
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleCheckAppleSubscription(req));
}
