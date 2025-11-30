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

    // Parse and validate birthdate - derive from zodiac sign if not explicitly set
    let birthDate: Date;
    
    if (!profile.birthdate) {
      // If no exact birthdate, we need to estimate from zodiac sign
      // For cosmic profile calculation, we need at least the year and approximate date
      console.log('[Cosmic Profile] No birthdate set, will use zodiac midpoint');
      
      // Use zodiac sign to get approximate birth date (middle of zodiac period)
      // This is less accurate but allows calculation if user only selected zodiac
      const zodiacMidpoints: Record<string, string> = {
        'aries': '04-05',       // April 5
        'taurus': '05-05',      // May 5
        'gemini': '06-05',      // June 5
        'cancer': '07-05',      // July 5
        'leo': '08-05',         // August 5
        'virgo': '09-05',       // September 5
        'libra': '10-05',       // October 5
        'scorpio': '11-05',     // November 5
        'sagittarius': '12-05', // December 5
        'capricorn': '01-05',   // January 5
        'aquarius': '02-05',    // February 5
        'pisces': '03-05',      // March 5
      };
      
      const midpoint = zodiacMidpoints[profile.zodiac_sign.toLowerCase()];
      if (!midpoint) {
        return new Response(
          JSON.stringify({ 
            error: 'Unable to determine birth date. Please contact support with your zodiac sign.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Use current year minus 25 as default age (reasonable estimate)
      const currentYear = new Date().getFullYear();
      const estimatedYear = currentYear - 25;
      birthDate = new Date(`${estimatedYear}-${midpoint}`);
      
      console.log('[Cosmic Profile] Using estimated birthdate:', birthDate.toISOString().split('T')[0]);
    } else {
      birthDate = new Date(profile.birthdate);
      if (isNaN(birthDate.getTime())) {
        return new Response(
          JSON.stringify({ error: 'Invalid birthdate format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Normalize birth_time to HH:mm (database stores time as HH:mm:ss, strip seconds if present)
    // Handle both HH:mm and HH:mm:ss formats
    let normalizedBirthTime = '';
    if (typeof profile.birth_time === 'string') {
      // If it contains seconds (HH:mm:ss), take first 5 chars
      // If it's already HH:mm, use as-is
      normalizedBirthTime = profile.birth_time.length > 5 
        ? profile.birth_time.substring(0, 5) 
        : profile.birth_time;
    } else {
      console.error('[Cosmic Profile] birth_time is not a string:', typeof profile.birth_time, profile.birth_time);
      return new Response(
        JSON.stringify({ error: 'Invalid birth time format. Expected HH:mm' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[Cosmic Profile] Original birth_time:', profile.birth_time);
    console.log('[Cosmic Profile] Normalized birth_time:', normalizedBirthTime);
    
    // Validate birth_time format (HH:mm with exactly 2 digits for hours and minutes)
    const timeMatch = normalizedBirthTime.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) {
      console.error('[Cosmic Profile] Failed to match birth_time format:', normalizedBirthTime);
      return new Response(
        JSON.stringify({ error: 'Invalid birth time format. Expected HH:mm (e.g., 14:30)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return new Response(
        JSON.stringify({ error: 'Invalid birth time values. Hours must be 0-23, minutes 0-59' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    birthDate.setHours(hours, minutes, 0);

    // For now, use AI to generate placements based on birth details
    // In production, you would integrate with Prokerala API or similar astrology calculation service
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const calculatePrompt = `Calculate the following astrological placements for someone born:
- Date: ${birthDate.toDateString()}
- Time: ${normalizedBirthTime}
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
    
    if (!placementsText) {
      throw new Error('No placement data returned from AI');
    }
    
    // Clean up response to extract JSON
    placementsText = placementsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let placements;
    try {
      placements = JSON.parse(placementsText);
    } catch (parseError) {
      console.error('[Cosmic Profile] JSON parse error:', parseError);
      console.error('[Cosmic Profile] Raw response:', placementsText);
      throw new Error('Failed to parse astrological calculations. Please try again.');
    }
    
    // Validate that all required fields are present
    const requiredFields = ['moonSign', 'risingSign', 'mercurySign', 'marsSign', 'venusSign'];
    const missingFields = requiredFields.filter(field => !placements[field]);
    if (missingFields.length > 0) {
      console.error('[Cosmic Profile] Missing fields:', missingFields);
      throw new Error('Incomplete astrological calculations. Please try again.');
    }

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