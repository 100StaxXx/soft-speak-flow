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

    // Fetch user profile with cosmic_profile_generated_at for daily limit check
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('zodiac_sign, birthdate, birth_time, birth_location, cosmic_profile_generated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw profileError;
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found. Please complete onboarding.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if profile was already generated today (database-level check)
    if (profile?.cosmic_profile_generated_at) {
      const generatedDate = new Date(profile.cosmic_profile_generated_at);
      const today = new Date();
      
      // Compare dates (same day check)
      if (generatedDate.toDateString() === today.toDateString()) {
        return new Response(
          JSON.stringify({ error: 'Cosmiq profile already generated today. You can generate once per 24 hours.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate all required fields
    if (!profile?.birthdate) {
      return new Response(
        JSON.stringify({ error: 'Birthdate is required for cosmiq profile calculation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile?.birth_time || !profile?.birth_location) {
      return new Response(
        JSON.stringify({ error: 'Birth time and location required for cosmiq profile calculation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Cosmiq Profile] Calculating for user:', user.id);

    // Parse and validate birthdate and time
    const birthDate = new Date(profile.birthdate);
    
    // Normalize birth_time to HH:mm (database stores HH:mm:ss, strip seconds)
    // Convert to string first to handle any type from database
    const birthTimeStr = String(profile.birth_time || '').trim();
    
    console.log('[Cosmiq Profile] Original birth_time:', profile.birth_time);
    console.log('[Cosmiq Profile] Birth time type:', typeof profile.birth_time);
    console.log('[Cosmiq Profile] Birth time as string:', birthTimeStr);
    
    // Extract HH:mm from various possible formats (HH:mm:ss, HH:mm, or other)
    let normalizedBirthTime = '';
    if (birthTimeStr.length >= 5) {
      normalizedBirthTime = birthTimeStr.substring(0, 5);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid birth time format. Expected HH:mm' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[Cosmiq Profile] Normalized birth_time:', normalizedBirthTime);
    
    // Validate birth_time format (HH:mm)
    const timeMatch = normalizedBirthTime.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) {
      console.error('[Cosmiq Profile] Failed to match birth_time format. Expected HH:mm, got:', normalizedBirthTime);
      return new Response(
        JSON.stringify({ error: 'Invalid birth time format. Expected HH:mm (e.g., 14:30)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('[Cosmiq Profile] Invalid time values. Hours:', hours, 'Minutes:', minutes);
      return new Response(
        JSON.stringify({ error: `Invalid time values. Please use 24-hour format (00:00 to 23:59)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    birthDate.setHours(hours, minutes, 0);

    // For now, use AI to generate placements based on birth details
    // In production, you would integrate with Prokerala API or similar astrology calculation service
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
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

    const placementsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
      console.error('[Cosmiq Profile] JSON parse error:', parseError);
      console.error('[Cosmiq Profile] Raw response:', placementsText);
      throw new Error('Failed to parse astrological calculations. Please try again.');
    }
    
    // Validate that all required fields are present
    const requiredFields = ['moonSign', 'risingSign', 'mercurySign', 'marsSign', 'venusSign'];
    const missingFields = requiredFields.filter(field => !placements[field]);
    if (missingFields.length > 0) {
      console.error('[Cosmiq Profile] Missing fields:', missingFields);
      throw new Error('Incomplete astrological calculations. Please try again.');
    }

    console.log('[Cosmiq Profile] Calculated placements:', placements);

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
      console.error('[Cosmiq Profile] Error updating profile:', updateError);
      throw updateError;
    }

    console.log('[Cosmiq Profile] Successfully stored placements');

    return new Response(
      JSON.stringify({ 
        success: true,
        cosmiqProfile: {
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
    console.error('[Cosmiq Profile] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
