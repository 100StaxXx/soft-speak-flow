import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireInternalRequest } from "../_shared/auth.ts";
import { summarizeFunctionInvokeError } from "../_shared/functionInvokeError.ts";
import { invokeInternalFunction } from "../_shared/internalFunctionAuth.ts";
import {
  ACTIVE_MENTOR_SLUGS,
  selectThemeForDate,
} from "../_shared/mentorPepTalkConfig.ts";
import {
  buildReadyTranscriptState,
  buildRetryTranscriptState,
  parseTranscriptSyncPayload,
  TRANSCRIPT_STATUS_PENDING,
} from "../_shared/transcriptRetryState.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  getDateAnchorForIsoDate,
  getUtcIsoDate,
} from "../_shared/effectiveDailyDate.ts";
import {
  getDailyEncouragementSummary,
  getDailyEncouragementTitle,
} from "../_shared/dailyEncouragementCopy.ts";
import { mapWithConcurrency } from "../_shared/concurrency.ts";

const GENERATION_CONCURRENCY = 2;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireInternalRequest(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    console.log("Starting daily mentor pep talk generation...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-daily-mentor-pep-talks",
      featureKey: "ai_pep_talks",
    });
    await costGuardrails.enforceAccess({
      capabilities: ["text", "tts"],
      providers: ["openai", "elevenlabs"],
    });

    const todayDate = getUtcIsoDate();
    const todayAnchor = getDateAnchorForIsoDate(todayDate);
    console.log(`Generating pep talks for date: ${todayDate}`);

    const results: Array<{
      mentor: string;
      status: string;
      reason?: string;
      id?: string;
      title?: string;
      category?: string;
    }> = [];
    const errors: Array<{ mentor: string; error: string }> = [];

    await mapWithConcurrency(
      ACTIVE_MENTOR_SLUGS,
      GENERATION_CONCURRENCY,
      async (mentorSlug) => {
        try {
          console.log(`Processing mentor: ${mentorSlug}`);

          // Check if already generated for today
          const { data: existing, error: checkError } = await supabase
            .from("daily_pep_talks")
            .select("id")
            .eq("mentor_slug", mentorSlug)
            .eq("for_date", todayDate)
            .maybeSingle();

          if (checkError) {
            console.error(
              `Error checking existing for ${mentorSlug}:`,
              checkError,
            );
            errors.push({ mentor: mentorSlug, error: checkError.message });
            return;
          }

          if (existing) {
            console.log(
              `Pep talk already exists for ${mentorSlug} on ${todayDate}, skipping`,
            );
            results.push({
              mentor: mentorSlug,
              status: "skipped",
              reason: "already_exists",
            });
            return;
          }

          const { theme, usedFallbackTheme } = selectThemeForDate(
            mentorSlug,
            todayAnchor,
          );
          if (usedFallbackTheme) {
            console.warn(`Using fallback theme for mentor ${mentorSlug}`);
          }

          console.log(`Selected theme for ${mentorSlug}:`, theme);

          // Fetch mentor details
          const { data: mentor, error: mentorError } = await supabase
            .from("graceward_guides")
            .select("*")
            .eq("slug", mentorSlug)
            .maybeSingle();

          if (mentorError || !mentor) {
            console.error(`Error fetching mentor ${mentorSlug}:`, mentorError);
            errors.push({ mentor: mentorSlug, error: "Mentor not found" });
            return;
          }

          // Generate pep talk using existing function
          console.log(
            `Calling generate-full-mentor-audio for ${mentorSlug}...`,
          );
          const generateResponse = await invokeInternalFunction(
            "generate-full-mentor-audio",
            {
              mentorSlug,
              topic_category: theme.topic_category,
              intensity: theme.intensity,
              emotionalTriggers: theme.triggers,
            },
          );
          const generateRaw = await generateResponse.text();
          const generatedData = generateRaw.length > 0
            ? JSON.parse(generateRaw)
            : null;

          if (!generateResponse.ok || !generatedData) {
            console.error(
              `Error generating audio for ${mentorSlug}:`,
              generateRaw,
            );
            errors.push({
              mentor: mentorSlug,
              error: generateRaw || "Generation failed",
            });
            return;
          }

          const { script, audioUrl } = generatedData;
          const transcript = Array.isArray(generatedData.transcript)
            ? generatedData.transcript
            : [];
          const hasWordTimestamps = transcript.length > 0;

          if (!script || !audioUrl) {
            console.error(`Missing script or audioUrl for ${mentorSlug}`);
            errors.push({
              mentor: mentorSlug,
              error: "Incomplete generation response",
            });
            return;
          }

          // Generate title and summary
          const title = getDailyEncouragementTitle(theme.topic_category);
          const summary = getDailyEncouragementSummary(theme.topic_category);

          console.log(`Generated content for ${mentorSlug}: ${title}`);

          // Insert into daily_pep_talks
          const { data: dailyPepTalk, error: dailyInsertError } = await supabase
            .from("daily_pep_talks")
            .insert({
              mentor_slug: mentorSlug,
              topic_category: theme.topic_category,
              emotional_triggers: theme.triggers,
              intensity: theme.intensity,
              title,
              summary,
              script,
              audio_url: audioUrl,
              for_date: todayDate,
              transcript,
              transcript_status: hasWordTimestamps ? "ready" : TRANSCRIPT_STATUS_PENDING,
              transcript_attempt_count: 0,
              transcript_next_retry_at: hasWordTimestamps ? null : new Date().toISOString(),
              transcript_ready_at: hasWordTimestamps ? new Date().toISOString() : null,
              transcript_last_error: null,
            })
            .select()
            .single();

          if (dailyInsertError) {
            console.error(
              `Error inserting daily pep talk for ${mentorSlug}:`,
              dailyInsertError,
            );
            errors.push({
              mentor: mentorSlug,
              error: dailyInsertError.message,
            });
            return;
          }

          // Insert into main pep_talks library (automatic, no approval needed)
          const { error: libraryInsertError } = await supabase
            .from("pep_talks")
            .insert({
              title,
              description: summary,
              quote: script.substring(0, 200) + "...", // First 200 chars as quote
              audio_url: audioUrl,
              category: theme.topic_category,
              topic_category: [theme.topic_category],
              emotional_triggers: theme.triggers,
              intensity: theme.intensity,
              mentor_slug: mentorSlug,
              mentor_id: mentor.id,
              source: "daily_auto",
              for_date: todayDate,
              is_featured: false,
              is_premium: false,
              transcript,
            });

          if (libraryInsertError) {
            console.error(
              `Error inserting to library for ${mentorSlug}:`,
              libraryInsertError,
            );
            // Don't fail the whole process if library insert fails
          }

          const currentAttemptCount = dailyPepTalk.transcript_attempt_count ??
            0;
          const persistTranscriptState = async (
            payload: Record<string, unknown>,
          ) => {
            const { error } = await supabase
              .from("daily_pep_talks")
              .update(payload)
              .eq("id", dailyPepTalk.id);

            if (error) {
              console.error(
                `Failed to persist transcript state for ${mentorSlug}:`,
                error,
              );
            }
          };

          // Only repair fallback/legacy audio. ElevenLabs timing is already exact.
          if (!hasWordTimestamps) try {
            console.log(
              `Syncing transcript for daily pep talk ${dailyPepTalk.id}...`,
            );
            const syncResponse = await invokeInternalFunction(
              "sync-daily-pep-talk-transcript",
              {
                id: dailyPepTalk.id,
              },
            );
            const syncRaw = await syncResponse.text();
            const syncData = syncRaw.length > 0 ? JSON.parse(syncRaw) : null;

            if (!syncResponse.ok) {
              const summary = await summarizeFunctionInvokeError(
                new Error(syncRaw || `HTTP ${syncResponse.status}`),
              );
              console.error(
                `Transcript sync returned error for ${mentorSlug}:`,
                summary,
              );
              const retryState = buildRetryTranscriptState({
                currentAttemptCount,
                errorMessage: summary.body ?? summary.message,
              });
              await persistTranscriptState(retryState.update);
            } else {
              const syncPayload = (syncData && typeof syncData === "object")
                ? syncData as Record<string, unknown>
                : {};
              const parsedPayload = parseTranscriptSyncPayload(syncPayload);
              const libraryRowsUpdated =
                typeof syncPayload.libraryRowsUpdated === "number"
                  ? syncPayload.libraryRowsUpdated
                  : 0;
              const warning = typeof syncPayload.warning === "string"
                ? syncPayload.warning
                : null;

              if (
                parsedPayload.hasWordTimestamps && parsedPayload.wordCount > 0
              ) {
                await persistTranscriptState(
                  buildReadyTranscriptState(currentAttemptCount),
                );
              } else {
                const retryState = buildRetryTranscriptState({
                  currentAttemptCount,
                  errorMessage: parsedPayload.error ??
                    warning ??
                    "Transcription returned no word-level timestamps",
                });
                await persistTranscriptState(retryState.update);
              }

              console.log(`✓ Transcript synced for ${mentorSlug}`, {
                updated: syncPayload.updated === true,
                hasWordTimestamps: parsedPayload.hasWordTimestamps,
                wordCount: parsedPayload.wordCount,
                retryRecommended: parsedPayload.retryRecommended,
                transcriptChanged: syncPayload.transcriptChanged === true,
                libraryUpdated: syncPayload.libraryUpdated === true,
                libraryRowsUpdated,
                warning,
              });
            }
          } catch (syncError) {
            const summary = await summarizeFunctionInvokeError(syncError);
            console.error(
              `Failed to sync transcript for ${mentorSlug}:`,
              summary,
            );
            const retryState = buildRetryTranscriptState({
              currentAttemptCount,
              errorMessage: summary.body ?? summary.message,
            });
            await persistTranscriptState(retryState.update);
            // Non-blocking - continue even if transcript sync fails
          }

          console.log(
            `✓ Successfully generated daily pep talk for ${mentorSlug}`,
          );
          results.push({
            mentor: mentorSlug,
            status: "success",
            id: dailyPepTalk.id,
            title,
            category: theme.topic_category,
          });
        } catch (error) {
          console.error(`Error processing ${mentorSlug}:`, error);
          const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
          errors.push({ mentor: mentorSlug, error: errorMessage });
        }
      },
    );

    console.log("Daily generation complete. Results:", results);
    console.log("Errors:", errors);

    return new Response(
      JSON.stringify({
        success: true,
        date: todayDate,
        generated: results.length,
        results,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Fatal error in daily generation:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
