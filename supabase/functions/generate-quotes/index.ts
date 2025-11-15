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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { type, value, count = 5 } = await req.json() as QuoteRequest;

    console.log('Generating quotes for:', { type, value, count });

    const prompt = type === 'trigger'
      ? `Generate ${count} short, authentic quotes and affirmations for someone feeling "${value}". Each must include an author (famous person or "Anonymous"). Return JSON array of {"text","author"}.`
      : `Generate ${count} short, inspiring quotes and affirmations related to "${value}". Each must include an author (famous person or "Anonymous"). Return JSON array of {"text","author"}.`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      })
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      throw new Error(`AI gateway error: ${aiResp.status} ${txt}`);
    }

    const aiData = await aiResp.json();
    const content: string = aiData.choices?.[0]?.message?.content ?? '';

    let quotes: Array<{ text: string; author: string }> = [];
    try {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\[[\s\S]*\]/);
      const jsonStr = match ? (match[1] || match[0]) : content;
      quotes = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Parse error:', e, 'raw:', content);
      throw new Error('Failed to parse AI response');
    }

    const rows = quotes.map(q => ({
      text: q.text,
      author: q.author || 'Anonymous',
      category: type === 'category' ? value : null,
      emotional_triggers: type === 'trigger' ? [value] : null,
      intensity: 'moderate',
      is_premium: false,
    }));

    const rest = await fetch(`${supabaseUrl}/rest/v1/quotes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(rows)
    });

    if (!rest.ok) {
      const txt = await rest.text();
      throw new Error(`Insert failed: ${txt}`);
    }

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('generate-quotes error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

