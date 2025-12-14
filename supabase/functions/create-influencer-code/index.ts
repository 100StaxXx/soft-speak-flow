import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Create Influencer Referral Code
 * 
 * Public endpoint (no auth required) for influencers to generate referral codes.
 * Creates a code and stores payout information for future reward payments.
 * 
 * Request body:
 * {
 *   name: string - Influencer's name
 *   email: string - Contact email
 *   handle: string - Social media handle (e.g., @username)
 *   paypal_email: string - PayPal email for payouts
 *   promotion_channel?: string - Where they'll promote (optional)
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCodeFromHandle(handle: string): string {
  // Remove @ and special chars, uppercase
  const clean = handle.replace(/[@\s-]/g, "").toUpperCase();
  // Take first 8 chars and add random suffix
  const base = clean.substring(0, 8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `COSMIQ-${base}${random}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { name, email, handle, paypal_email, promotion_channel } = await req.json();

    // Validate required fields
    if (!name || !email || !handle || !paypal_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, handle, paypal_email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || !emailRegex.test(paypal_email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if influencer already has a code
    const { data: existingCode } = await supabaseClient
      .from("referral_codes")
      .select("code")
      .eq("influencer_email", email)
      .eq("owner_type", "influencer")
      .maybeSingle();

    if (existingCode) {
      // Return existing code instead of creating duplicate
      const appUrl = Deno.env.get("APP_URL") || "https://cosmiq.app";
      const appLink = `${appUrl}/?ref=${existingCode.code}`;
      return new Response(
        JSON.stringify({
          code: existingCode.code,
          link: appLink,
          message: "You already have a referral code. Here it is!",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate code from handle
    let code = generateCodeFromHandle(handle);
    
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabaseClient
        .from("referral_codes")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      
      if (!existing) break;
      
      // Regenerate with different random suffix
      code = generateCodeFromHandle(handle + Math.random().toString());
      attempts++;
    }

    // Create influencer referral code
    const { data: newCode, error: insertError } = await supabaseClient
      .from("referral_codes")
      .insert({
        code,
        owner_type: "influencer",
        influencer_name: name,
        influencer_email: email,
        influencer_handle: handle,
        payout_method: "paypal",
        payout_identifier: paypal_email,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create influencer code:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create referral code" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use environment variable or fallback to default
    const appUrl = Deno.env.get("APP_URL") || "https://cosmiq.app";
    const appLink = `${appUrl}/?ref=${code}`;

    console.log(`Created influencer code for ${name} (@${handle}): ${code}`);

    return new Response(
      JSON.stringify({
        code,
        link: appLink,
        promo_caption: `✨ Transform your habits into an epic journey! Use my code ${code} or click: ${appLink}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating influencer code:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
