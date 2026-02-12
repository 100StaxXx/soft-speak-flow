// Edge function for account deletion - v2.1
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Sanitize error messages for client responses
 * Logs full error server-side, returns generic message to client
 */
function sanitizeError(error: unknown): { message: string; status: number } {
  // Log full error details server-side for debugging
  console.error("Full error details:", error);
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Authorization errors - safe to indicate
    if (msg.includes("unauthorized") || msg.includes("invalid token") || msg.includes("jwt")) {
      return { message: "Unauthorized", status: 401 };
    }
    
    // Permission errors
    if (msg.includes("permission denied") || msg.includes("access denied")) {
      return { message: "Access denied", status: 403 };
    }
    
    // Not found
    if (msg.includes("not found") || msg.includes("no rows")) {
      return { message: "User not found", status: 404 };
    }
  }
  
  // Generic error for everything else - don't leak internal details
  return { message: "An error occurred during account deletion. Please try again.", status: 500 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

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
      console.error("Missing Supabase environment variables");
      throw new Error("Server configuration error");
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
    console.error("delete-user edge function error", error);
    const { message, status } = sanitizeError(error);

    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
