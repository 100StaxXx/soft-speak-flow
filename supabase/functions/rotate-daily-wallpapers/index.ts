import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { errorResponse, hasUserRole, jsonResponse, requireUserOrInternalRequest } from "../_shared/auth.ts";
import { createWallpaperServiceClient } from "../_shared/wallpaperPipeline.ts";
import {
  resolveRotateDailyWallpapersOptions,
  rotateWallpaperAssignments,
  type RotateDailyWallpapersRequestBody,
} from "./workflow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const supabase = createWallpaperServiceClient();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestAuth = await requireUserOrInternalRequest(req, corsHeaders);
  if (requestAuth instanceof Response) {
    return requestAuth;
  }

  if (!requestAuth.isInternal) {
    const isAdmin = await hasUserRole(requestAuth.userId, "admin");
    if (!isAdmin) {
      return errorResponse(403, "Admin access required", corsHeaders);
    }
  }

  const body = await req.json().catch(() => ({})) as RotateDailyWallpapersRequestBody;
  const options = resolveRotateDailyWallpapersOptions(body);
  const { batchLabel, outcomes } = await rotateWallpaperAssignments(supabase, options);

  return jsonResponse(200, {
    success: true,
    batchLabel,
    ...options,
    outcomes,
  }, corsHeaders);
});
