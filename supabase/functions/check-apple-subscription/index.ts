import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  fetchSubscriptionForUser,
  buildSubscriptionResponse,
  fetchActivePromoAccessForUser,
  buildPromoSubscriptionResponse,
} from "../_shared/appleSubscriptions.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(req, { subscribed: false });
    }

    const subscription = await fetchSubscriptionForUser(supabaseClient, user.id);
    const subscriptionResponse = buildSubscriptionResponse(subscription);
    if (subscriptionResponse.subscribed) {
      return jsonResponse(req, subscriptionResponse);
    }

    const promoAccess = await fetchActivePromoAccessForUser(supabaseClient, user.id);
    if (promoAccess?.granted_until) {
      return jsonResponse(req, buildPromoSubscriptionResponse(promoAccess.granted_until));
    }

    return jsonResponse(req, subscriptionResponse);
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
});
