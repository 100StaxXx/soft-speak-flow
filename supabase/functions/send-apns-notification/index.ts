import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { sendAPNSNotification } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const APNsPayloadSchema = z.object({
  deviceToken: z.string().min(64).max(200).regex(/^[a-fA-F0-9]+$/, "Invalid device token format"),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  data: z.record(z.any()).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    if (!internalSecret) {
      throw new Error("INTERNAL_FUNCTION_SECRET is not configured");
    }

    const providedSecret = req.headers.get("x-internal-key");
    if (providedSecret !== internalSecret) {
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        void supabase.from("security_audit_log").insert({
          event_type: "auth_failure",
          function_name: "send-apns-notification",
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown",
          user_agent: req.headers.get("user-agent") || "unknown",
          details: { reason: "Invalid internal key" },
        });
      }

      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const rawBody = await req.json();
    const parseResult = APNsPayloadSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid payload",
          details: parseResult.error.errors.map((error) => error.message),
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    const { deviceToken, title, body, data } = parseResult.data;
    const result = await sendAPNSNotification(deviceToken, { title, body, data });

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "APNs request failed",
          status: result.status,
          reason: result.reason,
          terminal: result.terminal,
          rawResponse: result.rawResponse,
        }),
        {
          status: result.terminal ? 400 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
