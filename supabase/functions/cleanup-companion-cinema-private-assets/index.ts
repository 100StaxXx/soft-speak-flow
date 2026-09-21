import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { cleanupExpiredPrivateCinemaAssets } from "../process-companion-cinema-event/index.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Content-Type": "application/json",
};

export const handleCleanupCompanionCinemaPrivateAssets = async (
  req: Request,
): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET")?.trim();
  if (
    !internalSecret || req.headers.get("x-internal-key") !== internalSecret
  ) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers,
    });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const cleanup = await cleanupExpiredPrivateCinemaAssets({
      supabase,
      olderThanHours: Number(
        Deno.env.get("COSMIQ_CINEMA_PRIVATE_RETENTION_HOURS") ?? 24,
      ),
    });
    return new Response(JSON.stringify({ status: "cleaned", ...cleanup }), {
      headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers },
    );
  }
};

if (import.meta.main) serve(handleCleanupCompanionCinemaPrivateAssets);
