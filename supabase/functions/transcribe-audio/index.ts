import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl } = await req.json();

    if (!audioUrl) {
      throw new Error('Audio URL is required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Fetching audio from URL:', audioUrl);

    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log('Audio fetched, size:', audioBlob.size, 'bytes');

    // Prepare form data for OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    console.log('Sending to OpenAI Whisper API...');

    // Call OpenAI Whisper API
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${transcriptionResponse.status} - ${errorText}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    console.log('Transcription received');

    // Extract word-level timestamps
    const words = transcriptionData.words || [];
    
    // Format the transcript for our database
    const transcript = words.map((wordData: any) => ({
      word: wordData.word,
      start: wordData.start,
      end: wordData.end,
    }));

    console.log(`Successfully transcribed ${transcript.length} words`);

    return new Response(
      JSON.stringify({
        transcript,
        text: transcriptionData.text,
        duration: transcriptionData.duration,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
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
});
