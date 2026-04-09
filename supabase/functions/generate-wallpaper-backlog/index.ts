import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdminRequest } from "../_shared/admin.ts";
import { createWallpaperServiceClient } from "../_shared/wallpaperPipeline.ts";
import {
  resolveRotateDailyWallpapersOptions,
  rotateWallpaperAssignments,
  type RotateDailyWallpapersRequestBody,
} from "../rotate-daily-wallpapers/workflow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createWallpaperServiceClient();

const jsonResponse = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  },
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminRequest = await requireAdminRequest(req, supabase, corsHeaders);
  if (adminRequest instanceof Response) {
    return adminRequest;
  }
  void adminRequest;

  const body = await req.json().catch(() => ({})) as RotateDailyWallpapersRequestBody & {
    batchPreset?: string;
    promoteNow?: boolean;
  };

  const options = resolveRotateDailyWallpapersOptions({
    ...body,
    daysAhead: body.daysAhead ?? (body.batchPreset ? 1 : undefined),
    force: body.force ?? true,
  });
  const { batchLabel, outcomes } = await rotateWallpaperAssignments(supabase, options);

  return jsonResponse(200, {
    success: true,
    legacy: true,
    batchLabel,
    ...options,
    outcomes,
  });
});
