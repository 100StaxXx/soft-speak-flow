import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const moodMapping: Record<string, { category: string; triggers: string[] }> = {
  'Unmotivated': { category: 'discipline', triggers: ['Unmotivated', 'Procrastinating'] },
  'Overthinking': { category: 'mindset', triggers: ['Anxious & Overthinking', 'Stressed'] },
  'Stressed': { category: 'mindset', triggers: ['Stressed', 'Overwhelmed'] },
  'Low Energy': { category: 'self-care', triggers: ['Drained', 'Low Energy'] },
  'Content': { category: 'gratitude', triggers: ['Content', 'Peaceful'] },
  'Disciplined': { category: 'discipline', triggers: ['Disciplined', 'Focused'] },
  'Focused': { category: 'focus', triggers: ['Focused', 'Clear-minded'] },
  'Inspired': { category: 'growth', triggers: ['Inspired', 'Energized'] }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mood } = await req.json();
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const mapping = moodMapping[mood] || moodMapping['Unmotivated'];
    
    const systemPrompt = `You are a motivational coach for Cosmiq app. Create content for someone feeling "${mood}".
    
Generate a response with:
1. A powerful, short quote (1 sentence max)
2. A mini pep talk (2-4 sentences) that's grounded, actionable, and encouraging

Tone: Strong, direct, supportive. Not overly soft. Think David Goggins meets a good friend.`;

    const userPrompt = `The user is feeling: ${mood}. Help them evolve through this moment.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'create_mood_push',
            description: 'Create a motivational push for the user',
            parameters: {
              type: 'object',
              properties: {
                quote: { type: 'string', description: 'A powerful short quote (1 sentence)' },
                mini_pep_talk: { type: 'string', description: 'A 2-4 sentence pep talk' }
              },
              required: ['quote', 'mini_pep_talk'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'create_mood_push' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        quote: result.quote,
        mini_pep_talk: result.mini_pep_talk,
        audio_url: null,
        image_url: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-mood-push:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});