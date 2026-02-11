import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRequestAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Genre presets with BPM ranges
const GENRE_PRESETS = {
  cosmic_synth: {
    prompts: [
      'energetic cosmic synthwave with clear beat drops and pulsing bassline',
      'upbeat space electronic with steady 4/4 rhythm and ethereal synths',
      'dynamic celestial dance track with driving percussion',
    ],
    bpmRange: [110, 130],
  },
  space_ambient: {
    prompts: [
      'atmospheric space ambient with subtle rhythmic pulse',
      'dreamy cosmic electronic with gentle percussion',
      'floating astral soundscape with soft beat undertones',
    ],
    bpmRange: [90, 110],
  },
  stellar_beats: {
    prompts: [
      'high energy electronic dance music with cosmic sound design',
      'pumping space techno with crisp snare hits on every beat',
      'futuristic rhythm game track with clear note timing',
    ],
    bpmRange: [120, 140],
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    const { genre = 'stellar_beats', difficulty = 'all' } = await req.json();
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get genre preset
    const preset = GENRE_PRESETS[genre as keyof typeof GENRE_PRESETS] || GENRE_PRESETS.stellar_beats;
    const prompt = preset.prompts[Math.floor(Math.random() * preset.prompts.length)];
    const bpm = Math.floor(Math.random() * (preset.bpmRange[1] - preset.bpmRange[0] + 1)) + preset.bpmRange[0];
    
    // Duration between 30-40 seconds
    const duration = Math.floor(Math.random() * 11) + 30;

    console.log(`Generating rhythm track: ${genre}, BPM: ${bpm}, Duration: ${duration}s`);
    console.log(`Prompt: ${prompt}`);

    // Generate music using ElevenLabs Music API
    const response = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${prompt}, ${bpm} BPM tempo, ${duration} seconds`,
        duration_seconds: duration,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs Music API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`Generated audio: ${audioBuffer.byteLength} bytes`);

    // Upload to Supabase Storage
    const fileName = `track_${Date.now()}_${bpm}bpm.mp3`;
    const storagePath = `tracks/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('rhythm-tracks')
      .upload(storagePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload track: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('rhythm-tracks')
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;
    console.log(`Uploaded to: ${audioUrl}`);

    // Save track metadata to database
    const { data: track, error: dbError } = await supabase
      .from('rhythm_tracks')
      .insert({
        audio_url: audioUrl,
        storage_path: storagePath,
        prompt,
        bpm,
        duration_seconds: duration,
        genre,
        difficulty_tier: difficulty,
        is_active: true,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      throw new Error(`Failed to save track metadata: ${dbError.message}`);
    }

    console.log(`Track saved with ID: ${track.id}`);

    return new Response(JSON.stringify({
      success: true,
      track: {
        id: track.id,
        audio_url: audioUrl,
        bpm,
        duration_seconds: duration,
        genre,
        prompt,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating rhythm track:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
