import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { summarizeFunctionInvokeError } from "../_shared/functionInvokeError.ts";
import { selectThemeForDate, resolveMentorSlug } from "../_shared/mentorPepTalkConfig.ts";
import {
  buildReadyTranscriptState,
  buildRetryTranscriptState,
  parseTranscriptSyncPayload,
  TRANSCRIPT_STATUS_PENDING,
} from "../_shared/transcriptRetryState.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErrorResponseDetails {
  code?: string;
  upstreamStatus?: number;
  upstreamError?: string | null;
}

function normalizeStatus(status: number): number {
  if (!Number.isFinite(status)) return 500;
  if (status < 400 || status > 599) return 500;
  return status;
}

function buildErrorResponse(
  status: number,
  message: string,
  details: ErrorResponseDetails = {},
): Response {
  const payload: Record<string, unknown> = { error: message };

  if (details.code) payload.code = details.code;
  if (typeof details.upstreamStatus === "number") payload.upstream_status = details.upstreamStatus;
  if (typeof details.upstreamError === "string" && details.upstreamError.length > 0) {
    payload.upstream_error = details.upstreamError;
  }

  return new Response(
    JSON.stringify(payload),
    { status: normalizeStatus(status), headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseUpstreamError(rawBody: string): string | null {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const message = typeof parsed.upstream_error === "string"
      ? parsed.upstream_error
      : typeof parsed.upstreamError === "string"
        ? parsed.upstreamError
      : typeof parsed.error === "string"
        ? parsed.error
      : typeof parsed.message === "string"
        ? parsed.message
        : null;
    return message ?? trimmed.slice(0, 300);
  } catch {
    return trimmed.slice(0, 300);
  }
}

function generateTitle(_mentorSlug: string, category: string): string {
  const titles: Record<string, string[]> = {
    discipline: ['Lock In and Execute', 'Stay Consistent Today', 'Build Your Discipline', 'No Excuses, Just Action'],
    confidence: ['Step Into Your Power', 'Believe in Yourself', 'Own Your Worth', 'Rise Above Doubt'],
    physique: ['Train Like a Champion', 'Push Your Limits', 'Build Your Body', 'Strength Is Earned'],
    focus: ['Stay Locked In', 'Focus on What Matters', 'Eliminate Distractions', 'Sharp Mind, Clear Goals'],
    mindset: ['Shift Your Perspective', 'Master Your Mind', 'Think Bigger Today', 'Growth Starts Here'],
    business: ['Execute Your Vision', 'Build Your Empire', 'Make It Happen', 'Business Moves Today']
  };

  const categoryTitles = titles[category] || ['Take Action Today'];
  const randomIndex = Math.floor(Math.random() * categoryTitles.length);
  return categoryTitles[randomIndex];
}

function generateSummary(category: string): string {
  const summaries: Record<string, string> = {
    discipline: 'A powerful reminder to stay consistent and take action, no matter how you feel.',
    confidence: 'Build unshakeable confidence and step into your power with clarity and purpose.',
    physique: 'Push your physical limits and transform your body through dedication and effort.',
    focus: 'Cut through distractions and lock in on what truly matters for your success.',
    mindset: 'Shift your thinking, overcome mental blocks, and embrace a growth-oriented perspective.',
    business: 'Take strategic action and build momentum toward your entrepreneurial goals.'
  };

  return summaries[category] || 'A daily push to help you move forward with purpose and intention.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let mentorSlugInput: string | null = null;
    try {
      const body = await req.json();
      mentorSlugInput = body && typeof body.mentorSlug === "string" ? body.mentorSlug : null;
    } catch {
      return buildErrorResponse(400, "Invalid request payload", { code: "INVALID_JSON" });
    }

    if (!mentorSlugInput || mentorSlugInput.trim().length === 0) {
      return buildErrorResponse(400, "mentorSlug is required", { code: "INVALID_REQUEST" });
    }

    const requestedMentorSlug = mentorSlugInput.trim().toLowerCase();
    const resolvedMentorSlug = resolveMentorSlug(requestedMentorSlug) ?? requestedMentorSlug;
    console.log(`Starting single pep talk generation for mentor: ${requestedMentorSlug} (resolved=${resolvedMentorSlug})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return buildErrorResponse(500, "Missing Supabase environment variables", { code: "MISSING_ENV" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    const todayDate = today.toLocaleDateString('en-CA');
    console.log(`Generating pep talk for date: ${todayDate}`);

    // Check if already generated for today
    const { data: existing, error: checkError } = await supabase
      .from('daily_pep_talks')
      .select('*')
      .eq('mentor_slug', resolvedMentorSlug)
      .eq('for_date', todayDate)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing pep talk:', checkError);
      return buildErrorResponse(500, "Failed to check existing pep talk", { code: "DB_CHECK_FAILED" });
    }

    // If already exists, return it
    if (existing) {
      console.log(`Pep talk already exists for ${resolvedMentorSlug} on ${todayDate}, returning existing`);
      return new Response(
        JSON.stringify({ pepTalk: existing, status: 'existing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { theme, usedFallbackTheme } = selectThemeForDate(resolvedMentorSlug, today);
    if (usedFallbackTheme) {
      console.warn(`Using fallback pep talk theme for mentor: ${resolvedMentorSlug}`);
    }

    console.log(`Selected theme for ${resolvedMentorSlug}:`, theme);

    // Fetch mentor details
    const { data: mentor, error: mentorError } = await supabase
      .from('mentors')
      .select('*')
      .eq('slug', resolvedMentorSlug)
      .maybeSingle();

    if (mentorError) {
      return buildErrorResponse(500, "Failed to fetch mentor", { code: "MENTOR_FETCH_FAILED" });
    }

    if (!mentor) {
      return buildErrorResponse(404, `Mentor not found: ${resolvedMentorSlug}`, { code: "MENTOR_NOT_FOUND" });
    }

    // Generate pep talk using existing function via direct fetch (edge-to-edge call)
    console.log(`Calling generate-full-mentor-audio for ${resolvedMentorSlug}...`);
    
    const audioResponse = await fetch(
      `${supabaseUrl}/functions/v1/generate-full-mentor-audio`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          mentorSlug: resolvedMentorSlug,
          topic_category: theme.topic_category,
          intensity: theme.intensity,
          emotionalTriggers: theme.triggers
        }),
      }
    );

    if (!audioResponse.ok) {
      const upstreamRaw = await audioResponse.text();
      const upstreamError = parseUpstreamError(upstreamRaw);
      console.error('Error generating audio:', audioResponse.status, upstreamRaw);
      return buildErrorResponse(
        audioResponse.status,
        "Failed to prepare pep talk audio",
        {
          code: "AUDIO_PIPELINE_FAILED",
          upstreamStatus: audioResponse.status,
          upstreamError,
        },
      );
    }

    let generatedData: Record<string, unknown>;
    try {
      generatedData = await audioResponse.json() as Record<string, unknown>;
    } catch {
      return buildErrorResponse(502, "Invalid response from audio generation pipeline", {
        code: "AUDIO_PIPELINE_INVALID_RESPONSE",
      });
    }

    const script = typeof generatedData.script === "string" ? generatedData.script : null;
    const audioUrl = typeof generatedData.audioUrl === "string" ? generatedData.audioUrl : null;
    
    if (!script || !audioUrl) {
      return buildErrorResponse(502, "Incomplete generation response", {
        code: "AUDIO_PIPELINE_INCOMPLETE_RESPONSE",
      });
    }

    // Generate title and summary
    const title = generateTitle(resolvedMentorSlug, theme.topic_category);
    const summary = generateSummary(theme.topic_category);

    console.log(`Generated content for ${resolvedMentorSlug}: ${title}`);

    // Insert into daily_pep_talks
    const { data: dailyPepTalk, error: dailyInsertError } = await supabase
      .from('daily_pep_talks')
      .insert({
        mentor_slug: resolvedMentorSlug,
        topic_category: theme.topic_category,
        emotional_triggers: theme.triggers,
        intensity: theme.intensity,
        title,
        summary,
        script,
        audio_url: audioUrl,
        for_date: todayDate,
        transcript_status: TRANSCRIPT_STATUS_PENDING,
        transcript_attempt_count: 0,
        transcript_next_retry_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dailyInsertError) {
      console.error('Error inserting daily pep talk:', dailyInsertError);
      return buildErrorResponse(500, "Failed to save pep talk", { code: "DAILY_PEP_TALK_INSERT_FAILED" });
    }

    // Also insert into main pep_talks library
    const { error: libraryInsertError } = await supabase
      .from('pep_talks')
      .insert({
        title,
        description: summary,
        quote: script.substring(0, 200) + '...',
        audio_url: audioUrl,
        category: theme.topic_category,
        topic_category: [theme.topic_category],
        emotional_triggers: theme.triggers,
        intensity: theme.intensity,
        mentor_slug: resolvedMentorSlug,
        mentor_id: mentor.id,
        source: 'user_generated',
        for_date: todayDate,
        is_featured: false,
        is_premium: false,
        transcript: []
      });
    if (libraryInsertError) {
      console.error("Error inserting pep talk into library (non-blocking):", libraryInsertError);
    }

    const currentAttemptCount = dailyPepTalk.transcript_attempt_count ?? 0;
    const persistTranscriptState = async (payload: Record<string, unknown>) => {
      const { error } = await supabase
        .from('daily_pep_talks')
        .update(payload)
        .eq('id', dailyPepTalk.id);

      if (error) {
        console.error(`Failed to persist transcript state for ${dailyPepTalk.id}:`, error);
      }
    };

    // Non-blocking transcript sync to reduce client-side sync retries.
    try {
      console.log(`Syncing transcript for daily pep talk ${dailyPepTalk.id}...`);
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-daily-pep-talk-transcript', {
        body: { id: dailyPepTalk.id },
      });

      if (syncError) {
        const summary = await summarizeFunctionInvokeError(syncError);
        console.error(`Transcript sync failed for ${dailyPepTalk.id}:`, summary);
        const retryState = buildRetryTranscriptState({
          currentAttemptCount,
          errorMessage: typeof summary.body === "string" ? summary.body : summary.message,
        });
        await persistTranscriptState(retryState.update);
      } else {
        const syncPayload = (syncData && typeof syncData === "object")
          ? syncData as Record<string, unknown>
          : {};
        const parsedPayload = parseTranscriptSyncPayload(syncPayload);
        const libraryRowsUpdated =
          typeof syncPayload.libraryRowsUpdated === "number" ? syncPayload.libraryRowsUpdated : 0;
        const warning = typeof syncPayload.warning === "string" ? syncPayload.warning : null;

        if (parsedPayload.hasWordTimestamps && parsedPayload.wordCount > 0) {
          await persistTranscriptState(buildReadyTranscriptState(currentAttemptCount));
        } else {
          const retryState = buildRetryTranscriptState({
            currentAttemptCount,
            errorMessage:
              parsedPayload.error ??
              warning ??
              "Transcription returned no word-level timestamps",
          });
          await persistTranscriptState(retryState.update);
        }

        console.log(`✓ Transcript synced for ${dailyPepTalk.id}`, {
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
      console.error(`Transcript sync threw for ${dailyPepTalk.id}:`, summary);
      const retryState = buildRetryTranscriptState({
        currentAttemptCount,
        errorMessage: typeof summary.body === "string" ? summary.body : summary.message,
      });
      await persistTranscriptState(retryState.update);
      // Keep pep talk generation successful even when transcript sync fails.
    }

    console.log(`✓ Successfully generated daily pep talk for ${resolvedMentorSlug}`);

    return new Response(
      JSON.stringify({ 
        pepTalk: dailyPepTalk, 
        status: 'generated' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-single-daily-pep-talk:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return buildErrorResponse(500, errorMessage, { code: "INTERNAL_ERROR" });
  }
});
