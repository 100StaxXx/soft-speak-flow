import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const { data: subscription, error: subError } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      throw subError;
    }

    if (!subscription) {
      return new Response(
        JSON.stringify({ subscribed: false }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const expiresAt = new Date(subscription.current_period_end);
    // Support active and trialing status
    const isActive = expiresAt > new Date() && 
      (subscription.status === "active" || subscription.status === "trialing");

    return new Response(
      JSON.stringify({
        subscribed: isActive,
        status: subscription.status,
        plan: subscription.plan,
        subscription_end: subscription.current_period_end,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
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
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: statusCode,
      }
    );
  }
});
