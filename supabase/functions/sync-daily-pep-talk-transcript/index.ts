import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the daily pep talk row
    let pepTalk: any = null;
    if (id) {
      const { data, error } = await supabase
        .from("daily_pep_talks")
        .select("id, mentor_slug, script, audio_url, for_date")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      pepTalk = data;
    } else if (mentor_slug && for_date) {
      const { data, error } = await supabase
        .from("daily_pep_talks")
        .select("id, mentor_slug, script, audio_url, for_date")
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
      },
      body: JSON.stringify({ audioUrl: pepTalk.audio_url }),
    });

    if (!transcribeResp.ok) {
      const t = await transcribeResp.text();
      console.error("transcribe-audio error:", transcribeResp.status, t);
      return new Response(
        JSON.stringify({ error: "Transcription failed", details: t }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcribed = await transcribeResp.json();
    const transcribedText: string | undefined = transcribed?.text;
    const wordTimestamps: any[] = transcribed?.transcript || [];

    if (!transcribedText) {
      return new Response(
        JSON.stringify({ error: "No transcription text returned" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If the new text differs significantly, update the row with both script and transcript
    const currentText: string = pepTalk.script || "";
    const differs = currentText.trim() !== transcribedText.trim();

    if (differs) {
      const { error: updateErr } = await supabase
        .from("daily_pep_talks")
        .update({ 
          script: transcribedText,
          transcript: wordTimestamps
        })
        .eq("id", pepTalk.id);

      if (updateErr) {
        console.error("Failed updating daily_pep_talks.script:", updateErr);
        return new Response(
          JSON.stringify({ error: "Failed to update script", script: transcribedText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Updated daily_pep_talks.script and transcript (id=${pepTalk.id})`);
    }

    return new Response(
      JSON.stringify({ 
        id: pepTalk.id, 
        script: transcribedText, 
        transcript: wordTimestamps,
        changed: differs 
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
