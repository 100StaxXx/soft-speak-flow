import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const mentorDailyThemes: Record<string, any[]> = {
  atlas: [
    { topic_category: 'focus', intensity: 'medium', triggers: ['Anxious & Overthinking', 'Feeling Stuck'] },
    { topic_category: 'mindset', intensity: 'medium', triggers: ['In Transition', 'Self-Doubt'] },
    { topic_category: 'business', intensity: 'medium', triggers: ['In Transition', 'Avoiding Action'] }
  ],
  eli: [
    { topic_category: 'confidence', intensity: 'soft', triggers: ['Self-Doubt', 'Heavy or Low'] },
    { topic_category: 'mindset', intensity: 'medium', triggers: ['Heavy or Low', 'Emotionally Hurt'] }
  ],
  nova: [
    { topic_category: 'mindset', intensity: 'medium', triggers: ['Anxious & Overthinking', 'Feeling Stuck'] },
    { topic_category: 'focus', intensity: 'medium', triggers: ['Avoiding Action', 'Exhausted'] }
  ],
  sienna: [
    { topic_category: 'mindset', intensity: 'soft', triggers: ['Emotionally Hurt', 'Heavy or Low'] },
    { topic_category: 'confidence', intensity: 'soft', triggers: ['Self-Doubt', 'Heavy or Low'] }
  ],
  lumi: [
    { topic_category: 'confidence', intensity: 'soft', triggers: ['Self-Doubt', 'Anxious & Overthinking'] },
    { topic_category: 'mindset', intensity: 'soft', triggers: ['Heavy or Low', 'Unmotivated'] }
  ],
  kai: [
    { topic_category: 'discipline', intensity: 'medium', triggers: ['Needing Discipline', 'Unmotivated'] },
    { topic_category: 'physique', intensity: 'medium', triggers: ['Unmotivated', 'Feeling Stuck'] }
  ],
  stryker: [
    { topic_category: 'physique', intensity: 'strong', triggers: ['Unmotivated', 'Needing Discipline', 'Frustrated'] },
    { topic_category: 'business', intensity: 'strong', triggers: ['Motivated & Ready', 'Feeling Stuck'] }
  ],
  carmen: [
    { topic_category: 'discipline', intensity: 'strong', triggers: ['Avoiding Action', 'Needing Discipline'] },
    { topic_category: 'business', intensity: 'strong', triggers: ['In Transition', 'Feeling Stuck'] }
  ],
  reign: [
    { topic_category: 'physique', intensity: 'strong', triggers: ['Unmotivated', 'Needing Discipline', 'Frustrated'] },
    { topic_category: 'business', intensity: 'strong', triggers: ['Motivated & Ready', 'Feeling Stuck'] },
    { topic_category: 'discipline', intensity: 'strong', triggers: ['Avoiding Action', 'Needing Discipline'] }
  ],
  elizabeth: [
    { topic_category: 'confidence', intensity: 'medium', triggers: ['Self-Doubt', 'Feeling Stuck'] },
    { topic_category: 'mindset', intensity: 'medium', triggers: ['Heavy or Low', 'Unmotivated'] }
  ]
};

function generateTitle(mentorSlug: string, category: string): string {
  const titles: Record<string, string[]> = {
    discipline: ['Lock In and Execute', 'Stay Consistent Today', 'Build Your Discipline', 'No Excuses, Just Action'],
    confidence: ['Step Into Your Power', 'Believe in Yourself', 'Own Your Worth', 'Rise Above Doubt'],
    physique: ['Train Like a Champion', 'Push Your Limits', 'Build Your Body', 'Strength Is Earned'],
    focus: ['Stay Locked In', 'Focus on What Matters', 'Eliminate Distractions', 'Sharp Mind, Clear Goals'],
    mindset: ['Shift Your Perspective', 'Master Your Mind', 'Think Bigger Today', 'Growth Starts Here'],
    business: ['Execute Your Vision', 'Build Your Empire', 'Make It Happen', 'Business Moves Today']
  };

  const categoryTitles = titles[category] || ['Take Action Today'];
  const randomIndex = Math.floor(Math.random() * categoryTitles.length);
  return categoryTitles[randomIndex];
}

