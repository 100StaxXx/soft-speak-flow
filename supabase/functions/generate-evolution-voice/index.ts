import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { requireRequestAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mentor voice IDs for ElevenLabs
const MENTOR_VOICES: Record<string, string> = {
  'atlas': 'JBFqnCBsd6RMkjVDRZzb', // George
  'darius': 'rWyjfFeMZ6PxkHqD3wGC', // Brian
  'eli': 'iP95p4xoKVk53GoZ742B', // Chris
  'nova': 'onwK4e9ZLuTAKqWW03F9', // Daniel
  'sienna': 'XB0fDUnXU5powFXDhCwa', // Charlotte
  'lumi': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  'kai': 'N2lVS1w4EtoT3dr4eOWO', // Callum
  'stryker': 'pNInz6obpgDQGcFmaJgB', // Rich
  'solace': 'pFZP5JQG7iQjIQuC4Bku', // Lily
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

    const { mentorSlug, newStage, userId } = await req.json();
    const effectiveUserId = userId ?? auth.userId;

    if (!auth.isServiceRole && userId && userId !== auth.userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: user mismatch" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Generating evolution voice for ${mentorSlug}, stage ${newStage}, user ${effectiveUserId}`);

    if (!mentorSlug || newStage === undefined) {
      console.warn('Missing mentorSlug or newStage - returning generic response');
      return new Response(
        JSON.stringify({ 
          voiceLine: "Your companion has evolved! Keep up the great work!",
          audioContent: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get mentor personality details
    const { data: mentor, error: mentorError } = await supabaseClient
      .from('mentors')
      .select('name, tone_description, style_description')
      .eq('slug', mentorSlug)
      .single();

    if (!mentor || mentorError) {
      console.error('Mentor not found or error:', mentorError);
      return new Response(
        JSON.stringify({ 
          voiceLine: "Your companion has evolved! Keep up the great work!",
          audioContent: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate AI voice line based on mentor personality
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        max_completion_tokens: 100,
        messages: [
          {
            role: 'system',
            content: `You are ${mentor.name}. Your tone: ${mentor.tone_description}. Your style: ${mentor.style_description}.

Generate a SHORT, powerful one-liner (10-15 words MAX) celebrating that the user's companion just evolved to stage ${newStage}.
Focus on DISCIPLINE and CONSISTENCY.

Examples for different mentors:
- Atlas (authoritative): "Growth like this doesn't happen by accident."
- Darius (intense): "This is what consistency looks like."
- Solace (gentle): "Look at what you're building, gently and surely."

Make it personal to ${mentor.name}'s voice. Keep it SHORT and IMPACTFUL.`
          },
          {
            role: 'user',
            content: `My companion just evolved to stage ${newStage}. Give me ONE powerful line.`
          }
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI error:', error);
      throw new Error('Failed to generate voice line');
    }

    const openaiData = await openaiResponse.json();
    const voiceLine = openaiData.choices[0].message.content.trim()
      .replace(/^["']|["']$/g, ''); // Remove quotes if AI added them

    console.log('Generated voice line:', voiceLine);

    // Convert to speech using ElevenLabs
    const voiceId = MENTOR_VOICES[mentorSlug] || MENTOR_VOICES['atlas'];
    
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: voiceLine,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const error = await elevenLabsResponse.text();
      console.error('ElevenLabs error:', error);
      throw new Error('Failed to generate audio');
    }

    // Convert audio to base64
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    );

    console.log('Audio generated successfully');

    return new Response(
      JSON.stringify({
        voiceLine,
        audioContent: base64Audio,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-evolution-voice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
