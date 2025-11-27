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
    // Use service role key for database writes (RLS policies require service_role)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from the request Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    // Create a separate client with anon key to verify the user token
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
    } = await anonClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { receipt } = await req.json();

    if (!receipt) {
      throw new Error("Receipt data required");
    }

    // Verify receipt with Apple
    // Production: https://buy.itunes.apple.com/verifyReceipt
    // Sandbox: https://sandbox.itunes.apple.com/verifyReceipt
    const verifyUrl = "https://buy.itunes.apple.com/verifyReceipt";
    
    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "receipt-data": receipt,
        password: Deno.env.get("APPLE_SHARED_SECRET"),
        "exclude-old-transactions": true,
      }),
    });

    const verifyData = await verifyResponse.json();

    // If production verification fails with 21007, try sandbox
    if (verifyData.status === 21007) {
      const sandboxResponse = await fetch("https://sandbox.itunes.apple.com/verifyReceipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "receipt-data": receipt,
          password: Deno.env.get("APPLE_SHARED_SECRET"),
          "exclude-old-transactions": true,
        }),
      });
      const sandboxData = await sandboxResponse.json();
      
      if (sandboxData.status === 0) {
        await updateSubscription(supabaseClient, user.id, sandboxData);
        return new Response(JSON.stringify({ success: true, data: sandboxData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (verifyData.status === 0) {
      await updateSubscription(supabaseClient, user.id, verifyData);
      return new Response(JSON.stringify({ success: true, data: verifyData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Receipt verification failed: ${verifyData.status}`);
  } catch (error: any) {
    console.error("Error verifying receipt:", error);
    
    // Determine appropriate status code
    let statusCode = 500;
    if (error.message === "Unauthorized") {
      statusCode = 401;
    } else if (error.message?.includes("not found")) {
      statusCode = 404;
    } else if (error.message?.includes("invalid") || error.message?.includes("required")) {
      statusCode = 400;
    }
    
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: statusCode,
      }
    );
  }
});

async function updateSubscription(supabase: any, userId: string, receiptData: any) {
  const latestReceipt = receiptData.latest_receipt_info?.[0];
  
  if (!latestReceipt) {
    throw new Error("No subscription info in receipt");
  }

  const expiresDate = new Date(parseInt(latestReceipt.expires_date_ms));
  const purchaseDate = new Date(parseInt(latestReceipt.purchase_date_ms));
  const isActive = expiresDate > new Date();
  const productId = latestReceipt.product_id;
  const originalTransactionId = latestReceipt.original_transaction_id;

  // SECURITY: Check if this receipt is already registered to another user (prevent hijacking)
  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", originalTransactionId)
    .maybeSingle();
  
  if (existingSubscription && existingSubscription.user_id !== userId) {
    throw new Error("This receipt is already registered to another account");
  }

  // Determine plan from product ID
  let plan = "monthly";
  if (productId.includes("yearly") || productId.includes("annual")) {
    plan = "yearly";
  }

  // Determine correct payment amount based on plan
  let amount = 999; // Default $9.99 monthly in cents
  if (plan === "yearly") {
    amount = 9999; // $99.99 yearly in cents
  }

  // Check if this transaction was already processed (prevent duplicates)
  const { data: existingPayment } = await supabase
    .from("payment_history")
    .select("id")
    .eq("stripe_payment_intent_id", originalTransactionId)
    .maybeSingle();

  // Update subscriptions table
  const { data: updatedSubscription } = await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: originalTransactionId,
    stripe_customer_id: originalTransactionId,
    plan,
    status: isActive ? "active" : "cancelled",
    current_period_start: purchaseDate.toISOString(),
    current_period_end: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "user_id"
  }).select().single();

  // Update profile
  await supabase.from("profiles").update({
    is_premium: isActive,
    subscription_status: isActive ? "active" : "cancelled",
    subscription_expires_at: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  // Log payment only if not already processed
  if (!existingPayment) {
    await supabase.from("payment_history").insert({
      user_id: userId,
      subscription_id: updatedSubscription?.id, // Link to subscription
      stripe_payment_intent_id: originalTransactionId,
      stripe_invoice_id: latestReceipt.transaction_id,
      amount: amount, // Correct amount based on plan
      currency: "usd",
      status: "succeeded",
      created_at: purchaseDate.toISOString(),
    });
  }
}
