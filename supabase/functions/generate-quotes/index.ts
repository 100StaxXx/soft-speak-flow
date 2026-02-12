import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const QuoteRequestSchema = z.object({
  type: z.enum(['trigger', 'category']),
  value: z.string()
    .min(1, "Value is required")
    .max(100, "Value must be less than 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Value contains invalid characters"),
  count: z.number().int().min(1).max(10).default(5),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse and validate input
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = QuoteRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error('[generate-quotes] Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, value, count } = parseResult.data;

    // Rate limit check (anonymous but still limit by IP-based estimation via service call count)
    // Note: For authenticated endpoints, we'd use userId
    const rateLimitConfig = RATE_LIMITS['generate-quotes'] || { maxCalls: 20, windowHours: 24 };

    console.log('Generating quotes for:', { type, value, count });

    const prompt = type === 'trigger'
      ? `Generate ${count} short, authentic quotes and affirmations for someone feeling "${value}". Each must include an author (famous person or "Anonymous"). IMPORTANT: Do NOT include em dashes (—) or attribution dashes in the quote text itself. Return JSON array of {"text","author"} where text is ONLY the quote without any dashes or author attribution.`
      : `Generate ${count} short, inspiring quotes and affirmations related to "${value}". Each must include an author (famous person or "Anonymous"). IMPORTANT: Do NOT include em dashes (—) or attribution dashes in the quote text itself. Return JSON array of {"text","author"} where text is ONLY the quote without any dashes or author attribution.`;

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      })
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

