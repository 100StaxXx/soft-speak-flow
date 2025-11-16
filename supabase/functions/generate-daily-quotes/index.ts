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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log("Starting daily quote generation...");

    const today = new Date().toISOString().split('T')[0];

    // Get all active mentors
    const { data: mentors, error: mentorsError } = await supabase
      .from('mentors')
      .select('id, slug, name')
      .eq('is_active', true);

    if (mentorsError) {
      console.error("Error fetching mentors:", mentorsError);
      throw mentorsError;
    }

    console.log(`Found ${mentors?.length || 0} active mentors`);

    let generated = 0;
    let skipped = 0;

    for (const mentor of mentors || []) {
      try {
        // Check if quote already exists for today
        const { data: existing } = await supabase
          .from('daily_quotes')
          .select('id')
          .eq('for_date', today)
          .eq('mentor_slug', mentor.slug)
          .single();

        if (existing) {
          console.log(`Daily quote already exists for ${mentor.slug} on ${today}`);
          skipped++;
          continue;
        }

        // Get a random quote for this mentor
        const { data: quotes, error: quotesError } = await supabase
          .from('quotes')
          .select('id')
          .or(`mentor_id.eq.${mentor.id},mentor_id.is.null`)
          .limit(50);

        if (quotesError || !quotes || quotes.length === 0) {
          console.error(`No quotes found for mentor ${mentor.slug}`);
          continue;
        }

        // Pick a random quote
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        // Insert daily quote
        const { error: insertError } = await supabase
          .from('daily_quotes')
          .insert({
            quote_id: randomQuote.id,
            mentor_slug: mentor.slug,
            for_date: today,
          });

        if (insertError) {
          console.error(`Error creating daily quote for ${mentor.slug}:`, insertError);
          continue;
        }

        generated++;
        console.log(`Generated daily quote for ${mentor.slug}`);
      } catch (error) {
        console.error(`Error processing mentor ${mentor.slug}:`, error);
      }
    }

    console.log(`Daily quote generation complete. Generated: ${generated}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        generated,
        skipped,
        total: mentors?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
