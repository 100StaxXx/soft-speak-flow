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

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('zodiac_sign, birthdate, birth_time, birth_location')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw profileError;
    }

    if (!profile?.birth_time || !profile?.birth_location) {
      return new Response(
        JSON.stringify({ error: 'Birth time and location required for cosmic profile calculation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Cosmic Profile] Calculating for user:', user.id);

    // Parse birthdate and time
    const birthDate = profile.birthdate ? new Date(profile.birthdate) : new Date();
    const [hours, minutes] = profile.birth_time.split(':').map(Number);
    birthDate.setHours(hours, minutes, 0);

    // For now, use AI to generate placements based on birth details
    // In production, you would integrate with Prokerala API or similar astrology calculation service
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const calculatePrompt = `Calculate the following astrological placements for someone born:
- Date: ${birthDate.toDateString()}
- Time: ${profile.birth_time}
- Location: ${profile.birth_location}
- Known Sun Sign: ${profile.zodiac_sign}

Determine their:
1. Moon Sign (requires birth time)
2. Rising Sign / Ascendant (requires birth time + location)
3. Mercury Sign
4. Mars Sign
5. Venus Sign

Respond ONLY with a JSON object in this exact format (no markdown, no explanations):
{
  "moonSign": "zodiac_sign_name",
  "risingSign": "zodiac_sign_name",
  "mercurySign": "zodiac_sign_name",
  "marsSign": "zodiac_sign_name",
  "venusSign": "zodiac_sign_name"
}`;

    const placementsResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'You are an expert astrologer. Return only valid JSON with zodiac sign placements.' 
          },
          { role: 'user', content: calculatePrompt }
        ],
      }),
    });

    if (!placementsResponse.ok) {
      throw new Error(`AI calculation failed: ${placementsResponse.status}`);
    }

    const placementsData = await placementsResponse.json();
    let placementsText = placementsData.choices?.[0]?.message?.content || '';
    
    // Clean up response to extract JSON
    placementsText = placementsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const placements = JSON.parse(placementsText);

    console.log('[Cosmic Profile] Calculated placements:', placements);

    // Update profile with calculated placements
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        moon_sign: placements.moonSign.toLowerCase(),
        rising_sign: placements.risingSign.toLowerCase(),
        mercury_sign: placements.mercurySign.toLowerCase(),
        mars_sign: placements.marsSign.toLowerCase(),
        venus_sign: placements.venusSign.toLowerCase(),
        cosmic_profile_generated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Cosmic Profile] Error updating profile:', updateError);
      throw updateError;
    }

    console.log('[Cosmic Profile] Successfully stored placements');

    return new Response(
      JSON.stringify({ 
        success: true,
        cosmicProfile: {
          sunSign: profile.zodiac_sign,
          moonSign: placements.moonSign.toLowerCase(),
          risingSign: placements.risingSign.toLowerCase(),
          mercurySign: placements.mercurySign.toLowerCase(),
          marsSign: placements.marsSign.toLowerCase(),
          venusSign: placements.venusSign.toLowerCase(),
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[Cosmic Profile] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});