import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map mentor slugs to OpenAI TTS voices
const mentorVoiceMap: Record<string, string> = {
  atlas: 'onyx',      // deep, authoritative
  eli: 'echo',        // wise, measured
  nova: 'nova',       // innovative, energetic
  sienna: 'shimmer',  // warm, compassionate
  lumi: 'alloy',      // calm, peaceful
  kai: 'onyx',        // high energy
  stryker: 'fable',   // strong, resilient
  carmen: 'nova',     // strong, authoritative female
  reign: 'fable',     // commanding, high-energy
  elizabeth: 'shimmer', // warm, nurturing
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, mentorSlug, stepId } = await req.json();

    if (!text || !mentorSlug || !stepId) {
      throw new Error('Missing required parameters: text, mentorSlug, stepId');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const voice = mentorVoiceMap[mentorSlug] || 'alloy';

    console.log(`Generating TTS for mentor ${mentorSlug} (voice: ${voice}), step: ${stepId}`);

    // Generate speech from text using OpenAI TTS
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI TTS error:', error);
      throw new Error(`Failed to generate speech: ${error}`);
    }

    // Convert audio buffer to base64 (chunk to avoid stack overflow)
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000; // Process in 32KB chunks
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        stepId,
        mentorSlug 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error in generate-tutorial-tts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
