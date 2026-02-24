import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";
import { summarizeFunctionInvokeError } from "../_shared/functionInvokeError.ts";
import { ACTIVE_MENTOR_SLUGS, selectThemeForDate } from "../_shared/mentorPepTalkConfig.ts";
import {
  buildReadyTranscriptState,
  buildRetryTranscriptState,
  parseTranscriptSyncPayload,
  TRANSCRIPT_STATUS_PENDING,
} from "../_shared/transcriptRetryState.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    if (!auth.isServiceRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    for (const mentorSlug of ACTIVE_MENTOR_SLUGS) {
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

        const { theme, usedFallbackTheme } = selectThemeForDate(mentorSlug, today);
        if (usedFallbackTheme) {
          console.warn(`Using fallback theme for mentor ${mentorSlug}`);
        }
        
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
            for_date: todayDate,
            transcript_status: TRANSCRIPT_STATUS_PENDING,
            transcript_attempt_count: 0,
            transcript_next_retry_at: new Date().toISOString(),
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

        const currentAttemptCount = dailyPepTalk.transcript_attempt_count ?? 0;
        const persistTranscriptState = async (payload: Record<string, unknown>) => {
          const { error } = await supabase
            .from('daily_pep_talks')
            .update(payload)
            .eq('id', dailyPepTalk.id);

          if (error) {
            console.error(`Failed to persist transcript state for ${mentorSlug}:`, error);
          }
        };

        // Sync transcript for the daily pep talk to enable word-by-word highlighting
        try {
          console.log(`Syncing transcript for daily pep talk ${dailyPepTalk.id}...`);
          const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-daily-pep-talk-transcript', {
            body: { id: dailyPepTalk.id }
          });

          if (syncError) {
            const summary = await summarizeFunctionInvokeError(syncError);
            console.error(`Transcript sync returned error for ${mentorSlug}:`, summary);
            const retryState = buildRetryTranscriptState({
              currentAttemptCount,
              errorMessage: typeof summary === "string" ? summary : "Transcript sync returned error",
            });
            await persistTranscriptState(retryState.update);
          } else {
            const syncPayload = (syncData && typeof syncData === "object")
              ? syncData as Record<string, unknown>
              : {};
            const parsedPayload = parseTranscriptSyncPayload(syncPayload);
            const libraryRowsUpdated =
              typeof syncPayload.libraryRowsUpdated === "number" ? syncPayload.libraryRowsUpdated : 0;
            const warning = typeof syncPayload.warning === "string" ? syncPayload.warning : null;

            if (parsedPayload.hasWordTimestamps && parsedPayload.wordCount > 0) {
              await persistTranscriptState(buildReadyTranscriptState(currentAttemptCount));
            } else {
              const retryState = buildRetryTranscriptState({
                currentAttemptCount,
                errorMessage:
                  parsedPayload.error ??
                  warning ??
                  "Transcription returned no word-level timestamps",
              });
              await persistTranscriptState(retryState.update);
            }

            console.log(`✓ Transcript synced for ${mentorSlug}`, {
              updated: syncPayload.updated === true,
              hasWordTimestamps: parsedPayload.hasWordTimestamps,
              wordCount: parsedPayload.wordCount,
              retryRecommended: parsedPayload.retryRecommended,
              transcriptChanged: syncPayload.transcriptChanged === true,
              libraryUpdated: syncPayload.libraryUpdated === true,
              libraryRowsUpdated,
              warning,
            });
          }
        } catch (syncError) {
          const summary = await summarizeFunctionInvokeError(syncError);
          console.error(`Failed to sync transcript for ${mentorSlug}:`, summary);
          const retryState = buildRetryTranscriptState({
            currentAttemptCount,
            errorMessage: typeof summary === "string" ? summary : "Transcript sync threw",
          });
          await persistTranscriptState(retryState.update);
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
