import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  buildAccessStateResponse,
  fetchAccountEntitlementForUser,
} from "../_shared/accountEntitlements.ts";
import {
  fetchSubscriptionForUser,
  buildSubscriptionResponse,
  fetchActivePromoAccessForUser,
  buildPromoSubscriptionResponse,
} from "../_shared/appleSubscriptions.ts";

type CheckAppleSubscriptionDeps = {
  createSupabaseClient?: typeof createClient;
};

const defaultDeps: Required<CheckAppleSubscriptionDeps> = {
  createSupabaseClient: createClient,
};

export async function handleCheckAppleSubscription(
  req: Request,
  deps: CheckAppleSubscriptionDeps = defaultDeps,
) {
  const { createSupabaseClient } = { ...defaultDeps, ...deps };

  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    const supabaseClient = createSupabaseClient(
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

    const entitlement = await fetchAccountEntitlementForUser(supabaseClient, user.id);
    const entitlementResponse = entitlement ? buildAccessStateResponse(entitlement) : null;
    if (entitlementResponse?.has_access) {
      return jsonResponse(req, entitlementResponse);
    }

    const subscription = await fetchSubscriptionForUser(supabaseClient, user.id);
    const subscriptionResponse = buildSubscriptionResponse(subscription);
    if (subscriptionResponse.has_access) {
      return jsonResponse(req, subscriptionResponse);
    }

    const promoAccess = await fetchActivePromoAccessForUser(supabaseClient, user.id);
    if (promoAccess?.granted_until) {
      return jsonResponse(req, buildPromoSubscriptionResponse(promoAccess.granted_until));
    }

    return jsonResponse(req, entitlementResponse ?? subscriptionResponse);
  } catch (error) {
    console.error("Error checking subscription:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    let statusCode = 500;

    if (errorMessage === "Unauthorized") {
      statusCode = 401;
    } else if (errorMessage.includes("not found")) {
      statusCode = 404;
    } else if (errorMessage.includes("invalid") || errorMessage.includes("required")) {
      statusCode = 400;
    }

    return errorResponse(req, errorMessage, statusCode);
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleCheckAppleSubscription(req));
}
