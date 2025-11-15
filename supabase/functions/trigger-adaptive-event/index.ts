import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Event type to category mapping
const eventCategoryMap: Record<string, string> = {
  low_motivation: "confidence",
  overthinking: "calm",
  heartbreak_spike: "love",
  return_after_break: "discipline",
};

// Category to mentor slug mappings
const categoryMentorMap: Record<string, string[]> = {
  discipline: ["darius", "kai", "stryker", "atlas"],
  confidence: ["eli", "darius"],
  healing: ["sienna", "lumi", "solace"],
  calm: ["nova", "atlas"],
  focus: ["stryker", "kai", "atlas"],
  love: ["lumi", "sienna"],
  spiritual: ["solace", "nova"],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, eventType } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Check rate limits first
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count: dailyCount } = await supabase
      .from('adaptive_push_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('delivered', true)
      .gte('created_at', oneDayAgo);

    if ((dailyCount || 0) >= 1) {
      return new Response(JSON.stringify({ error: 'Daily limit reached' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { count: weeklyCount } = await supabase
      .from('adaptive_push_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('delivered', true)
      .gte('created_at', sevenDaysAgo);

    if ((weeklyCount || 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Weekly limit reached' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Load user settings
    const { data: settings } = await supabase
      .from('adaptive_push_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .single();

    // Map event to category
    let chosenCategory = eventCategoryMap[eventType];
    
    if (settings) {
      const categories = settings.categories || (settings.primary_category ? [settings.primary_category] : []);
      
      // If chosen category not in user's categories, use primary
      if (categories.length > 0 && !categories.includes(chosenCategory)) {
        chosenCategory = settings.primary_category || categories[0];
      }
    }

    if (!chosenCategory) {
      chosenCategory = 'discipline'; // Default fallback
    }

    // Determine mentor
    let chosenMentorId = settings?.mentor_id;

    if (!chosenMentorId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('selected_mentor_id')
        .eq('id', userId)
        .single();

      if (profile?.selected_mentor_id) {
        chosenMentorId = profile.selected_mentor_id;
      } else {
        // Pick a mentor from category map
        const mentorSlugs = categoryMentorMap[chosenCategory] || [];
        if (mentorSlugs.length > 0) {
          const randomSlug = mentorSlugs[Math.floor(Math.random() * mentorSlugs.length)];
          const { data: mentor } = await supabase
            .from('mentors')
            .select('id')
            .eq('slug', randomSlug)
            .single();
          
          if (mentor) {
            chosenMentorId = mentor.id;
          }
        }
      }
    }

    if (!chosenMentorId) {
      return new Response(JSON.stringify({ error: 'No mentor found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate AI message with event context
    const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-adaptive-push', {
      body: {
        mentorId: chosenMentorId,
        category: chosenCategory,
        intensity: settings?.intensity || 'balanced',
        emotionalTriggers: settings?.emotional_triggers || [],
        eventContext: `The user just experienced: ${eventType}. Acknowledge this feeling briefly and redirect them in a healthy way.`
      }
    });

    if (aiError) {
      console.error('AI generation error:', aiError);
      return new Response(JSON.stringify({ error: 'Failed to generate message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const message = aiData?.message || 'Your mentor has a message for you.';

    // Insert and immediately mark for delivery
    const { error: insertError } = await supabase
      .from('adaptive_push_queue')
      .insert({
        user_id: userId,
        mentor_id: chosenMentorId,
        category: chosenCategory,
        message,
        scheduled_for: new Date().toISOString(),
        delivered: false
      });

    if (insertError) {
      console.error('Queue insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to queue push' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message,
        category: chosenCategory
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trigger-adaptive-event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
