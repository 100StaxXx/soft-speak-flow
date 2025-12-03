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

    // Create client with user's token to get their profile
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Create service client for writing cache
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { placement, sign } = await req.json();
    if (!placement || !sign) {
      return new Response(JSON.stringify({ error: 'placement and sign required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];

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

    // Fetch user's full cosmic profile
    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('zodiac_sign, moon_sign, rising_sign, mercury_sign, mars_sign, venus_sign, email')
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
    // Use first part of email as fallback name
    const userName = profile?.email?.split('@')[0] || 'you';

    // Build the personalized prompt
    const chartContext = hasAdvancedProfile ? `
User's Full Cosmiq Profile:
☀️ Sun: ${profile.zodiac_sign || 'Unknown'}
🌙 Moon: ${profile.moon_sign || 'Unknown'}
⬆️ Rising: ${profile.rising_sign || 'Unknown'}
💭 Mercury: ${profile.mercury_sign || 'Unknown'}
🔥 Mars: ${profile.mars_sign || 'Unknown'}
💗 Venus: ${profile.venus_sign || 'Unknown'}

This user is viewing their ${placement.toUpperCase()} in ${sign.toUpperCase()}.
Generate content that explains how this ${placement} placement specifically interacts with and is colored by their OTHER placements.
Make it feel uniquely written for THIS person's chart.

The "chart_synergy" field should explain concrete ways this placement interacts with their specific Big Three and planets.
For example, if they have Moon in Libra and Sun in Scorpio, explain how Libra's need for harmony softens Scorpio's intensity.
` : `
User has a basic profile with Sun in ${profile.zodiac_sign || sign}.
They are viewing ${placement.toUpperCase()} in ${sign.toUpperCase()}.
Generate insightful content for this placement, but make it feel warm and personalized.
`;

    const prompt = `You are an expert astrologer creating a deeply personalized cosmic deep dive.

${chartContext}

The ${placement} represents: ${placementDescriptions[placement.toLowerCase()] || 'an important astrological placement'}.

Generate a comprehensive, personalized reading for ${placement} in ${sign}. 
Make it feel like it was written specifically for ${userName}, not generic content.
Today's date is ${today} - include a fresh "todays_focus" insight relevant to current cosmic energy.

Return a JSON object with EXACTLY these fields:
{
  "title": "A creative, evocative title for this placement (e.g., 'The Diplomatic Heart' for Moon in Libra)",
  "tagline": "A short, memorable phrase capturing the essence",
  "overview": "2-3 paragraphs explaining what this placement means in ${userName}'s chart specifically. Reference their other placements if available.",
  "strengths": ["strength 1", "strength 2", "strength 3", "strength 4"],
  "challenges": ["challenge 1", "challenge 2", "challenge 3"],
  "in_relationships": "How this placement affects ${userName}'s relationships, with specific examples",
  "in_work": "How this placement shows up in ${userName}'s career and work style",
  "in_wellness": "Self-care and wellness practices that support this placement",
  "compatible_signs": ["sign1", "sign2", "sign3"],
  "daily_practice": "A specific ritual or practice for today",
  "chart_synergy": "How this ${placement} in ${sign} specifically interacts with ${userName}'s other placements. Be concrete and specific.",
  "todays_focus": "A fresh, actionable insight for TODAY (${today}) based on current cosmic energy"
}

Be warm, insightful, and make it feel like a conversation with a wise friend who knows their chart intimately.`;

    console.log('Generating personalized deep dive for', user.id, placement, sign);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "You are an expert astrologer. Return ONLY valid JSON, no markdown formatting or code blocks."
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

    // Parse JSON from response (handle potential markdown wrapping)
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

    // Validate required fields
    const requiredFields = ['title', 'tagline', 'overview', 'strengths', 'challenges', 
                          'in_relationships', 'in_work', 'in_wellness', 'daily_practice'];
    for (const field of requiredFields) {
      if (!content[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Cache the result
    const cacheData = {
      user_id: user.id,
      placement: placement.toLowerCase(),
      sign: sign.toLowerCase(),
      for_date: today,
      title: content.title,
      tagline: content.tagline,
      overview: content.overview,
      strengths: Array.isArray(content.strengths) ? content.strengths : [],
      challenges: Array.isArray(content.challenges) ? content.challenges : [],
      in_relationships: content.in_relationships,
      in_work: content.in_work,
      in_wellness: content.in_wellness,
      compatible_signs: Array.isArray(content.compatible_signs) ? content.compatible_signs : [],
      daily_practice: content.daily_practice,
      chart_synergy: content.chart_synergy || null,
      todays_focus: content.todays_focus || null,
    };

    const { error: insertError } = await supabaseService
      .from('user_cosmic_deep_dives')
      .upsert(cacheData, { onConflict: 'user_id,placement,sign,for_date' });

    if (insertError) {
      console.error('Failed to cache deep dive:', insertError);
      // Don't fail the request, just log the error
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
