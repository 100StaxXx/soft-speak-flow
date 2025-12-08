import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      throw userError;
    }

    const user = userResult?.user;
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const { error: deleteDataError } = await supabase.rpc("delete_user_account", { p_user_id: userId });
    if (deleteDataError) {
      throw deleteDataError;
    }

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      throw authDeleteError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-user-account edge function error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;

    const errorPayload: Record<string, unknown> = {
      success: false,
      error: message,
    };

    if (typeof error === "object" && error !== null) {
      const maybeCode = (error as { code?: unknown }).code;
      if (typeof maybeCode === "string" && maybeCode.length > 0) {
        errorPayload.code = maybeCode;
      }

      const maybeDetails = (error as { details?: unknown }).details;
      if (typeof maybeDetails === "string" && maybeDetails.length > 0) {
        errorPayload.details = maybeDetails;
      }
    }

    return new Response(JSON.stringify(errorPayload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
