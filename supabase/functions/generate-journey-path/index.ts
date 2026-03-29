import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface JourneyPathRequestBody {
  epicId: string | null;
  milestoneIndex: number | null;
}

function parseJourneyPathBody(payload: unknown): JourneyPathRequestBody {
  if (!payload || typeof payload !== "object") {
    return { epicId: null, milestoneIndex: null };
  }

  const requestPayload = payload as Record<string, unknown>;
  return {
    epicId: typeof requestPayload.epicId === "string" ? requestPayload.epicId : null,
    milestoneIndex: typeof requestPayload.milestoneIndex === "number"
      ? requestPayload.milestoneIndex
      : null,
  };
}

export async function handleGenerateJourneyPath(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "ai.expensive_export",
      endpointName: "generate-journey-path",
      allowServiceRole: false,
    });
    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }
    const { auth, supabase, requestId: protectedRequestId } = protectedRequest;
    requestId = protectedRequestId;

    const body = await req.json().catch(() => ({}));
    const { epicId, milestoneIndex } = parseJourneyPathBody(body);
    if (!epicId || milestoneIndex === null || milestoneIndex < 0) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_INPUT",
        error: "Missing required parameters: epicId, milestoneIndex",
        requestId,
      });
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      return createSafeErrorResponse(req, {
        status: 500,
        code: "SERVICE_MISCONFIGURED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    const userId = auth.userId;

    const { data: existingPath } = await supabase
      .from("epic_journey_paths")
      .select("id, image_url")
      .eq("epic_id", epicId)
      .eq("user_id", userId)
      .eq("milestone_index", milestoneIndex)
      .maybeSingle();

    if (existingPath) {
      return new Response(JSON.stringify({
        success: true,
        existing: true,
        imageUrl: existingPath.image_url,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: epic, error: epicError } = await supabase
      .from("epics")
      .select("id, user_id, title, story_type_slug, theme_color, story_seed")
      .eq("id", epicId)
      .single();

    if (epicError || !epic) {
      console.error("[generate-journey-path] Epic fetch error:", epicError);
      return createSafeErrorResponse(req, {
        status: 404,
        code: "NOT_FOUND",
        error: "Epic not found",
        requestId,
      });
    }

    if (epic.user_id !== userId) {
      const { data: membership, error: membershipError } = await supabase
        .from("epic_members")
        .select("user_id")
        .eq("epic_id", epicId)
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipError) {
        console.error("[generate-journey-path] Membership check error:", membershipError);
        return createSafeErrorResponse(req, {
          status: 500,
          code: "INTERNAL_ERROR",
          error: "Request could not be processed right now",
          requestId,
        });
      }

      if (!membership) {
        return createSafeErrorResponse(req, {
          status: 403,
          code: "FORBIDDEN",
          error: "Forbidden",
          requestId,
        });
      }
    }

    const { data: companion } = await supabase
      .from("user_companion")
      .select("spirit_animal, core_element, favorite_color")
      .eq("user_id", userId)
      .single();

    const worldContext = {
      worldName: "a mystical realm",
      worldEra: "an ancient time",
      currentLocation: "the beginning of the path",
      nextLocation: "mysteries ahead",
    };

    if (epic.story_seed) {
      const storySeed = typeof epic.story_seed === "string"
        ? JSON.parse(epic.story_seed)
        : epic.story_seed;

      if (storySeed?.story_universe) {
        worldContext.worldName = storySeed.story_universe.world_name || worldContext.worldName;
        worldContext.worldEra = storySeed.story_universe.world_era || worldContext.worldEra;
      }

      if (Array.isArray(storySeed?.chapter_blueprints)) {
        const chapters = storySeed.chapter_blueprints;
        if (milestoneIndex === 0) {
          if (chapters[0]) {
            worldContext.nextLocation = chapters[0].location_name || chapters[0].title || "the first waypoint";
          }
        } else {
          const previousChapter = chapters[milestoneIndex - 1];
          const nextChapter = chapters[milestoneIndex];

          if (previousChapter) {
            worldContext.currentLocation = previousChapter.location_name || previousChapter.title || "a conquered realm";
          }

          if (nextChapter) {
            worldContext.nextLocation = nextChapter.location_name || nextChapter.title || "the path ahead";
          }
        }
      }
    }

    const companionType = companion?.spirit_animal || "mystical creature";
    const coreElement = companion?.core_element || "cosmic";
    const themeColor = epic.theme_color || "purple";
    const storyThemes: Record<string, string> = {
      treasure_hunt: "ancient ruins, hidden treasures, mysterious caves",
      heroes_journey: "epic landscapes, dramatic cliffs, heroic vistas",
      pilgrimage: "sacred temples, serene paths, spiritual energy",
      exploration: "uncharted territories, wild nature, discovery",
      rescue_mission: "dangerous terrain, urgent atmosphere, dramatic lighting",
      mystery: "fog-shrouded paths, enigmatic structures, ethereal glow",
    };

    const visualTheme = storyThemes[epic.story_type_slug || ""] || "cosmic fantasy landscapes";
    const prompt = `A beautiful panoramic walk path through ${worldContext.worldName} in ${worldContext.worldEra}.
The path leads from ${worldContext.currentLocation} towards ${worldContext.nextLocation}.
Visual theme: ${visualTheme}.
The path should be suitable for a ${companionType} companion with ${coreElement} energy walking alongside.
Color palette: ${themeColor} tones with cosmic accents.
Style: ethereal fantasy illustration, dreamy atmosphere, horizontal landscape format, magical lighting, no text or characters visible.
Ultra high resolution.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        image_size: "1024x1024",
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[generate-journey-path] AI API error:", errorText);
      return createSafeErrorResponse(req, {
        status: 502,
        code: "UPSTREAM_FAILED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageData) {
      console.error("[generate-journey-path] No image in response:", JSON.stringify(aiData).slice(0, 500));
      return createSafeErrorResponse(req, {
        status: 502,
        code: "UPSTREAM_FAILED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
    const fileName = `${userId}/${epicId}/${milestoneIndex}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("journey-paths")
      .upload(fileName, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-journey-path] Upload error:", uploadError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "UPLOAD_FAILED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    const { data: urlData } = supabase.storage
      .from("journey-paths")
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;
    const { error: insertError } = await supabase
      .from("epic_journey_paths")
      .upsert({
        epic_id: epicId,
        user_id: userId,
        milestone_index: milestoneIndex,
        image_url: imageUrl,
        prompt_context: {
          worldContext,
          companionType,
          coreElement,
          themeColor,
          storyType: epic.story_type_slug,
        },
        generated_at: new Date().toISOString(),
      }, {
        onConflict: "epic_id,user_id,milestone_index",
      });

    if (insertError) {
      console.error("[generate-journey-path] Database insert error:", insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      imageUrl,
      milestoneIndex,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-journey-path] Error:", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Request could not be processed right now",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve(handleGenerateJourneyPath);
}
