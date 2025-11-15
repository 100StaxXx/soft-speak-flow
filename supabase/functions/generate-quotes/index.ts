import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteRequest {
  type: 'trigger' | 'category';
  value: string;
  count: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, value, count = 5 } = await req.json() as QuoteRequest;

    console.log('Generating quotes for:', { type, value, count });

    // Create prompt based on type
    const prompt = type === 'trigger'
      ? `Generate ${count} powerful, authentic quotes and affirmations for someone feeling "${value}". These should be motivational, empowering, and resonate with that emotional state. Each quote should be unique and impactful. Include the author name (can be a famous person or "Anonymous"). Format as JSON array with objects containing "text" and "author" fields.`
      : `Generate ${count} inspiring quotes and affirmations related to "${value}". Focus on growth, improvement, and motivation in this specific area. Each quote should be unique and actionable. Include the author name (can be a famous person or "Anonymous"). Format as JSON array with objects containing "text" and "author" fields.`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices?.[0]?.message?.content;

    if (!generatedContent) {
      throw new Error('No content generated from AI');
    }

    console.log('AI generated content:', generatedContent);

    // Parse the JSON response
    let quotes;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = generatedContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       generatedContent.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : generatedContent;
      quotes = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    // Insert quotes into database
    const quotesToInsert = quotes.map((quote: any) => ({
      text: quote.text,
      author: quote.author || 'Anonymous',
      category: type === 'category' ? value : null,
      emotional_triggers: type === 'trigger' ? [value] : null,
      intensity: 'moderate',
      is_premium: false
    }));

    const { error: insertError } = await supabase
      .from('quotes')
      .insert(quotesToInsert);

    if (insertError) {
      console.error('Error inserting quotes:', insertError);
      throw insertError;
    }

    console.log('Successfully generated and stored quotes');

    return new Response(
      JSON.stringify({ success: true, count: quotes.length }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-quotes function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
