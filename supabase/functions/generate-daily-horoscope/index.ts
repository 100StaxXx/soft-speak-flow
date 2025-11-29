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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Fetch user profile with zodiac and optional birth details
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('zodiac_sign, birth_time, birth_location, selected_mentor_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw profileError;
    }

    if (!profile?.zodiac_sign) {
      return new Response(
        JSON.stringify({ error: 'No zodiac sign found. Please complete onboarding.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch mentor info for personalization
    const { data: mentor } = await supabaseClient
      .from('mentors')
      .select('name, tone_description, style_description')
      .eq('id', profile.selected_mentor_id)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const hasAdvancedDetails = !!(profile.birth_time && profile.birth_location);

    // Build prompt based on whether user has advanced astrology details
    let systemPrompt = `You are a cosmic guide providing daily horoscope messages. Your tone is ${mentor?.tone_description || 'warm, insightful, and empowering'}. ${mentor?.style_description || ''}`;
    
    let userPrompt = '';
    if (hasAdvancedDetails) {
      userPrompt = `Generate a personalized daily horoscope for ${profile.zodiac_sign} for ${today}.

Birth Time: ${profile.birth_time}
Birth Location: ${profile.birth_location}

Include:
- Rising sign influence (calculate based on birth time/location)
- Current planetary transits affecting their chart
- Specific guidance for mind, body, and soul
- One actionable cosmic insight for today

Keep it conversational, inspiring, and under 200 words.`;
    } else {
      userPrompt = `Generate a daily horoscope for ${profile.zodiac_sign} for ${today}.

Focus on:
- General energy and themes for ${profile.zodiac_sign} today
- Guidance for personal growth
- One cosmic insight or affirmation
- Encouragement aligned with their zodiac strengths

Keep it warm, inspiring, and under 150 words.`;
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('[Horoscope] Generating for zodiac:', profile.zodiac_sign, 'Advanced:', hasAdvancedDetails);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Horoscope] AI API error:', response.status, errorText);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const horoscope = data.choices?.[0]?.message?.content;

    if (!horoscope) {
      throw new Error('No horoscope content generated');
    }

    console.log('[Horoscope] Generated successfully');

    return new Response(
      JSON.stringify({ 
        horoscope,
        zodiac: profile.zodiac_sign,
        isPersonalized: hasAdvancedDetails,
        date: today
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[Horoscope] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
