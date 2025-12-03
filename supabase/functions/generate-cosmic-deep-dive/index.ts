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

// Placement-specific focus areas for non-sun placements
const placementFocus: Record<string, string> = {
  moon: "emotional_insight",
  rising: "social_insight", 
  mercury: "mental_insight",
  mars: "action_insight",
  venus: "love_insight",
};

// Retry helper with exponential backoff
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
        console.log(`Attempt ${attempt + 1} failed with ${response.status}, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Attempt ${attempt + 1} failed with network error, retrying in ${delay}ms:`, error);
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

// Build prompt based on placement type
function buildPrompt(placement: string, sign: string, userName: string, chartContext: string, today: string): string {
  const isSun = placement.toLowerCase() === 'sun';
  
  if (isSun) {
    return `You are an expert astrologer creating a CONCISE personalized cosmic reading.

${chartContext}

The Sun represents: ${placementDescriptions.sun}.

Generate a SHORT reading for Sun in ${sign} for ${userName}.
Today's date is ${today}.

IMPORTANT: Keep ALL content very brief - a few sentences each, NOT paragraphs.

Return a JSON object with EXACTLY these fields:
{
  "title": "A creative title (3-5 words)",
  "tagline": "A short phrase (under 10 words)",
  "todays_focus": "1-2 sentences about today's cosmic energy",
  "chart_synergy": "1-2 sentences about how Sun interacts with other placements",
  "overview": "3-4 sentences max explaining Sun in ${sign}",
  "strengths": ["short phrase", "short phrase"],
  "challenges": ["short phrase", "short phrase"]
}

Be warm but CONCISE. Quality over quantity.`;
  } else {
    const focusField = placementFocus[placement.toLowerCase()] || 'insight';
    const focusDescriptions: Record<string, string> = {
      emotional_insight: "How this Moon placement colors your emotional world and inner needs (2-3 sentences)",
      social_insight: "How this Rising sign shapes first impressions and your outward persona (2-3 sentences)",
      mental_insight: "How this Mercury placement affects your thinking and communication style (2-3 sentences)",
      action_insight: "How this Mars placement drives your ambition, energy, and desires (2-3 sentences)",
      love_insight: "How this Venus placement shapes your love language and values (2-3 sentences)",
    };

    return `You are an expert astrologer creating a VERY BRIEF personalized cosmic insight.

${chartContext}

The ${placement} represents: ${placementDescriptions[placement.toLowerCase()] || 'an important placement'}.

Generate ONE focused insight for ${placement} in ${sign} for ${userName}.

IMPORTANT: This should be SHORT - just 2-3 sentences of meaningful insight.

Return a JSON object with EXACTLY these fields:
{
  "title": "A creative title (3-5 words)",
  "tagline": "A short phrase (under 10 words)",
  "${focusField}": "${focusDescriptions[focusField] || '2-3 sentences of focused insight'}"
}

Be warm, specific, and CONCISE. One powerful insight is better than many generic ones.`;
  }
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
    console.log('Using date:', today, 'with timezone offset:', timezoneOffset);

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
      console.log('Returning cached deep dive for', placement, sign);
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
      console.error('Profile fetch error:', profileError);
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

This user is viewing their ${placement.toUpperCase()} in ${sign.toUpperCase()}.
` : `
User has Sun in ${profile.zodiac_sign || sign}.
They are viewing ${placement.toUpperCase()} in ${sign.toUpperCase()}.
`;

    const prompt = buildPrompt(placement.toLowerCase(), sign, userName, chartContext, today);

    console.log('Generating personalized deep dive for', user.id, placement, sign);

    const aiResponse = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert astrologer. Return ONLY valid JSON, no markdown formatting or code blocks. Keep responses CONCISE."
          },
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

    // Validate required fields based on placement
    if (!content.title || !content.tagline) {
      throw new Error('Missing required fields: title, tagline');
    }

    // Cache the result with simplified structure
    const cacheData: Record<string, unknown> = {
      user_id: user.id,
      placement: placement.toLowerCase(),
      sign: sign.toLowerCase(),
      for_date: today,
      title: content.title,
      tagline: content.tagline,
      // Sun-specific fields
      overview: content.overview || null,
      strengths: Array.isArray(content.strengths) ? content.strengths : [],
      challenges: Array.isArray(content.challenges) ? content.challenges : [],
      chart_synergy: content.chart_synergy || null,
      todays_focus: content.todays_focus || null,
      // Placement-specific insights
      emotional_insight: content.emotional_insight || null,
      social_insight: content.social_insight || null,
      mental_insight: content.mental_insight || null,
      action_insight: content.action_insight || null,
      love_insight: content.love_insight || null,
      // Legacy fields (empty for new format)
      in_relationships: content.in_relationships || null,
      in_work: content.in_work || null,
      in_wellness: content.in_wellness || null,
      compatible_signs: [],
      daily_practice: content.daily_practice || null,
    };

    const { error: insertError } = await supabaseService
      .from('user_cosmic_deep_dives')
      .upsert(cacheData, { onConflict: 'user_id,placement,sign,for_date' });

    if (insertError) {
      console.error('Failed to cache deep dive:', insertError);
    }

    console.log('Generated and cached deep dive for', user.id, placement, sign);

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
