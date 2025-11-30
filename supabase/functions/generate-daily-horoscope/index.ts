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
      .select('zodiac_sign, birthdate, birth_time, birth_location, selected_mentor_id, moon_sign, rising_sign, mercury_sign, mars_sign, venus_sign')
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

    // Fetch mentor info for personalization (optional - fallback to default if not found)
    const { data: mentor, error: mentorError } = await supabaseClient
      .from('mentors')
      .select('name, tone_description, style_description')
      .eq('id', profile.selected_mentor_id)
      .maybeSingle();
    
    if (mentorError) {
      console.error('[Horoscope] Error fetching mentor:', mentorError);
      // Continue without mentor context - use defaults
    }

    // Use local date instead of UTC to avoid timezone issues
    const today = new Date().toLocaleDateString('en-CA'); // yyyy-MM-dd format
    const hasAdvancedDetails = !!(profile.birthdate && profile.birth_time && profile.birth_location);
    const hasCosmiqProfile = !!(profile.moon_sign && profile.rising_sign);
    
    console.log('[Horoscope] User has advanced details:', hasAdvancedDetails, '| Has cosmiq profile:', hasCosmiqProfile);

    // Check if horoscope already exists for today
    const { data: existingHoroscope, error: fetchError } = await supabaseClient
      .from('user_daily_horoscopes')
      .select('horoscope_text, zodiac, is_personalized, for_date, cosmiq_tip, energy_forecast, placement_insights')
      .eq('user_id', user.id)
      .eq('for_date', today)
      .maybeSingle();

    if (fetchError) {
      console.error('[Horoscope] Error fetching existing horoscope:', fetchError);
    }

    if (existingHoroscope) {
      console.log('[Horoscope] Found existing horoscope for', today, 'has cosmiq_tip:', !!existingHoroscope.cosmiq_tip);
      
      if (existingHoroscope.cosmiq_tip) {
        console.log('[Horoscope] Returning cached horoscope');
        return new Response(
          JSON.stringify({ 
            horoscope: existingHoroscope.horoscope_text,
            zodiac: existingHoroscope.zodiac,
            isPersonalized: existingHoroscope.is_personalized,
            date: existingHoroscope.for_date,
            cosmiqTip: existingHoroscope.cosmiq_tip,
            energyForecast: existingHoroscope.energy_forecast || null,
            placementInsights: existingHoroscope.placement_insights || null
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      } else {
        // If cosmiq_tip is missing, delete old record so we can regenerate
        console.log('[Horoscope] Deleting incomplete horoscope to regenerate with cosmiq tip');
        await supabaseClient
          .from('user_daily_horoscopes')
          .delete()
          .eq('user_id', user.id)
          .eq('for_date', today);
      }
    } else {
      console.log('[Horoscope] No existing horoscope found for', today, '- will generate new one');
    }

    // Build prompt based on whether user has advanced astrology details
    const systemPrompt = `You are a cosmiq guide providing daily horoscope messages. Your tone is ${mentor?.tone_description || 'warm, insightful, and empowering'}. ${mentor?.style_description || ''} IMPORTANT: Do not use asterisks (*) for emphasis or formatting. Use plain text only.`;
    
    let userPrompt = '';
    let energyPrompt = '';
    
    if (hasCosmiqProfile) {
      // Full cosmiq profile available - use all 6 placements
      userPrompt = `Generate a deeply personalized daily horoscope for ${today}.

Their Cosmiq Profile:
☀️ Sun: ${profile.zodiac_sign}
🌙 Moon: ${profile.moon_sign}
⬆️ Rising: ${profile.rising_sign}
💭 Mercury: ${profile.mercury_sign}
🔥 Mars: ${profile.mars_sign}
💗 Venus: ${profile.venus_sign}

Birth Time: ${profile.birth_time}
Birth Location: ${profile.birth_location}

Weave together:
- How their Big Three (Sun/Moon/Rising) interact with today's cosmiq energy
- Mercury's influence on their mind and communication today
- Mars energy affecting their drive and body
- Venus coloring their relationships and soul connections
- Specific actionable guidance that feels personal to this exact cosmiq combination

Keep it conversational, inspiring, and under 200 words. Do not use asterisks (*) for emphasis - use plain text only.`;

      energyPrompt = `Based on this person's cosmiq profile for ${today}, generate an energy forecast:

Cosmiq Profile:
Sun: ${profile.zodiac_sign}, Moon: ${profile.moon_sign}, Rising: ${profile.rising_sign}
Mercury: ${profile.mercury_sign}, Mars: ${profile.mars_sign}, Venus: ${profile.venus_sign}

Respond with a JSON object containing:
{
  "planetaryWeather": "One sentence describing today's general cosmiq energy in simple terms",
  "mindEnergy": "One sentence about mental/intellectual energy today (1-10 scale implied)",
  "bodyEnergy": "One sentence about physical/action energy today", 
  "soulEnergy": "One sentence about emotional/spiritual energy today"
}

Keep each sentence under 20 words. Use plain language. No asterisks.`;
    } else if (hasAdvancedDetails) {
      userPrompt = `Generate a personalized daily horoscope for ${profile.zodiac_sign} for ${today}.

Birth Time: ${profile.birth_time}
Birth Location: ${profile.birth_location}

Include:
- Rising sign influence (calculate based on birth time/location)
- Current planetary transits affecting their chart
- Specific guidance for mind, body, and soul
- One actionable cosmiq insight for today

Keep it conversational, inspiring, and under 200 words. Do not use asterisks (*) for emphasis - use plain text only.`;
    } else {
      userPrompt = `Generate a daily horoscope for ${profile.zodiac_sign} for ${today}.

Focus on:
- General energy and themes for ${profile.zodiac_sign} today
- Guidance for personal growth
- One cosmiq insight or affirmation
- Encouragement aligned with their zodiac strengths

Keep it warm, inspiring, and under 150 words. Do not use asterisks (*) for emphasis - use plain text only.`;
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

    // Generate cosmiq tip
    const tipResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: `You are a cosmiq guide sharing mystical wisdom. Your tone is ${mentor?.tone_description || 'warm, insightful, and empowering'}. IMPORTANT: Do not use asterisks (*) for emphasis or formatting. Use plain text only.` 
          },
          { 
            role: 'user', 
            content: `Generate a single daily cosmiq tip or mystical insight for ${profile.zodiac_sign}. This should be a brief, actionable piece of wisdom about astrology, spirituality, or cosmiq energy. Keep it under 50 words and make it unique and inspiring. Do not use asterisks (*) - use plain text only.` 
          }
        ],
      }),
    });

    let cosmiqTip = 'The stars guide those who listen. Trust your inner compass today.';
    if (tipResponse.ok) {
      const tipData = await tipResponse.json();
      cosmiqTip = tipData.choices?.[0]?.message?.content || cosmiqTip;
    }

    console.log('[Horoscope] Generated cosmiq tip');

    // Generate energy forecast for advanced profiles
    let energyForecast = null;
    if (hasCosmiqProfile && energyPrompt) {
      try {
        const energyResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a cosmiq guide. Return only valid JSON.' },
              { role: 'user', content: energyPrompt }
            ],
          }),
        });

        if (energyResponse.ok) {
          const energyData = await energyResponse.json();
          let energyText = energyData.choices?.[0]?.message?.content || '';
          energyText = energyText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          energyForecast = JSON.parse(energyText);
          console.log('[Horoscope] Generated energy forecast');
        }
      } catch (error) {
        console.error('[Horoscope] Error generating energy forecast:', error);
        // Non-critical, continue without it
      }
    }

    // Generate placement-specific insights for personalized profiles
    let placementInsights = null;
    if (hasCosmiqProfile) {
      try {
        const placementPrompt = `Generate brief daily insights for each astrological placement for ${today}:

Cosmiq Profile:
- Sun in ${profile.zodiac_sign}: Core identity and life force
- Moon in ${profile.moon_sign}: Emotions and inner world
- Rising in ${profile.rising_sign}: Outer persona and first impressions
- Mercury in ${profile.mercury_sign}: Communication and thought processes
- Mars in ${profile.mars_sign}: Energy and action
- Venus in ${profile.venus_sign}: Values and relationships

For each placement, write ONE brief sentence (under 15 words) about how that specific placement's energy shows up TODAY. Make it conversational and actionable.

Respond with JSON:
{
  "sun": "brief insight about Sun in ${profile.zodiac_sign} today",
  "moon": "brief insight about Moon in ${profile.moon_sign} today",
  "rising": "brief insight about Rising in ${profile.rising_sign} today",
  "mercury": "brief insight about Mercury in ${profile.mercury_sign} today",
  "mars": "brief insight about Mars in ${profile.mars_sign} today",
  "venus": "brief insight about Venus in ${profile.venus_sign} today"
}`;

        const placementResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a cosmiq guide. Return only valid JSON with no markdown formatting.' },
              { role: 'user', content: placementPrompt }
            ],
          }),
        });

        if (placementResponse.ok) {
          const placementData = await placementResponse.json();
          let placementText = placementData.choices?.[0]?.message?.content || '';
          placementText = placementText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          placementInsights = JSON.parse(placementText);
          console.log('[Horoscope] Generated placement insights');
        }
      } catch (error) {
        console.error('[Horoscope] Error generating placement insights:', error);
        // Non-critical, continue without it
      }
    }

    // Store the horoscope and cosmiq tip for today
    const { error: insertError } = await supabaseClient
      .from('user_daily_horoscopes')
      .insert({
        user_id: user.id,
        for_date: today,
        zodiac: profile.zodiac_sign,
        horoscope_text: horoscope,
        is_personalized: hasAdvancedDetails,
        cosmiq_tip: cosmiqTip,
        energy_forecast: energyForecast,
        placement_insights: placementInsights
      });

    if (insertError) {
      console.error('[Horoscope] Error storing horoscope:', insertError);
      // Don't throw - still return the generated horoscope even if storage fails
    }

    return new Response(
      JSON.stringify({ 
        horoscope,
        zodiac: profile.zodiac_sign,
        isPersonalized: hasAdvancedDetails,
        date: today,
        cosmiqTip,
        energyForecast,
        placementInsights
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
