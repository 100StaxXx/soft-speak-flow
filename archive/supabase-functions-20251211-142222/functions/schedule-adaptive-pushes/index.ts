import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const categoryMentorMap: Record<string, string[]> = {
  discipline: ["darius", "kai", "stryker", "atlas"],
  confidence: ["eli", "darius"],
  healing: ["sienna", "lumi", "solace"],
  calm: ["nova", "atlas"],
  focus: ["stryker", "kai", "atlas"],
  love: ["lumi", "sienna"],
  spiritual: ["solace", "nova"]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, settingsId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from('adaptive_push_settings')
      .select('*')
      .eq('id', settingsId)
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings) {
      throw new Error('Settings not found');
    }

    // Get user profile for selected mentor
    const { data: profile } = await supabase
      .from('profiles')
      .select('selected_mentor_id')
      .eq('id', userId)
      .single();

    // Determine mentor
    let mentorId = settings.mentor_id;
    if (!mentorId && profile?.selected_mentor_id) {
      mentorId = profile.selected_mentor_id;
    }

    // If still no mentor, pick from category map
    if (!mentorId && settings.primary_category) {
      const category = settings.primary_category;
      const mentorSlugs = categoryMentorMap[category] || [];
      
      if (mentorSlugs.length > 0) {
        const randomSlug = mentorSlugs[Math.floor(Math.random() * mentorSlugs.length)];
        const { data: randomMentor } = await supabase
          .from('mentors')
          .select('id')
          .eq('slug', randomSlug)
          .single();
        
        if (randomMentor) mentorId = randomMentor.id;
      }
    }

    if (!mentorId) {
      throw new Error('No mentor available for scheduling');
    }

    // Calculate scheduled times based on frequency
    const scheduledTimes: Date[] = [];
    const now = new Date();
    
    const getTimeInWindow = (window: string, baseDate: Date): Date => {
      const date = new Date(baseDate);
      const randomOffset = Math.floor(Math.random() * 40) - 20; // +/- 20 minutes
      
      switch (window) {
        case 'morning':
          date.setHours(7, 30 + randomOffset, 0, 0);
          break;
        case 'midday':
          date.setHours(13, 30 + randomOffset, 0, 0);
          break;
        case 'evening':
          date.setHours(19, 0 + randomOffset, 0, 0);
          break;
        case 'night':
          date.setHours(21, 0 + randomOffset, 0, 0);
          break;
        default: // 'any'
          date.setHours(Math.floor(Math.random() * 14) + 7, Math.floor(Math.random() * 60), 0, 0);
      }
      
      return date;
    };

    switch (settings.frequency) {
      case 'daily': {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        scheduledTimes.push(getTimeInWindow(settings.time_window, tomorrow));
        break;
      }
      case '3_per_week': {
        for (let i = 0; i < 3; i++) {
          const day = new Date(now);
          day.setDate(day.getDate() + Math.floor(Math.random() * 7) + 1);
          scheduledTimes.push(getTimeInWindow(settings.time_window, day));
        }
        break;
      }
      case 'weekly': {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + Math.floor(Math.random() * 7) + 1);
        scheduledTimes.push(getTimeInWindow(settings.time_window, nextWeek));
        break;
      }
      case 'random': {
        const count = Math.floor(Math.random() * 4) + 1; // 1-4
        for (let i = 0; i < count; i++) {
          const day = new Date(now);
          day.setDate(day.getDate() + Math.floor(Math.random() * 7) + 1);
          scheduledTimes.push(getTimeInWindow(settings.time_window, day));
        }
        break;
      }
      case 'event_based':
        // Don't schedule anything, only event-based
        break;
    }

    // Generate messages and insert into queue
    const insertPromises = scheduledTimes.map(async (scheduledFor) => {
      // Call message generation function
      const { data: messageData } = await supabase.functions.invoke('generate-adaptive-push', {
        body: {
          mentorId,
          category: settings.primary_category,
          intensity: settings.intensity,
          emotionalTriggers: settings.emotional_triggers || []
        }
      });

      if (!messageData?.message) return null;

      return supabase
        .from('adaptive_push_queue')
        .insert({
          user_id: userId,
          mentor_id: mentorId,
          message: messageData.message,
          scheduled_for: scheduledFor.toISOString(),
          delivered: false
        });
    });

    await Promise.all(insertPromises);

    return new Response(
      JSON.stringify({ success: true, scheduled: scheduledTimes.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in schedule-adaptive-pushes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});