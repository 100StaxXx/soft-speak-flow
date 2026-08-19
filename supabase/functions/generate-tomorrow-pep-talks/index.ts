import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  insertTomorrowDailyPepTalkAndSync,
  type SupabaseLikeClient,
} from "./workflow.ts";
import {
  ACTIVE_MENTOR_SLUGS,
  selectThemeForDate,
} from "../_shared/mentorPepTalkConfig.ts";
import { requireInternalRequest } from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { invokeInternalFunction } from "../_shared/internalFunctionAuth.ts";
import {
  getDateAnchorForIsoDate,
  getUtcIsoDate,
} from "../_shared/effectiveDailyDate.ts";
import {
  getDailyEncouragementSummary,
  getDailyEncouragementTitle,
} from "../_shared/dailyEncouragementCopy.ts";
import { mapWithConcurrency } from "../_shared/concurrency.ts";
import { TRANSCRIPT_STATUS_PENDING } from "../_shared/transcriptRetryState.ts";

const GENERATION_CONCURRENCY = 2;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireInternalRequest(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    console.log("Starting tomorrow pep talk pre-generation...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-tomorrow-pep-talks",
      featureKey: "ai_pep_talks",
    });
    await costGuardrails.enforceAccess({
      capabilities: ["text", "tts"],
      providers: ["openai", "elevenlabs"],
    });

    const tomorrowDate = getUtcIsoDate(new Date(), 1);
    const tomorrowAnchor = getDateAnchorForIsoDate(tomorrowDate);
    console.log(`Pre-generating pep talks for date: ${tomorrowDate}`);

    // Get active canonical mentors for pre-generation.
    const { data: mentors, error: mentorsError } = await supabase
      .from("graceward_guides")
      .select("slug, id")
      .eq("is_active", true)
      .in("slug", [...ACTIVE_MENTOR_SLUGS]);

    if (mentorsError) {
      throw new Error(`Failed to fetch mentors: ${mentorsError.message}`);
    }

    const mentorsBySlug = new Map<string, { slug: string; id: string }>();
    for (const mentor of mentors || []) {
      if (mentor?.slug && mentor?.id) {
        mentorsBySlug.set(mentor.slug, { slug: mentor.slug, id: mentor.id });
      }
    }

    const results: { mentor: string; status: string; error?: string }[] = [];

    // Keep enough parallelism to finish before the Edge Function wall-time limit
    // without overwhelming the text-to-speech provider.
    await mapWithConcurrency(
      ACTIVE_MENTOR_SLUGS,
      GENERATION_CONCURRENCY,
      async (mentorSlug) => {
        const mentor = mentorsBySlug.get(mentorSlug);
        if (!mentor) {
          console.log(`Skipping missing/inactive mentor row: ${mentorSlug}`);
          results.push({
            mentor: mentorSlug,
            status: "skipped",
            error: "Mentor row missing or inactive",
          });
          return;
        }

        try {
          // Check if already generated for tomorrow
          const { data: existing } = await supabase
            .from("daily_pep_talks")
            .select("id")
            .eq("product_mode", "graceward")
            .eq("mentor_slug", mentorSlug)
            .eq("for_date", tomorrowDate)
            .maybeSingle();

          if (existing) {
            console.log(
              `Pep talk already exists for ${mentorSlug} on ${tomorrowDate}`,
            );
            results.push({ mentor: mentorSlug, status: "existing" });
            return;
          }

          const { theme, usedFallbackTheme } = selectThemeForDate(
            mentorSlug,
            tomorrowAnchor,
          );
          if (usedFallbackTheme) {
            console.warn(`Using fallback theme for mentor ${mentorSlug}`);
          }

          console.log(`Generating for ${mentorSlug} with theme:`, theme);

          // Call generate-full-mentor-audio
          const audioResponse = await invokeInternalFunction(
            "generate-full-mentor-audio",
            {
              mentorSlug,
              productMode: "graceward",
              topic_category: theme.topic_category,
              intensity: theme.intensity,
              emotionalTriggers: theme.triggers,
            },
          );

          if (!audioResponse.ok) {
            const errorText = await audioResponse.text();
            console.error(
              `Error generating for ${mentorSlug}:`,
              audioResponse.status,
              errorText,
            );
            results.push({
              mentor: mentorSlug,
              status: "error",
              error: `Audio generation failed: ${audioResponse.status}`,
            });
            return;
          }

          const generatedAudio = await audioResponse.json();
          const { script, audioUrl } = generatedAudio;
          const transcript = Array.isArray(generatedAudio.transcript)
            ? generatedAudio.transcript
            : [];
          const hasWordTimestamps = transcript.length > 0;

          if (!script || !audioUrl) {
            results.push({
              mentor: mentorSlug,
              status: "error",
              error: "Missing script or audioUrl",
            });
            return;
          }

          // Generate title and summary
          const title = getDailyEncouragementTitle(theme.topic_category);
          const summary = getDailyEncouragementSummary(theme.topic_category);

          // Insert into daily_pep_talks for tomorrow and attempt transcript sync (non-blocking).
          const { dailyPepTalkId } = await insertTomorrowDailyPepTalkAndSync({
            supabase: supabase as unknown as SupabaseLikeClient,
            mentorSlug,
            logger: console,
            invokeTranscriptSync: async (dailyPepTalkId) => {
              const response = await invokeInternalFunction(
                "sync-daily-pep-talk-transcript",
                { id: dailyPepTalkId },
              );
              const raw = await response.text();
              let data: unknown = null;
              try {
                data = raw.length > 0 ? JSON.parse(raw) : null;
              } catch {
                data = null;
              }

              return {
                data,
                error: response.ok
                  ? null
                  : new Error(raw || `HTTP ${response.status}`),
              };
            },
            beforeSync: async () => {
              // Also insert into main pep_talks library before transcript sync runs.
              const { error: libraryInsertError } = await supabase
                .from("pep_talks")
                .insert({
                  title,
                  product_mode: "graceward",
                  description: summary,
                  quote: script.substring(0, 200) + "...",
                  audio_url: audioUrl,
                  category: theme.topic_category,
                  topic_category: [theme.topic_category],
                  emotional_triggers: theme.triggers,
                  intensity: theme.intensity,
                  mentor_slug: mentorSlug,
                  mentor_id: mentor.id,
                  source: "auto_generated",
                  for_date: tomorrowDate,
                  is_featured: false,
                  is_premium: false,
                  transcript,
                });

              if (libraryInsertError) {
                console.error(
                  `Error inserting library pep talk for ${mentorSlug}:`,
                  libraryInsertError,
                );
                // Non-blocking: still continue transcript sync for daily row.
              }
            },
            insertPayload: {
              mentor_slug: mentorSlug,
              product_mode: "graceward",
              topic_category: theme.topic_category,
              emotional_triggers: theme.triggers,
              intensity: theme.intensity,
              title,
              summary,
              script,
              audio_url: audioUrl,
              for_date: tomorrowDate,
              transcript,
              transcript_status: hasWordTimestamps ? "ready" : TRANSCRIPT_STATUS_PENDING,
              transcript_next_retry_at: hasWordTimestamps ? null : new Date().toISOString(),
              transcript_ready_at: hasWordTimestamps ? new Date().toISOString() : null,
            },
          });

          console.log(
            `✓ Generated pep talk for ${mentorSlug} (daily id=${dailyPepTalkId})`,
          );
          results.push({ mentor: mentorSlug, status: "generated" });
        } catch (mentorError) {
          console.error(`Error processing ${mentorSlug}:`, mentorError);
          results.push({
            mentor: mentorSlug,
            status: "error",
            error: mentorError instanceof Error
              ? mentorError.message
              : "Unknown error",
          });
        }
      },
    );

    const generated = results.filter((r) => r.status === "generated").length;
    const existing = results.filter((r) => r.status === "existing").length;
    const errors = results.filter((r) => r.status === "error").length;

    console.log(
      `Pre-generation complete: ${generated} generated, ${existing} existing, ${errors} errors`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        date: tomorrowDate,
        summary: { generated, existing, errors },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error in generate-tomorrow-pep-talks:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