function generateSummary(category: string): string {
  const summaries: Record<string, string> = {
    discipline: 'A powerful reminder to stay consistent and take action, no matter how you feel.',
    confidence: 'Build unshakeable confidence and step into your power with clarity and purpose.',
    physique: 'Push your physical limits and transform your body through dedication and effort.',
    focus: 'Cut through distractions and lock in on what truly matters for your success.',
    mindset: 'Shift your thinking, overcome mental blocks, and embrace a growth-oriented perspective.',
    business: 'Take strategic action and build momentum toward your entrepreneurial goals.'
  };

  return summaries[category] || 'A daily push to help you move forward with purpose and intention.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting tomorrow pep talk pre-generation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toLocaleDateString('en-CA');
    console.log(`Pre-generating pep talks for date: ${tomorrowDate}`);

    // Get all active mentors
    const { data: mentors, error: mentorsError } = await supabase
      .from('mentors')
      .select('slug, id')
      .eq('is_active', true);

    if (mentorsError) {
      throw new Error(`Failed to fetch mentors: ${mentorsError.message}`);
    }

    const results: { mentor: string; status: string; error?: string }[] = [];

    // Process each mentor sequentially to avoid rate limits
    for (const mentor of mentors || []) {
      const mentorSlug = mentor.slug;
      
      if (!mentorSlug || !mentorDailyThemes[mentorSlug]) {
        console.log(`Skipping mentor without themes: ${mentorSlug}`);
        results.push({ mentor: mentorSlug, status: 'skipped', error: 'No themes configured' });
        continue;
      }

      try {
        // Check if already generated for tomorrow
        const { data: existing } = await supabase
          .from('daily_pep_talks')
          .select('id')
          .eq('mentor_slug', mentorSlug)
          .eq('for_date', tomorrowDate)
          .maybeSingle();

        if (existing) {
          console.log(`Pep talk already exists for ${mentorSlug} on ${tomorrowDate}`);
          results.push({ mentor: mentorSlug, status: 'existing' });
          continue;
        }

        // Get themes and select based on day
        const themes = mentorDailyThemes[mentorSlug];
        const dayOfYear = Math.floor((tomorrow.getTime() - new Date(tomorrow.getFullYear(), 0, 0).getTime()) / 86400000);
        const themeIndex = dayOfYear % themes.length;
        const theme = themes[themeIndex];

        console.log(`Generating for ${mentorSlug} with theme:`, theme);

        // Call generate-full-mentor-audio
        const audioResponse = await fetch(
          `${supabaseUrl}/functions/v1/generate-full-mentor-audio`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              mentorSlug: mentorSlug,
              topic_category: theme.topic_category,
              intensity: theme.intensity,
              emotionalTriggers: theme.triggers
            }),
          }
        );

        if (!audioResponse.ok) {
          const errorText = await audioResponse.text();
          console.error(`Error generating for ${mentorSlug}:`, audioResponse.status, errorText);
          results.push({ mentor: mentorSlug, status: 'error', error: `Audio generation failed: ${audioResponse.status}` });
          continue;
        }

        const { script, audioUrl } = await audioResponse.json();

        if (!script || !audioUrl) {
          results.push({ mentor: mentorSlug, status: 'error', error: 'Missing script or audioUrl' });
          continue;
        }

        // Generate title and summary
        const title = generateTitle(mentorSlug, theme.topic_category);
        const summary = generateSummary(theme.topic_category);

        // Insert into daily_pep_talks for tomorrow
        const { error: insertError } = await supabase
          .from('daily_pep_talks')
          .insert({
            mentor_slug: mentorSlug,
            topic_category: theme.topic_category,
            emotional_triggers: theme.triggers,
            intensity: theme.intensity,
            title,
            summary,
            script,
            audio_url: audioUrl,
            for_date: tomorrowDate
          });

        if (insertError) {
          console.error(`Error inserting for ${mentorSlug}:`, insertError);
          results.push({ mentor: mentorSlug, status: 'error', error: insertError.message });
          continue;
        }

        // Also insert into main pep_talks library
        await supabase
          .from('pep_talks')
          .insert({
            title,
            description: summary,
            quote: script.substring(0, 200) + '...',
            audio_url: audioUrl,
            category: theme.topic_category,
            topic_category: [theme.topic_category],
            emotional_triggers: theme.triggers,
            intensity: theme.intensity,
            mentor_slug: mentorSlug,
            mentor_id: mentor.id,
            source: 'auto_generated',
            for_date: tomorrowDate,
            is_featured: false,
            is_premium: false,
            transcript: []
          });

        console.log(`✓ Generated pep talk for ${mentorSlug}`);
        results.push({ mentor: mentorSlug, status: 'generated' });

        // Small delay between mentors to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (mentorError) {
        console.error(`Error processing ${mentorSlug}:`, mentorError);
        results.push({ 
          mentor: mentorSlug, 
          status: 'error', 
          error: mentorError instanceof Error ? mentorError.message : 'Unknown error' 
        });
      }
    }

    const generated = results.filter(r => r.status === 'generated').length;
    const existing = results.filter(r => r.status === 'existing').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`Pre-generation complete: ${generated} generated, ${existing} existing, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true,
        date: tomorrowDate,
        summary: { generated, existing, errors },
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-tomorrow-pep-talks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
