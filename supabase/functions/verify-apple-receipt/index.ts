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
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
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

  // Determine plan from product ID
  let plan = "monthly";
  if (productId.includes("yearly") || productId.includes("annual")) {
    plan = "yearly";
  }

  // Check if this transaction was already processed (prevent duplicates)
  const { data: existingPayment } = await supabase
    .from("payment_history")
    .select("id")
    .eq("stripe_payment_intent_id", originalTransactionId)
    .single();

  // Update subscriptions table
  await supabase.from("subscriptions").upsert({
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
  });

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
      stripe_payment_intent_id: originalTransactionId,
      stripe_invoice_id: latestReceipt.transaction_id,
      amount: 999, // $9.99 in cents - should be retrieved from product info
      currency: "usd",
      status: "succeeded",
      created_at: purchaseDate.toISOString(),
    });
  }
}
