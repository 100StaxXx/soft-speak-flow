import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

/**
 * Check Apple Subscription Status
 * 
 * This function checks if a user has an active paid subscription.
 * 
 * IMPORTANT: This function ONLY checks for PAID subscriptions, NOT trials.
 * Trial access is determined client-side based on profiles.trial_ends_at.
 * 
 * User Access Hierarchy:
 * 1. Active Subscription (this function returns true) -> Premium Access
 * 2. Trial Active (trial_ends_at > NOW) -> Premium Access
 * 3. No Subscription + Trial Expired -> Limited/Free Access (paywall shown)
 * 
 * This separation allows:
 * - Trials to work without backend subscription records
 * - Easy trial -> subscription transitions
 * - Clear separation of concerns
 */
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
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get subscription from database
    // NOTE: A missing subscription record means user is NOT subscribed (may still be in trial)
    const { data: subscription, error: subError } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      throw subError;
    }

    if (!subscription) {
      // No subscription record = user is not subscribed (might be in trial or free tier)
      return jsonResponse(req, { subscribed: false });
    }

    const expiresAt = new Date(subscription.current_period_end);
    // Check if subscription is active and not expired
    // Note: "trialing" status here refers to Apple IAP trial (different from our 7-day trial)
    const isActive = expiresAt > new Date() && 
      (subscription.status === "active" || subscription.status === "trialing");

    return jsonResponse(req, {
      subscribed: isActive,
      status: subscription.status,
      plan: subscription.plan,
      subscription_end: subscription.current_period_end,
    });
  } catch (error) {
    console.error("Error checking subscription:", error);
    
    // Determine appropriate status code based on error message
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
