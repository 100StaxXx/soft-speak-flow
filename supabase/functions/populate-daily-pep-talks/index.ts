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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];

    console.log(`Populating daily pep talks for ${today}`);

    // Check if we already have pep talks for today
    const { data: existing } = await supabase
      .from('daily_pep_talks')
      .select('id')
      .eq('for_date', today)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('Daily pep talks already exist for today');
      return new Response(
        JSON.stringify({ success: true, message: 'Already populated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all mentors
    const { data: mentors, error: mentorsError } = await supabase
      .from('mentors')
      .select('id, slug, name')
      .eq('is_active', true);

    if (mentorsError || !mentors || mentors.length === 0) {
      throw new Error('No active mentors found');
    }

    const results = [];
    const errors = [];

    // For each mentor, find a suitable pep talk from the library
    for (const mentor of mentors) {
      console.log(`Finding pep talk for ${mentor.name} (${mentor.slug})`);

      // Get pep talks for this mentor
      let pepTalks = [];
      const { data: mentorPepTalks, error: pepTalksError } = await supabase
        .from('pep_talks')
        .select('*')
        .eq('mentor_id', mentor.id)
        .limit(20);

      if (!pepTalksError && mentorPepTalks && mentorPepTalks.length > 0) {
        pepTalks = mentorPepTalks;
      } else {
        console.log(`No pep talks found for ${mentor.slug}, trying category match`);
        
        // Try to find any pep talk with matching topic_category
        const { data: anyPepTalks } = await supabase
          .from('pep_talks')
          .select('*')
          .limit(10);

        if (!anyPepTalks || anyPepTalks.length === 0) {
          errors.push({ mentor: mentor.slug, error: 'No pep talks available' });
          continue;
        }
        
        pepTalks = anyPepTalks;
      }

      // Select a random pep talk
      const randomIndex = Math.floor(Math.random() * pepTalks.length);
      const selectedPepTalk = pepTalks[randomIndex];

      // Create the daily pep talk entry
      const dailyPepTalk = {
        for_date: today,
        mentor_slug: mentor.slug,
        title: selectedPepTalk.title,
        script: selectedPepTalk.quote || selectedPepTalk.description,
        summary: selectedPepTalk.description,
        audio_url: selectedPepTalk.audio_url,
        topic_category: (selectedPepTalk.topic_category as string[])?.[0] || selectedPepTalk.category || 'motivation',
        intensity: selectedPepTalk.intensity || 'medium',
        emotional_triggers: (selectedPepTalk.emotional_triggers as string[]) || []
      };

      const { data: inserted, error: insertError } = await supabase
        .from('daily_pep_talks')
        .insert(dailyPepTalk)
        .select()
        .single();

      if (insertError) {
        console.error(`Error inserting daily pep talk for ${mentor.slug}:`, insertError);
        errors.push({ mentor: mentor.slug, error: insertError.message });
      } else {
        console.log(`Created daily pep talk for ${mentor.slug}: ${dailyPepTalk.title}`);
        results.push({ mentor: mentor.slug, title: dailyPepTalk.title });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        generated: results.length,
        results,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in populate-daily-pep-talks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
