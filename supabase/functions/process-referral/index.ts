import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Process Referral Code
 * 
 * Called after user signup when a referral code was used.
 * Records the signup and increments tracking metrics.
 * 
 * SECURITY: Requires authentication - validates the caller owns the user_id
 * 
 * Request body:
 * {
 *   referral_code: string - The referral code used
 *   source_app: string - Which app the signup came from (optional)
 * }
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    // SECURITY: Require authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Unauthorized: Missing authorization header" 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create authenticated client to get user
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Unauthorized: Invalid or expired token" 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use authenticated user's ID - don't trust client-provided user_id
    const user_id = user.id;

    // Service role client for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { referral_code, source_app } = await req.json();

    // Validate required fields
    if (!referral_code) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Missing required field: referral_code" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate referral code format (alphanumeric with hyphens, max 20 chars)
    const codePattern = /^[A-Za-z0-9-]{1,20}$/;
    if (!codePattern.test(referral_code)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid referral code format" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate and retrieve referral code
    const { data: codeData, error: codeError } = await supabaseClient
      .from("referral_codes")
      .select("id, code, owner_type, is_active, owner_user_id")
      .eq("code", referral_code.toUpperCase())
      .single();

    if (codeError || !codeData) {
      console.error(`Invalid referral code: ${referral_code}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid or inactive referral code" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!codeData.is_active) {
      console.error(`Referral code inactive: ${referral_code}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Referral code is not active" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent self-referral
    if (codeData.owner_user_id === user_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Cannot use your own referral code" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get current signup count and increment it
    const { data: currentData } = await supabaseClient
      .from("referral_codes")
      .select("total_signups")
      .eq("id", codeData.id)
      .single();

    const newSignupCount = (currentData?.total_signups || 0) + 1;

    // Update with incremented value
    const { error: updateError } = await supabaseClient
      .from("referral_codes")
      .update({ 
        total_signups: newSignupCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", codeData.id);

    if (updateError) {
      console.error(`Failed to increment signups for code ${referral_code}:`, updateError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to record signup" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Recorded signup for user ${user_id} with referral code ${referral_code} from ${source_app || 'unknown'}`);

    return new Response(
      JSON.stringify({
        success: true,
        referral_code_id: codeData.id,
        owner_type: codeData.owner_type,
        message: "Referral tracked successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error processing referral:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
