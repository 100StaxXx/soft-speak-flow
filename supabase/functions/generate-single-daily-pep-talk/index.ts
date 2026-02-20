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
  darius: [
    { topic_category: 'discipline', intensity: 'strong', triggers: ['Avoiding Action', 'Needing Discipline', 'Unmotivated'] },
    { topic_category: 'business', intensity: 'medium', triggers: ['Feeling Stuck', 'In Transition'] }
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
  solace: [
    { topic_category: 'mindset', intensity: 'soft', triggers: ['Heavy or Low', 'Emotionally Hurt'] },
    { topic_category: 'focus', intensity: 'soft', triggers: ['Anxious & Overthinking', 'Feeling Stuck'] }
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
    const { mentorSlug } = await req.json();

    if (!mentorSlug) {
      throw new Error('mentorSlug is required');
    }

    console.log(`Starting single pep talk generation for mentor: ${mentorSlug}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    const todayDate = today.toLocaleDateString('en-CA');
    console.log(`Generating pep talk for date: ${todayDate}`);

    // Check if already generated for today
    const { data: existing, error: checkError } = await supabase
      .from('daily_pep_talks')
      .select('*')
      .eq('mentor_slug', mentorSlug)
      .eq('for_date', todayDate)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing pep talk:', checkError);
      throw new Error('Failed to check existing pep talk');
    }

    // If already exists, return it
    if (existing) {
      console.log(`Pep talk already exists for ${mentorSlug} on ${todayDate}, returning existing`);
      return new Response(
        JSON.stringify({ pepTalk: existing, status: 'existing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get mentor themes
    const themes = mentorDailyThemes[mentorSlug];
    if (!themes || themes.length === 0) {
      throw new Error(`No themes configured for mentor: ${mentorSlug}`);
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
      throw new Error(`Mentor not found: ${mentorSlug}`);
    }

    // Generate pep talk using existing function via direct fetch (edge-to-edge call)
    console.log(`Calling generate-full-mentor-audio for ${mentorSlug}...`);
    
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
      console.error('Error generating audio:', audioResponse.status, errorText);
      throw new Error(`Audio generation failed: ${audioResponse.status}`);
    }

    const generatedData = await audioResponse.json();

    const { script, audioUrl } = generatedData;
    
    if (!script || !audioUrl) {
      throw new Error('Incomplete generation response - missing script or audioUrl');
    }

    // Generate title and summary
    const title = generateTitle(mentorSlug, theme.topic_category);
    const summary = generateSummary(theme.topic_category);

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
      console.error('Error inserting daily pep talk:', dailyInsertError);
      throw new Error('Failed to save pep talk');
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
        source: 'user_generated',
        for_date: todayDate,
        is_featured: false,
        is_premium: false,
        transcript: []
      });

    // Non-blocking transcript sync to reduce client-side sync retries.
    try {
      console.log(`Syncing transcript for daily pep talk ${dailyPepTalk.id}...`);
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-daily-pep-talk-transcript', {
        body: { id: dailyPepTalk.id },
      });

      if (syncError) {
        console.error(`Transcript sync failed for ${dailyPepTalk.id}:`, syncError);
      } else {
        const syncPayload = (syncData && typeof syncData === "object")
          ? syncData as Record<string, unknown>
          : {};
        const libraryRowsUpdated =
          typeof syncPayload.libraryRowsUpdated === "number" ? syncPayload.libraryRowsUpdated : 0;
        const warning = typeof syncPayload.warning === "string" ? syncPayload.warning : null;
        console.log(`✓ Transcript synced for ${dailyPepTalk.id}`, {
          updated: syncPayload.updated === true,
          transcriptChanged: syncPayload.transcriptChanged === true,
          libraryUpdated: syncPayload.libraryUpdated === true,
          libraryRowsUpdated,
          warning,
        });
      }
    } catch (syncError) {
      console.error(`Transcript sync threw for ${dailyPepTalk.id}:`, syncError);
      // Keep pep talk generation successful even when transcript sync fails.
    }

    console.log(`✓ Successfully generated daily pep talk for ${mentorSlug}`);

    return new Response(
      JSON.stringify({ 
        pepTalk: dailyPepTalk, 
        status: 'generated' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-single-daily-pep-talk:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
