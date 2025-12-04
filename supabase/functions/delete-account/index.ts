import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return unauthorizedResponse("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const authedClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authedClient.auth.getUser();

    if (userError || !user) {
      console.error("delete-account: unable to resolve user", userError);
      return unauthorizedResponse("Unauthorized");
    }

    const body = await req
      .json()
      .catch(() => ({} as Record<string, unknown>));

    const reason =
      typeof body.reason === "string" ? body.reason.slice(0, 2000) : null;
    const confirmation = typeof body.confirmation === "string"
      ? body.confirmation.trim().toUpperCase()
      : "";
    const acknowledged = body.acknowledged === true;
    const platform =
      typeof body.platform === "string" ? body.platform.slice(0, 120) : null;
    const appVersion =
      typeof body.appVersion === "string" ? body.appVersion.slice(0, 64) : null;

    if (confirmation !== "DELETE") {
      return validationError("Confirmation phrase did not match.");
    }

    if (!acknowledged) {
      return validationError("You must acknowledge the permanence of deletion.");
    }

    const { data: requestLog, error: logError } = await adminClient
      .from("account_deletion_requests")
      .insert({
        user_id: user.id,
        user_email: user.email,
        reason,
        status: "processing",
        platform,
        app_version: appVersion,
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError || !requestLog) {
      console.error("delete-account: failed to log request", logError);
      throw new Error("Unable to record deletion request");
    }

    try {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(
        user.id,
      );

      if (deleteError) {
        throw deleteError;
      }

      await adminClient
        .from("account_deletion_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", requestLog.id);

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("delete-account: deletion failed", error);
      await adminClient
        .from("account_deletion_requests")
        .update({
          status: "failed",
          notes: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", requestLog.id);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : 500;

    console.error("delete-account: unexpected error", error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function unauthorizedResponse(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validationError(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
