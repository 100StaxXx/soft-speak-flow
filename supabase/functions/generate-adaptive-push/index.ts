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
      emotionalTriggers = [] 
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

    const prompt = `Write a short 1-2 sentence motivational message in the voice of ${mentor.name}.

Mentor Profile:
- Tone: ${mentor.tone_description}
- Style: ${mentor.style_description || 'N/A'}
- Themes: ${mentor.themes?.join(', ') || 'motivation'}
- Target User: ${mentor.target_user || 'N/A'}

Category Focus: ${category}
${emotionalContext}
${intensityNote}

Do not use the signature line directly. Stay authentic to the mentor's voice. Make it feel personal and timely.`;

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

    return new Response(
      JSON.stringify({ message: generatedMessage }),
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