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
    const { reflectionId, mood, note } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create system prompt based on mood
    let systemPrompt = "You are a supportive, warm AI companion for A Lil Push app. Respond in 1-3 sentences.";
    
    let userPrompt = "";
    if (mood === 'good') {
      userPrompt = `The user had a good day${note ? ` and said: "${note}"` : ''}. Acknowledge their effort and reinforce their wins with genuine warmth.`;
    } else if (mood === 'neutral') {
      userPrompt = `The user had a neutral day${note ? ` and said: "${note}"` : ''}. Normalize their feelings and gently suggest perspective.`;
    } else if (mood === 'tough') {
      userPrompt = `The user had a tough day${note ? ` and said: "${note}"` : ''}. Validate their emotions, provide calm reassurance, and offer one simple, actionable thought.`;
    }

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiReply = aiData.choices[0].message.content;

    // Update the reflection with AI reply
    const { error: updateError } = await supabase
      .from('user_reflections')
      .update({ ai_reply: aiReply })
      .eq('id', reflectionId);

    if (updateError) {
      console.error('Error updating reflection:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ ai_reply: aiReply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-reflection-reply:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});