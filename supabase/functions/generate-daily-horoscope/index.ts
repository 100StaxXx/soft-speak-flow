import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

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
      .maybeSingle();

    if (profileError) {
      console.error('[Horoscope] Error fetching profile:', profileError);
      throw profileError;
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found. Please complete onboarding.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // TIMEZONE NOTE: Uses server's local date (en-CA format for yyyy-MM-dd).
    // Edge functions run in UTC timezone on most cloud providers.
    // This means a user in PST at 11pm will see "tomorrow's" horoscope.
    // This is intentional - horoscopes are generated once per calendar day (server time)
    // and cached for all users requesting on that server day.
    // For true user-local dates, the client would need to pass their timezone.
    const today = new Date().toLocaleDateString('en-CA'); // yyyy-MM-dd format
    const hasAdvancedDetails = !!(profile.birthdate && profile.birth_time && profile.birth_location);
    const hasCosmiqProfile = !!(profile.moon_sign && profile.rising_sign);
    
    console.log('[Horoscope] User has advanced details:', hasAdvancedDetails, '| Has cosmiq profile:', hasCosmiqProfile);

    // Check if horoscope already exists for today
    const { data: existingHoroscope, error: fetchError } = await supabaseClient
      .from('user_daily_horoscopes')
      .select('horoscope_text, zodiac, is_personalized, for_date, cosmic_tip, energy_forecast, placement_insights')
      .eq('user_id', user.id)
      .eq('for_date', today)
      .maybeSingle();

    if (fetchError) {
      console.error('[Horoscope] Error fetching existing horoscope:', fetchError);
    }

    if (existingHoroscope) {
      console.log('[Horoscope] Found existing horoscope for', today, 'has cosmic_tip:', !!existingHoroscope.cosmic_tip);
      
      if (existingHoroscope.cosmic_tip) {
        console.log('[Horoscope] Returning cached horoscope');
        return new Response(
          JSON.stringify({ 
            horoscope: existingHoroscope.horoscope_text,
            zodiac: existingHoroscope.zodiac,
            isPersonalized: existingHoroscope.is_personalized,
            date: existingHoroscope.for_date,
            cosmiqTip: existingHoroscope.cosmic_tip,
            energyForecast: existingHoroscope.energy_forecast || null,
            placementInsights: existingHoroscope.placement_insights || null,
            generatedAt: existingHoroscope.for_date, // Indicates this was cached
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      } else {
        // If cosmic_tip is missing, delete old record so we can regenerate
        console.log('[Horoscope] Deleting incomplete horoscope to regenerate with cosmic tip');
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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('[Horoscope] Generating for zodiac:', profile.zodiac_sign, 'Advanced:', hasAdvancedDetails);

    // Helper function for AI calls
    const callAI = async (systemContent: string, userContent: string) => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent }
          ],
        }),
      });
      return response;
    };

    // Generate main horoscope (required)
    const response = await callAI(systemPrompt, userPrompt);

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

    console.log('[Horoscope] Generated horoscope successfully');

    // Prepare prompts for parallel generation
    const tipSystemPrompt = `You are a cosmiq guide sharing mystical wisdom. Your tone is ${mentor?.tone_description || 'warm, insightful, and empowering'}. IMPORTANT: Do not use asterisks (*) for emphasis or formatting. Use plain text only.`;
    const tipUserPrompt = `Generate a single daily cosmiq tip or mystical insight for ${profile.zodiac_sign}. This should be a brief, actionable piece of wisdom about astrology, spirituality, or cosmiq energy. Keep it under 50 words and make it unique and inspiring. Do not use asterisks (*) - use plain text only.`;

    const placementPrompt = hasCosmiqProfile ? `Generate brief daily insights for each astrological placement for ${today}:

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
}` : null;

    // Generate supplementary content in parallel for better performance
    const parallelPromises: Promise<Response | null>[] = [
      // Cosmiq tip (always)
      callAI(tipSystemPrompt, tipUserPrompt),
    ];

    // Add energy forecast and placement insights for cosmiq profiles
    if (hasCosmiqProfile && energyPrompt) {
      parallelPromises.push(callAI('You are a cosmiq guide. Return only valid JSON.', energyPrompt));
    } else {
      parallelPromises.push(Promise.resolve(null));
    }

    if (hasCosmiqProfile && placementPrompt) {
      parallelPromises.push(callAI('You are a cosmiq guide. Return only valid JSON with no markdown formatting.', placementPrompt));
    } else {
      parallelPromises.push(Promise.resolve(null));
    }

    console.log('[Horoscope] Generating supplementary content in parallel...');
    const [tipResponse, energyResponse, placementResponse] = await Promise.all(parallelPromises);

    // Process cosmiq tip
    let cosmiqTip = 'The stars guide those who listen. Trust your inner compass today.';
    if (tipResponse && tipResponse.ok) {
      try {
        const tipData = await tipResponse.json();
        cosmiqTip = tipData.choices?.[0]?.message?.content || cosmiqTip;
        console.log('[Horoscope] Generated cosmiq tip');
      } catch (e) {
        console.error('[Horoscope] Error parsing cosmiq tip:', e);
      }
    }

    // Process energy forecast
    let energyForecast = null;
    if (energyResponse && energyResponse.ok) {
      try {
        const energyData = await energyResponse.json();
        let energyText = energyData.choices?.[0]?.message?.content || '';
        energyText = energyText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        energyForecast = JSON.parse(energyText);
        console.log('[Horoscope] Generated energy forecast');
      } catch (error) {
        console.error('[Horoscope] Error parsing energy forecast:', error);
      }
    }

    // Process placement insights
    let placementInsights = null;
    if (placementResponse && placementResponse.ok) {
      try {
        const placementData = await placementResponse.json();
        let placementText = placementData.choices?.[0]?.message?.content || '';
        placementText = placementText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        placementInsights = JSON.parse(placementText);
        console.log('[Horoscope] Generated placement insights');
      } catch (error) {
        console.error('[Horoscope] Error parsing placement insights:', error);
      }
    }

    // Store the horoscope and cosmic tip for today
    const { error: insertError } = await supabaseClient
      .from('user_daily_horoscopes')
      .insert({
        user_id: user.id,
        for_date: today,
        zodiac: profile.zodiac_sign,
        horoscope_text: horoscope,
        is_personalized: hasAdvancedDetails,
        cosmic_tip: cosmiqTip,
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
        placementInsights,
        generatedAt: null, // Fresh generation, not cached
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
