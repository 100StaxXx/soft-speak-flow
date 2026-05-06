import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  errorResponse,
  hasInternalKey,
  hasUserRole,
  jsonResponse,
  requireAdminOrServiceRoleAuth,
  requireInternalRequest,
} from "../_shared/auth.ts";
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

  if (hasInternalKey(req)) {
    const internalAuth = await requireInternalRequest(req, corsHeaders);
    if (internalAuth instanceof Response) {
      return internalAuth;
    }
  } else {
    const requestAuth = await requireAdminOrServiceRoleAuth(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    if (!requestAuth.isServiceRole) {
      const isAdmin = await hasUserRole(requestAuth.userId, "admin");
      if (!isAdmin) {
        return errorResponse(403, "Admin access required", corsHeaders);
      }
    }
  }

  const body = await req.json().catch(() => ({})) as RotateDailyWallpapersRequestBody;
  const options = {
    ...resolveRotateDailyWallpapersOptions(body),
    costEndpointKey: "rotate-daily-wallpapers",
  };
  const { batchLabel, outcomes } = await rotateWallpaperAssignments(supabase, options);

  console.info(JSON.stringify({
    event: "wallpaper_rotation_batch",
    batchLabel,
    startDate: options.startDate,
    daysAhead: options.daysAhead,
    candidateCount: options.candidateCount,
    force: options.force,
    generatedCount: outcomes.filter((outcome) => outcome.status === "generated").length,
    assignedExistingCount: outcomes.filter((outcome) => outcome.status === "assigned_existing").length,
    carryForwardCount: outcomes.filter((outcome) => outcome.status === "carry_forward").length,
    skippedCount: outcomes.filter((outcome) => outcome.status === "skipped").length,
  }));

  return jsonResponse(200, {
    success: true,
    batchLabel,
    ...options,
    outcomes,
  }, corsHeaders);
});
