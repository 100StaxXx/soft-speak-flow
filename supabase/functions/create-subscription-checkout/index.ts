import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

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

    const { plan = "monthly" } = await req.json();

    // Validate plan
    if (!["monthly", "yearly"].includes(plan)) {
      throw new Error("Invalid plan");
    }

    // Get or create Stripe customer
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || profile?.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabaseClient
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create price IDs - these need to be created in Stripe Dashboard first
    const PRICE_IDS = {
      monthly: Deno.env.get("STRIPE_MONTHLY_PRICE_ID"),
      yearly: Deno.env.get("STRIPE_YEARLY_PRICE_ID"),
    };

    // If price IDs not set, create prices on-the-fly (for development)
    let priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];

    if (!priceId) {
      // Create product if doesn't exist
      const products = await stripe.products.list({ limit: 1 });
      let productId = products.data[0]?.id;

      if (!productId) {
        const product = await stripe.products.create({
          name: "Soft Speak Flow Premium",
          description: "Access all premium features, mentors, and content",
        });
        productId = product.id;
      }

      // Create price
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: plan === "monthly" ? 999 : 9999, // $9.99 or $99.99
        currency: "usd",
        recurring: {
          interval: plan === "monthly" ? "month" : "year",
          trial_period_days: 7,
        },
      });
      priceId = price.id;
    }

    // Create checkout session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card", "cashapp", "link"],
      // Stripe will automatically detect and show Google Pay and Apple Pay when available
      payment_method_options: {
        card: {
          setup_future_usage: "off_session",
        },
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel",
          },
        },
        metadata: {
          user_id: user.id,
        },
      },
      metadata: {
        user_id: user.id,
      },
      success_url: `${req.headers.get("origin")}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/premium`,
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
