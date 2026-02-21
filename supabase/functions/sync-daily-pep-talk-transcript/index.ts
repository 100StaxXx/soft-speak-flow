import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";
import {
  buildTranscriptionFailurePayload,
  buildTranscriptSyncPlan,
  type LibraryTranscriptRow,
} from "./syncLogic.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await req.json().catch(() => ({}));
    const { id, mentor_slug, for_date } = body as { id?: string; mentor_slug?: string; for_date?: string };

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend configuration missing");
    }
    const functionApiKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the daily pep talk row
    let pepTalk: any = null;
    if (id) {
      const { data, error } = await supabase
        .from("daily_pep_talks")
        .select("id, mentor_slug, script, transcript, audio_url, for_date")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      pepTalk = data;
    } else if (mentor_slug && for_date) {
      const { data, error } = await supabase
        .from("daily_pep_talks")
        .select("id, mentor_slug, script, transcript, audio_url, for_date")
        .eq("mentor_slug", mentor_slug)
        .eq("for_date", for_date)
        .maybeSingle();
      if (error) throw error;
      pepTalk = data;
    } else {
      return new Response(
        JSON.stringify({ error: "Provide either id or {mentor_slug, for_date}" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pepTalk) {
      return new Response(
        JSON.stringify({ error: "Pep talk not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pepTalk.audio_url) {
      return new Response(
        JSON.stringify({ error: "Pep talk has no audio_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call existing transcribe-audio function to get authoritative text + timestamps
    const transcribeResp = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: functionApiKey,
      },
      body: JSON.stringify({ audioUrl: pepTalk.audio_url }),
    });

    if (!transcribeResp.ok) {
      const t = await transcribeResp.text();
      console.error("transcribe-audio error:", transcribeResp.status, t);
      return new Response(
        JSON.stringify(buildTranscriptionFailurePayload(t, transcribeResp.status)),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcribed = await transcribeResp.json();
    const transcribedText: string | undefined = transcribed?.text;

    if (!transcribedText) {
      return new Response(
        JSON.stringify({
          error: "No transcription text returned",
          hasWordTimestamps: false,
          wordCount: 0,
          retryRecommended: true,
          updated: false,
          scriptChanged: false,
          transcriptChanged: false,
          libraryUpdated: false,
          libraryRowsUpdated: 0,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let libraryRows: LibraryTranscriptRow[] = [];
    if (pepTalk.mentor_slug && pepTalk.for_date) {
      const { data: candidateRows, error: libraryLookupError } = await supabase
        .from("pep_talks")
        .select("id, transcript")
        .eq("mentor_slug", pepTalk.mentor_slug)
        .eq("for_date", pepTalk.for_date)
        .eq("audio_url", pepTalk.audio_url);

      if (libraryLookupError) {
        console.error("Failed loading matching pep_talks rows:", libraryLookupError);
        return new Response(
          JSON.stringify({
            error: "Failed to load matching library pep talks",
            hasWordTimestamps: false,
            wordCount: 0,
            retryRecommended: true,
            updated: false,
            scriptChanged: false,
            transcriptChanged: false,
            libraryUpdated: false,
            libraryRowsUpdated: 0,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      libraryRows = (candidateRows ?? []) as LibraryTranscriptRow[];
    }

    const syncPlan = buildTranscriptSyncPlan({
      currentScript: pepTalk.script,
      currentTranscript: pepTalk.transcript,
      transcribedText,
      transcribedTranscript: transcribed?.transcript,
      libraryRows,
    });

    if (syncPlan.updated) {
      const { error: updateErr } = await supabase
        .from("daily_pep_talks")
        .update({
          script: syncPlan.nextScript,
          transcript: syncPlan.nextTranscript,
        })
        .eq("id", pepTalk.id);

      if (updateErr) {
        console.error("Failed updating daily_pep_talks.script:", updateErr);
        return new Response(
          JSON.stringify({
            error: "Failed to update script/transcript",
            script: syncPlan.nextScript,
            transcript: syncPlan.nextTranscript,
            hasWordTimestamps: syncPlan.hasWordTimestamps,
            wordCount: syncPlan.wordCount,
            retryRecommended: syncPlan.retryRecommended,
            updated: false,
            scriptChanged: syncPlan.scriptChanged,
            transcriptChanged: syncPlan.transcriptChanged,
            libraryUpdated: false,
            libraryRowsUpdated: 0,
            warning: syncPlan.warning,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Updated daily_pep_talks.script and transcript (id=${pepTalk.id})`);
    }

    let libraryRowsUpdated = 0;
    if (syncPlan.libraryIdsToUpdate.length > 0) {
      const { data: updatedLibraryRows, error: libraryUpdateError } = await supabase
        .from("pep_talks")
        .update({ transcript: syncPlan.nextTranscript })
        .in("id", syncPlan.libraryIdsToUpdate)
        .select("id");

      if (libraryUpdateError) {
        console.error("Failed updating pep_talks.transcript:", libraryUpdateError);
        return new Response(
          JSON.stringify({
            error: "Failed to update library transcript",
            id: pepTalk.id,
            script: syncPlan.nextScript,
            transcript: syncPlan.nextTranscript,
            hasWordTimestamps: syncPlan.hasWordTimestamps,
            wordCount: syncPlan.wordCount,
            retryRecommended: syncPlan.retryRecommended,
            updated: syncPlan.updated,
            scriptChanged: syncPlan.scriptChanged,
            transcriptChanged: syncPlan.transcriptChanged,
            libraryUpdated: false,
            libraryRowsUpdated: 0,
            warning: syncPlan.warning,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      libraryRowsUpdated = updatedLibraryRows?.length ?? 0;
      if (libraryRowsUpdated > 0) {
        console.log(`Updated pep_talks transcript rows: ${libraryRowsUpdated} (daily id=${pepTalk.id})`);
      }
    }

    const libraryUpdated = libraryRowsUpdated > 0;
    return new Response(
      JSON.stringify({
        id: pepTalk.id,
        script: syncPlan.nextScript,
        transcript: syncPlan.nextTranscript,
        hasWordTimestamps: syncPlan.hasWordTimestamps,
        wordCount: syncPlan.wordCount,
        retryRecommended: syncPlan.retryRecommended,
        updated: syncPlan.updated,
        scriptChanged: syncPlan.scriptChanged,
        transcriptChanged: syncPlan.transcriptChanged,
        libraryUpdated,
        libraryRowsUpdated,
        warning: syncPlan.warning,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-daily-pep-talk-transcript error:", e);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
