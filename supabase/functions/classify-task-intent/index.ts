import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntentClassification {
  type: 'quest' | 'epic' | 'habit';
  confidence: number;
  reasoning: string;
  suggestedDeadline?: string;
  suggestedDuration?: number; // days
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input } = await req.json();

    if (!input || typeof input !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Input text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an intent classifier for a productivity app. Analyze the user's input and classify it as one of:

1. **quest** - A single, specific task that can be completed in one sitting or one day
   - Examples: "buy groceries", "call mom", "finish report", "clean room"
   
2. **epic** - A long-term goal requiring multiple steps, habits, or milestones over days/weeks/months
   - Examples: "get my real estate license", "run a marathon", "learn Spanish", "lose 20 pounds", "launch my startup"
   - Key indicators: timeframes like "by June", "in 3 months", certifications, learning goals, fitness transformations
   
3. **habit** - A recurring action to be done regularly
   - Examples: "meditate daily", "drink 8 glasses of water", "read for 30 minutes every day"
   - Key indicators: "every", "daily", "weekly", frequency words

Also extract:
- Any deadline mentioned (as ISO date string if specific, or relative description)
- Suggested duration in days for epics

Respond ONLY with valid JSON matching this schema:
{
  "type": "quest" | "epic" | "habit",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggestedDeadline": "ISO date or null",
  "suggestedDuration": number or null
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    let classification: IntentClassification;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      classification = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Default to quest if parsing fails
      classification = {
        type: 'quest',
        confidence: 0.5,
        reasoning: 'Could not parse AI response, defaulting to quest',
      };
    }

    // Validate the classification
    if (!['quest', 'epic', 'habit'].includes(classification.type)) {
      classification.type = 'quest';
    }
    if (typeof classification.confidence !== 'number') {
      classification.confidence = 0.5;
    }

    console.log('Classified intent:', { input, classification });

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('classify-task-intent error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
