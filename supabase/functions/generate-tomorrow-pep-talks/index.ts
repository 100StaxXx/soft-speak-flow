import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { insertTomorrowDailyPepTalkAndSync, type SupabaseLikeClient } from "./workflow.ts";
import { ACTIVE_MENTOR_SLUGS, selectThemeForDate } from "../_shared/mentorPepTalkConfig.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get active canonical mentors for pre-generation.
    const { data: mentors, error: mentorsError } = await supabase
      .from('mentors')
      .select('slug, id')
      .eq('is_active', true)
      .in('slug', [...ACTIVE_MENTOR_SLUGS]);

    if (mentorsError) {
      throw new Error(`Failed to fetch mentors: ${mentorsError.message}`);
    }

    const mentorsBySlug = new Map<string, { slug: string; id: string }>();
    for (const mentor of mentors || []) {
      if (mentor?.slug && mentor?.id) {
        mentorsBySlug.set(mentor.slug, { slug: mentor.slug, id: mentor.id });
      }
    }

    const results: { mentor: string; status: string; error?: string }[] = [];

    // Process each mentor sequentially to avoid rate limits
    for (const mentorSlug of ACTIVE_MENTOR_SLUGS) {
      const mentor = mentorsBySlug.get(mentorSlug);
      if (!mentor) {
        console.log(`Skipping missing/inactive mentor row: ${mentorSlug}`);
        results.push({ mentor: mentorSlug, status: 'skipped', error: 'Mentor row missing or inactive' });
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

        const { theme, usedFallbackTheme } = selectThemeForDate(mentorSlug, tomorrow);
        if (usedFallbackTheme) {
          console.warn(`Using fallback theme for mentor ${mentorSlug}`);
        }

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

        // Insert into daily_pep_talks for tomorrow and attempt transcript sync (non-blocking).
        const { dailyPepTalkId } = await insertTomorrowDailyPepTalkAndSync({
          supabase: supabase as unknown as SupabaseLikeClient,
          mentorSlug,
          logger: console,
          beforeSync: async () => {
            // Also insert into main pep_talks library before transcript sync runs.
            const { error: libraryInsertError } = await supabase
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

            if (libraryInsertError) {
              console.error(`Error inserting library pep talk for ${mentorSlug}:`, libraryInsertError);
              // Non-blocking: still continue transcript sync for daily row.
            }
          },
          insertPayload: {
            mentor_slug: mentorSlug,
            topic_category: theme.topic_category,
            emotional_triggers: theme.triggers,
            intensity: theme.intensity,
            title,
            summary,
            script,
            audio_url: audioUrl,
            for_date: tomorrowDate,
          },
        });

        console.log(`✓ Generated pep talk for ${mentorSlug} (daily id=${dailyPepTalkId})`);
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
