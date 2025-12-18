import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      'driving cosmic EDM with punchy kicks and shimmering arpeggios',
      'energetic space disco with groovy basslines and sparkling synths',
    ],
    bpmRange: [120, 140],
  },
};

const DIFFICULTY_TIERS = ['easy', 'medium', 'hard'];

async function generateSingleTrack(
  supabase: any,
  genre: string,
  difficulty: string
): Promise<{ success: boolean; trackId?: string; error?: string }> {
  try {
    const preset = GENRE_PRESETS[genre as keyof typeof GENRE_PRESETS] || GENRE_PRESETS.stellar_beats;
    const prompt = preset.prompts[Math.floor(Math.random() * preset.prompts.length)];
    const bpm = Math.floor(Math.random() * (preset.bpmRange[1] - preset.bpmRange[0] + 1)) + preset.bpmRange[0];
    
    // Duration between 30-40 seconds
    const duration = Math.floor(Math.random() * 11) + 30;

    console.log(`Generating track: ${genre}, ${difficulty}, BPM: ${bpm}, Duration: ${duration}s`);

    // Generate music using ElevenLabs Music API
    const response = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
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
      return { success: false, error: `ElevenLabs API error: ${response.status}` };
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`Generated audio: ${audioBuffer.byteLength} bytes`);

    // Upload to Supabase Storage
    const fileName = `track_${Date.now()}_${bpm}bpm_${difficulty}.mp3`;
    const storagePath = `tracks/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('rhythm-tracks')
      .upload(storagePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('rhythm-tracks')
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;

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
      .select('id')
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      return { success: false, error: `DB insert failed: ${dbError.message}` };
    }

    console.log(`Track saved: ${track.id}`);
    return { success: true, trackId: track.id };

  } catch (error) {
    console.error('Error generating track:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      count = 6, 
      genre = 'stellar_beats',
      spreadDifficulties = true 
    } = await req.json();
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const results: { success: boolean; trackId?: string; difficulty: string; error?: string }[] = [];
    
    console.log(`Starting batch generation: ${count} tracks, genre: ${genre}, spreadDifficulties: ${spreadDifficulties}`);

    for (let i = 0; i < count; i++) {
      // Determine difficulty - spread evenly if requested
      const difficulty = spreadDifficulties 
        ? DIFFICULTY_TIERS[i % DIFFICULTY_TIERS.length]
        : 'all';
      
      console.log(`Generating track ${i + 1}/${count} (${difficulty})...`);
      
      const result = await generateSingleTrack(supabase, genre, difficulty);
      results.push({ ...result, difficulty });
      
      // Add delay between requests to respect rate limits
      if (i < count - 1) {
        console.log('Waiting 3 seconds before next track...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Batch complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(JSON.stringify({
      success: failCount === 0,
      generated: successCount,
      failed: failCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch generation:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
