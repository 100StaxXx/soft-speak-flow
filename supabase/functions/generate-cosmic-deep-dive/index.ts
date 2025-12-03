import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const placementDescriptions: Record<string, string> = {
  sun: "core identity, ego, and life purpose",
  moon: "emotional nature, inner self, and instincts",
  rising: "outward personality, first impressions, and appearance",
  mercury: "communication style, thinking patterns, and learning",
  mars: "drive, ambition, action, and desire",
  venus: "love style, values, beauty, and pleasure",
};

// Placement-specific focus areas
const placementFocus: Record<string, { field: string; description: string }> = {
  sun: { field: "identity_insight", description: "How this Sun placement shapes your core identity and life purpose (2-3 sentences)" },
  moon: { field: "emotional_insight", description: "How this Moon placement colors your emotional world and inner needs (2-3 sentences)" },
  rising: { field: "social_insight", description: "How this Rising sign shapes first impressions and your outward persona (2-3 sentences)" },
  mercury: { field: "mental_insight", description: "How this Mercury placement affects your thinking and communication style (2-3 sentences)" },
  mars: { field: "action_insight", description: "How this Mars placement drives your ambition, energy, and desires (2-3 sentences)" },
  venus: { field: "love_insight", description: "How this Venus placement shapes your love language and values (2-3 sentences)" },
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
      
      if (response.status >= 500 || response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

function getLocalDate(timezoneOffset?: number): string {
  const now = new Date();
  if (timezoneOffset !== undefined) {
    const localTime = new Date(now.getTime() - timezoneOffset * 60 * 1000);
    return localTime.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}

function buildPrompt(placement: string, sign: string, userName: string, chartContext: string): string {
  const focus = placementFocus[placement.toLowerCase()];
  
  return `You are an expert astrologer creating a VERY BRIEF personalized cosmic insight.

${chartContext}

The ${placement} represents: ${placementDescriptions[placement.toLowerCase()] || 'an important placement'}.

Generate ONE focused insight for ${placement} in ${sign} for ${userName}.

IMPORTANT: Keep this SHORT - just 2-3 sentences of meaningful, specific insight.

Return a JSON object with EXACTLY these fields:
{
  "title": "A creative title (3-5 words)",
  "tagline": "A short phrase (under 10 words)",
  "${focus.field}": "${focus.description}"
}

Be warm, specific to their chart, and CONCISE. One powerful insight beats many generic ones.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { placement, sign, timezoneOffset } = await req.json();
    if (!placement || !sign) {
      return new Response(JSON.stringify({ error: 'placement and sign required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = getLocalDate(timezoneOffset);

    // Check cache first
    const { data: cached } = await supabaseService
      .from('user_cosmic_deep_dives')
      .select('*')
      .eq('user_id', user.id)
      .eq('placement', placement.toLowerCase())
      .eq('sign', sign.toLowerCase())
      .eq('for_date', today)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user's profile
    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('zodiac_sign, moon_sign, rising_sign, mercury_sign, mars_sign, venus_sign, onboarding_data')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hasAdvancedProfile = profile?.moon_sign && profile?.rising_sign;
    const onboardingData = profile?.onboarding_data as Record<string, unknown> | null;
    const userName = (onboardingData?.userName as string) || 'you';

    const chartContext = hasAdvancedProfile ? `
User's Cosmiq Profile:
☀️ Sun: ${profile.zodiac_sign || 'Unknown'}
🌙 Moon: ${profile.moon_sign || 'Unknown'}
⬆️ Rising: ${profile.rising_sign || 'Unknown'}
💭 Mercury: ${profile.mercury_sign || 'Unknown'}
🔥 Mars: ${profile.mars_sign || 'Unknown'}
💗 Venus: ${profile.venus_sign || 'Unknown'}

Viewing: ${placement.toUpperCase()} in ${sign.toUpperCase()}
` : `Sun in ${profile.zodiac_sign || sign}. Viewing: ${placement.toUpperCase()} in ${sign.toUpperCase()}.`;

    const prompt = buildPrompt(placement.toLowerCase(), sign, userName, chartContext);

    const aiResponse = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert astrologer. Return ONLY valid JSON, no markdown. Keep responses VERY brief." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI generation failed:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const contentText = aiData.choices?.[0]?.message?.content;
    
    if (!contentText) {
      throw new Error('No content in AI response');
    }

    let content;
    try {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', contentText);
      throw new Error('Failed to parse AI response');
    }

    if (!content.title || !content.tagline) {
      throw new Error('Missing required fields: title, tagline');
    }

    // Cache the result
    const cacheData: Record<string, unknown> = {
      user_id: user.id,
      placement: placement.toLowerCase(),
      sign: sign.toLowerCase(),
      for_date: today,
      title: content.title,
      tagline: content.tagline,
      identity_insight: content.identity_insight || null,
      emotional_insight: content.emotional_insight || null,
      social_insight: content.social_insight || null,
      mental_insight: content.mental_insight || null,
      action_insight: content.action_insight || null,
      love_insight: content.love_insight || null,
      // Legacy fields
      overview: null,
      strengths: [],
      challenges: [],
      chart_synergy: null,
      todays_focus: null,
      in_relationships: null,
      in_work: null,
      in_wellness: null,
      compatible_signs: [],
      daily_practice: null,
    };

    const { error: insertError } = await supabaseService
      .from('user_cosmic_deep_dives')
      .upsert(cacheData, { onConflict: 'user_id,placement,sign,for_date' });

    if (insertError) {
      console.error('Failed to cache deep dive:', insertError);
    }

    return new Response(JSON.stringify(cacheData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating cosmic deep dive:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
