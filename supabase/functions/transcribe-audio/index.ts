import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireInternalRequest, type InternalRequestAuth } from "../_shared/auth.ts";
import {
  buildForcedAlignmentFormData,
  buildTranscriptionFormData,
} from "./request.ts";
import { forcedAlignmentToWords } from "../_shared/elevenLabsAlignment.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";

interface TranscribeAudioDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<InternalRequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
}

const defaultDeps: TranscribeAudioDeps = {
  authenticate: requireInternalRequest,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    return createClient(supabaseUrl, supabaseServiceKey);
  },
  fetchImpl: fetch,
};

export async function handleTranscribeAudio(
  req: Request,
  deps: TranscribeAudioDeps = defaultDeps,
): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const internalAuth = await deps.authenticate(req, corsHeaders);
    if (internalAuth instanceof Response) {
      return internalAuth;
    }

    const { audioUrl, pepTalkId, text } = await req.json();

    if (!audioUrl) {
      throw new Error('Audio URL is required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const providedText = typeof text === "string" ? text.trim() : "";
    const useElevenLabsAlignment = Boolean(ELEVENLABS_API_KEY && providedText);
    if (!useElevenLabsAlignment && !OPENAI_API_KEY) {
      throw new Error('No transcription provider configured');
    }

    const supabaseAdmin = deps.createSupabaseClient();
    const costGuardrails = createCostGuardrailSession({
      supabase: supabaseAdmin,
      endpointKey: "transcribe-audio",
      featureKey: "ai_transcription",
    });
    const guardedFetch = costGuardrails.wrapFetch(deps.fetchImpl);
    await costGuardrails.enforceAccess({
      capabilities: ["transcription"],
      providers: [useElevenLabsAlignment ? "elevenlabs" : "openai"],
    });

    console.log('Fetching audio from URL:', audioUrl);

    // Fetch the audio file
    const audioResponse = await deps.fetchImpl(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log('Audio fetched, size:', audioBlob.size, 'bytes');

    const formData = useElevenLabsAlignment
      ? buildForcedAlignmentFormData(audioBlob, providedText)
      : buildTranscriptionFormData(audioBlob);
    const transcriptionUrl = useElevenLabsAlignment
      ? "https://api.elevenlabs.io/v1/forced-alignment"
      : "https://api.openai.com/v1/audio/transcriptions";
    const transcriptionHeaders: Record<string, string> = useElevenLabsAlignment
      ? { "xi-api-key": ELEVENLABS_API_KEY! }
      : { "Authorization": `Bearer ${OPENAI_API_KEY}` };

    console.log(
      useElevenLabsAlignment
        ? "Sending audio and script to ElevenLabs Forced Alignment..."
        : "Sending audio to OpenAI Whisper API...",
    );

    const transcriptionResponse = await guardedFetch(transcriptionUrl, {
      method: 'POST',
      headers: transcriptionHeaders,
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      const provider = useElevenLabsAlignment ? "ElevenLabs" : "OpenAI";
      console.error(`${provider} transcription error:`, errorText);
      throw new Error(`${provider} transcription error: ${transcriptionResponse.status} - ${errorText}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    console.log('Transcription received');

    // Extract word-level timestamps
    const transcript = useElevenLabsAlignment
      ? forcedAlignmentToWords(transcriptionData)
      : (transcriptionData.words || []).map((wordData: any) => ({
        word: wordData.word,
        start: wordData.start,
        end: wordData.end,
      }));

    if (transcript.length === 0) {
      throw new Error("Transcription provider returned no word timestamps");
    }

    console.log(`Successfully transcribed ${transcript.length} words`);

    // If pepTalkId is provided, save transcript to database using service role
    if (pepTalkId) {
      const { error: updateError } = await supabaseAdmin
        .from('pep_talks')
        .update({ transcript })
        .eq('id', pepTalkId);

      if (updateError) {
        console.error('Failed to save transcript to database:', updateError);
        throw new Error(`Failed to save transcript: ${updateError.message}`);
      }

      console.log(`Transcript saved to pep_talk ${pepTalkId}`);
    }

    return new Response(
      JSON.stringify({
        transcript,
        text: useElevenLabsAlignment ? providedText : transcriptionData.text,
        duration: useElevenLabsAlignment
          ? transcript.reduce((latest: number, word: { end: number }) => Math.max(latest, word.end), 0)
          : transcriptionData.duration,
        provider: useElevenLabsAlignment ? "elevenlabs" : "openai",
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error('Error in transcribe-audio function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleTranscribeAudio(req));
}
