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

const MENTOR_SLUGS = ['atlas', 'eli', 'nova', 'sienna', 'lumi', 'kai', 'stryker', 'carmen', 'reign', 'elizabeth'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting daily mentor pep talk generation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in UTC
    const today = new Date();
    const todayDate = today.toLocaleDateString('en-CA');
    console.log(`Generating pep talks for date: ${todayDate}`);

    const results = [];
    const errors = [];

    for (const mentorSlug of MENTOR_SLUGS) {
      try {
        console.log(`Processing mentor: ${mentorSlug}`);

        // Check if already generated for today
        const { data: existing, error: checkError } = await supabase
          .from('daily_pep_talks')
          .select('id')
          .eq('mentor_slug', mentorSlug)
          .eq('for_date', todayDate)
          .maybeSingle();

        if (checkError) {
          console.error(`Error checking existing for ${mentorSlug}:`, checkError);
          errors.push({ mentor: mentorSlug, error: checkError.message });
          continue;
        }

        if (existing) {
          console.log(`Pep talk already exists for ${mentorSlug} on ${todayDate}, skipping`);
          results.push({ mentor: mentorSlug, status: 'skipped', reason: 'already_exists' });
          continue;
        }

        // Get mentor themes
        const themes = mentorDailyThemes[mentorSlug];
        if (!themes || themes.length === 0) {
          console.error(`No themes found for mentor: ${mentorSlug}`);
          errors.push({ mentor: mentorSlug, error: 'No themes configured' });
          continue;
        }

        // Select theme based on day of year (consistent rotation)
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
        const themeIndex = dayOfYear % themes.length;
        const theme = themes[themeIndex];
        
        console.log(`Selected theme for ${mentorSlug}:`, theme);

        // Fetch mentor details
        const { data: mentor, error: mentorError } = await supabase
          .from('mentors')
          .select('*')
          .eq('slug', mentorSlug)
          .maybeSingle();

        if (mentorError || !mentor) {
          console.error(`Error fetching mentor ${mentorSlug}:`, mentorError);
          errors.push({ mentor: mentorSlug, error: 'Mentor not found' });
          continue;
        }

        // Generate pep talk using existing function
        console.log(`Calling generate-full-mentor-audio for ${mentorSlug}...`);
        const { data: generatedData, error: generateError } = await supabase.functions.invoke(
          'generate-full-mentor-audio',
          {
            body: {
              mentorSlug: mentorSlug,
              topic_category: theme.topic_category,
              intensity: theme.intensity,
              emotionalTriggers: theme.triggers
            }
          }
        );

        if (generateError || !generatedData) {
          console.error(`Error generating audio for ${mentorSlug}:`, generateError);
          errors.push({ mentor: mentorSlug, error: generateError?.message || 'Generation failed' });
          continue;
        }

        const { script, audioUrl } = generatedData;
        
        if (!script || !audioUrl) {
          console.error(`Missing script or audioUrl for ${mentorSlug}`);
          errors.push({ mentor: mentorSlug, error: 'Incomplete generation response' });
          continue;
        }

        // Generate title and summary
        const title = generateTitle(mentorSlug, theme.topic_category);
        const summary = generateSummary(theme.topic_category, theme.triggers);

        console.log(`Generated content for ${mentorSlug}: ${title}`);

        // Insert into daily_pep_talks
        const { data: dailyPepTalk, error: dailyInsertError } = await supabase
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
            for_date: todayDate
          })
          .select()
          .single();

        if (dailyInsertError) {
          console.error(`Error inserting daily pep talk for ${mentorSlug}:`, dailyInsertError);
          errors.push({ mentor: mentorSlug, error: dailyInsertError.message });
          continue;
        }

        // Insert into main pep_talks library (automatic, no approval needed)
        const { error: libraryInsertError } = await supabase
          .from('pep_talks')
          .insert({
            title,
            description: summary,
            quote: script.substring(0, 200) + '...', // First 200 chars as quote
            audio_url: audioUrl,
            category: theme.topic_category,
            topic_category: [theme.topic_category],
            emotional_triggers: theme.triggers,
            intensity: theme.intensity,
            mentor_slug: mentorSlug,
            mentor_id: mentor.id,
            source: 'daily_auto',
            for_date: todayDate,
            is_featured: false,
            is_premium: false,
            transcript: []
          });

        if (libraryInsertError) {
          console.error(`Error inserting to library for ${mentorSlug}:`, libraryInsertError);
          // Don't fail the whole process if library insert fails
        }

        // Sync transcript for the daily pep talk to enable word-by-word highlighting
        try {
          console.log(`Syncing transcript for daily pep talk ${dailyPepTalk.id}...`);
          await supabase.functions.invoke('sync-daily-pep-talk-transcript', {
            body: { id: dailyPepTalk.id }
          });
          console.log(`✓ Transcript synced for ${mentorSlug}`);
        } catch (syncError) {
          console.error(`Failed to sync transcript for ${mentorSlug}:`, syncError);
          // Non-blocking - continue even if transcript sync fails
        }

        console.log(`✓ Successfully generated daily pep talk for ${mentorSlug}`);
        results.push({ 
          mentor: mentorSlug, 
          status: 'success', 
          id: dailyPepTalk.id,
          title,
          category: theme.topic_category
        });

      } catch (error) {
        console.error(`Error processing ${mentorSlug}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ mentor: mentorSlug, error: errorMessage });
      }
    }

    console.log('Daily generation complete. Results:', results);
    console.log('Errors:', errors);

    return new Response(
      JSON.stringify({
        success: true,
        date: todayDate,
        generated: results.length,
        results,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error in daily generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

function generateSummary(category: string, triggers: string[]): string {
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