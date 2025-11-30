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
      .select('zodiac_sign, birth_time, birth_location, selected_mentor_id, moon_sign, rising_sign, mercury_sign, mars_sign, venus_sign')
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
    const hasAdvancedDetails = !!(profile.birth_time && profile.birth_location);
    const hasCosmicProfile = !!(profile.moon_sign && profile.rising_sign);

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
            cosmicTip: existingHoroscope.cosmic_tip,
            energyForecast: existingHoroscope.energy_forecast || null,
            placementInsights: existingHoroscope.placement_insights || null
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
    const systemPrompt = `You are a personal cosmic guide. Write like a wise friend who truly knows this person - warm, direct, conversational. No fluff or generic astrology speak. Make it feel like you're speaking directly to them about their unique day ahead. ${mentor?.tone_description || ''} Never use asterisks or technical jargon.`;
    
    let userPrompt = '';
    let energyPrompt = '';
    
    if (hasCosmicProfile) {
      // Full cosmic profile available - use all 6 placements
      userPrompt = `Write a personal daily reading for someone born on ${today}.

Their cosmic blueprint:
Sun ${profile.zodiac_sign} / Moon ${profile.moon_sign} / Rising ${profile.rising_sign}
Mercury ${profile.mercury_sign} / Mars ${profile.mars_sign} / Venus ${profile.venus_sign}

Born at ${profile.birth_time} in ${profile.birth_location}

Write this like you're texting a friend. Focus on:
- What today will actually feel like for THEM specifically (not generic zodiac stuff)
- One specific thing they should pay attention to
- One action they can take
- How their unique combo of signs shapes today's experience

Keep it real, personal, and under 150 words. No generic horoscope phrases. Make them feel seen.`;

      energyPrompt = `For someone with Sun ${profile.zodiac_sign}, Moon ${profile.moon_sign}, Rising ${profile.rising_sign}, Mercury ${profile.mercury_sign}, Mars ${profile.mars_sign}, Venus ${profile.venus_sign} - what's their energy vibe for ${today}?

Return JSON:
{
  "planetaryWeather": "What the cosmic energy feels like today in one simple sentence",
  "mindEnergy": "How clear/foggy their head will be - practical note",
  "bodyEnergy": "Physical energy level and what to do with it", 
  "soulEnergy": "Emotional weather and how to work with it"
}

Write like a friend checking in. Each 12-15 words max. No fluff.`;
    } else if (hasAdvancedDetails) {
      userPrompt = `Write a personal reading for a ${profile.zodiac_sign} born at ${profile.birth_time} in ${profile.birth_location} for ${today}.

Consider their unique birth chart placement. Focus on:
- What today will actually feel like for them
- One specific insight about their rising sign's influence
- One thing they should focus on
- Simple action they can take

Write it like texting a friend - warm, direct, personal. Under 130 words. No generic astrology speak.`;
    } else {
      userPrompt = `Write a personal daily message for someone who's a ${profile.zodiac_sign} for ${today}.

Make it feel personal and specific:
- What's the real energy of their day going to be like?
- One thing to watch out for or lean into
- One small action aligned with who they are
- Brief encouragement that feels genuine

Write like you're checking in on a friend. Warm, real, direct. Under 120 words. No generic horoscope phrases.`;
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

    // Generate cosmic tip
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
            content: `You're a wise friend sharing a quick piece of cosmic wisdom. Keep it real and practical. ${mentor?.tone_description || ''} No asterisks or mystical fluff.` 
          },
          { 
            role: 'user', 
            content: `Share one small cosmic insight for a ${profile.zodiac_sign} today. Something simple they can actually use. 30 words max. Make it feel personal, not generic.` 
          }
        ],
      }),
    });

    let cosmicTip = 'Trust your gut today. Your intuition is sharper than you think.';
    if (tipResponse.ok) {
      const tipData = await tipResponse.json();
      cosmicTip = tipData.choices?.[0]?.message?.content || cosmicTip;
    }

    console.log('[Horoscope] Generated cosmic tip');

    // Generate energy forecast for advanced profiles
    let energyForecast = null;
    if (hasCosmicProfile && energyPrompt) {
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
              { role: 'system', content: 'You are a cosmic guide. Return only valid JSON.' },
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
    if (hasCosmicProfile) {
      try {
        const placementPrompt = `Quick daily notes for someone with these placements on ${today}:

Sun ${profile.zodiac_sign} / Moon ${profile.moon_sign} / Rising ${profile.rising_sign}
Mercury ${profile.mercury_sign} / Mars ${profile.mars_sign} / Venus ${profile.venus_sign}

For each, write ONE super short note about how it shows up today. 10-12 words each. Skip the astrology textbook stuff - just what they need to know.

Return JSON:
{
  "sun": "how their core ${profile.zodiac_sign} energy plays out today",
  "moon": "what their ${profile.moon_sign} emotions are doing",
  "rising": "how they're coming across to others today",
  "mercury": "what's up with their ${profile.mercury_sign} mind/communication",
  "mars": "where their ${profile.mars_sign} drive/energy goes",
  "venus": "how ${profile.venus_sign} affects connections/pleasure today"
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
              { role: 'system', content: 'Return only valid JSON. Write like a friend texting quick notes.' },
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

    // Store the horoscope and cosmic tip for today
    const { error: insertError } = await supabaseClient
      .from('user_daily_horoscopes')
      .insert({
        user_id: user.id,
        for_date: today,
        zodiac: profile.zodiac_sign,
        horoscope_text: horoscope,
        is_personalized: hasAdvancedDetails,
        cosmic_tip: cosmicTip,
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
        cosmicTip,
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
