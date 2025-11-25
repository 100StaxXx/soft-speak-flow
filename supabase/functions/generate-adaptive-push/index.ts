import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      mentorId, 
      category, 
      intensity, 
      emotionalTriggers = [],
      eventContext = '',
      includeAudio = false,
      mentorSlug = ''
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch mentor details
    const { data: mentor, error: mentorError } = await supabase
      .from('mentors')
      .select('*')
      .eq('id', mentorId)
      .single();

    if (mentorError || !mentor) {
      throw new Error('Mentor not found');
    }

    // Build prompt for AI
    const emotionalContext = emotionalTriggers.length > 0 
      ? `The user is feeling: ${emotionalTriggers.join(', ')}. Acknowledge this gently.` 
      : '';

    const intensityNote = 
      intensity === 'soft' ? 'Keep it gentle and encouraging.' :
      intensity === 'strong' ? 'Be direct and powerful.' :
      'Be balanced and supportive.';

    const categoryRules = `
Category rules:
- If category = 'discipline': focus on action, structure, accountability, and self-respect.
- If category = 'confidence': focus on self-worth, proof of past wins, and believing in themselves again.
- If category = 'healing': focus on emotional safety, letting go, and gentle recovery.
- If category = 'calm': focus on breath, slowing down, and reducing overthinking.
- If category = 'focus': focus on priorities, clarity, and eliminating distractions.
- If category = 'love': focus on self-worth in relationships, clarity, and healthy standards.
- If category = 'spiritual': focus on intuition, alignment, and inner guidance.`;

    const intensityRules = `
Intensity rules:
- soft: gentle, nurturing, slower language.
- balanced: firm but kind.
- strong: direct, commanding, and highly motivating (but not abusive).`;

    const eventContextText = eventContext ? `\n\nEvent context:\n${eventContext}` : '';

    const prompt = `Write a short 1-2 sentence motivational notification for the app 'R-Evolution'. Write in the voice of the given mentor, exactly matching their tone and style. The message must be concise, emotionally impactful, and suitable as a mobile push notification. Do not use emojis. Do not mention the word 'category' or 'trigger'. Do not repeat the mentor's signature line directly, but stay in character.

Mentor:
- Name: ${mentor.name}
- Archetype: ${mentor.archetype || 'N/A'}
- Tone: ${mentor.tone_description}
- Style: ${mentor.style_description || 'N/A'}
- Themes: ${mentor.themes?.join(', ') || 'motivation'}

User context:
- Selected category for this push: ${category}
- Intensity preference: ${intensity}
- Emotional triggers (if any): ${emotionalTriggers.length > 0 ? emotionalTriggers.join(', ') : 'none'}

${categoryRules}

${intensityRules}
${eventContextText}

Write one short push notification message now, in the mentor's voice.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a motivational mentor AI. Write concise, powerful messages.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to generate message');
    }

    const aiData = await aiResponse.json();
    const generatedMessage = aiData.choices[0].message.content;

    let audioUrl = null;

    // Generate audio if requested
    if (includeAudio && mentorSlug) {
      console.log(`Generating audio for push notification with mentor ${mentorSlug}`);
      try {
        const audioResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-mentor-audio`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              mentorSlug,
              script: generatedMessage,
            }),
          }
        );

        if (audioResponse.ok) {
          const audioData = await audioResponse.json();
          audioUrl = audioData.audioUrl;
          console.log(`Audio generated for push: ${audioUrl}`);
        } else {
          console.error('Failed to generate audio for push notification');
        }
      } catch (audioError) {
        console.error('Error generating audio:', audioError);
        // Continue without audio if generation fails
      }
    }

    return new Response(
      JSON.stringify({ 
        message: generatedMessage,
        audioUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-adaptive-push:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});