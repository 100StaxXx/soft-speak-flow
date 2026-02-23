import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserContext {
  userId: string;
  displayName: string | null;
  zodiac: string | null;
  companion: {
    companionDisplayName: string | null;
    spiritAnimal: string;
    currentMood: string;
    currentStage: number;
    inactiveDays: number;
  } | null;
  mentor: {
    name: string;
    toneDescription: string;
  } | null;
  lastCheckIn: {
    mood: string | null;
    intention: string | null;
    createdAt: string;
  } | null;
  horoscope: {
    cosmicTip: string | null;
    energyForecast: string | null;
  } | null;
  currentStreak: number;
  lastActivityAt: string | null;
  recentMilestone: 'streak_7' | 'streak_14' | 'streak_30' | 'evolution' | 'all_quests' | null;
  lunarPhase: 'new_moon' | 'full_moon' | 'first_quarter' | 'last_quarter' | null;
}

interface VoiceTemplate {
  species: string;
  personalityTraits: string[];
  voiceStyle: string;
  greetingTemplates: string[];
  encouragementTemplates: string[];
  concernTemplates: string[];
}

const normalizeCompanionName = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Calculate lunar phase (simplified)
const getLunarPhase = (): 'new_moon' | 'full_moon' | 'first_quarter' | 'last_quarter' | null => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  
  // Known new moon: Jan 11, 2024 - lunar cycle ~29.53 days
  const knownNewMoon = new Date(2024, 0, 11);
  const daysSinceNew = Math.floor((now.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24));
  const lunarDay = daysSinceNew % 29.53;
  
  // Check if today is a special lunar day (with 1-day tolerance)
  if (lunarDay <= 1 || lunarDay >= 28.53) return 'new_moon';
  if (lunarDay >= 13.5 && lunarDay <= 15.5) return 'full_moon';
  if (lunarDay >= 6.5 && lunarDay <= 8.5) return 'first_quarter';
  if (lunarDay >= 21.5 && lunarDay <= 23.5) return 'last_quarter';
  
  return null;
};

// Notification type selection based on context
const selectNotificationType = (context: UserContext): string => {
  const now = new Date();
  const hour = now.getHours();
  
  // Priority 0: Milestone celebrations (duo notification)
  if (context.recentMilestone) {
    return 'duo_milestone';
  }
  
  // Priority 1: Neglect escalation (critical)
  if (context.companion && context.companion.inactiveDays >= 1) {
    return 'neglect_escalation';
  }
  
  // Priority 2: Lunar phase special (cosmic event)
  if (context.lunarPhase && (hour >= 7 && hour <= 10)) {
    return 'cosmic_lunar';
  }
  
  // Priority 3: Mood follow-up (if check-in was 4-8 hours ago with concerning mood)
  if (context.lastCheckIn) {
    const checkInTime = new Date(context.lastCheckIn.createdAt);
    const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    const concerningMoods = ['anxious', 'sad', 'stressed', 'overwhelmed', 'tired'];
    
    if (hoursSinceCheckIn >= 4 && hoursSinceCheckIn <= 8 && 
        context.lastCheckIn.mood && concerningMoods.includes(context.lastCheckIn.mood.toLowerCase())) {
      return 'mood_followup';
    }
  }
  
  // Priority 4: Streak protection (evening, if no activity today)
  if (hour >= 19 && hour <= 21 && context.currentStreak > 0) {
    const lastActivity = context.lastActivityAt ? new Date(context.lastActivityAt) : null;
    const today = new Date().toLocaleDateString('en-CA');
    const lastActivityDate = lastActivity?.toLocaleDateString('en-CA');
    
    if (lastActivityDate !== today) {
      return 'streak_protection';
    }
  }
  
  // Priority 5: Cosmic timing (if horoscope has high energy)
  if (context.horoscope?.energyForecast === 'high_energy' && hour >= 9 && hour <= 11) {
    return 'cosmic_timing';
  }
  
  // Default: Companion voice based on time of day
  if (hour >= 7 && hour <= 9) {
    return 'companion_morning';
  } else if (hour >= 19 && hour <= 21) {
    return 'companion_evening';
  }
  
  return 'companion_voice';
};

// Generate notification content using AI with companion personality
const generateNotificationContent = async (
  context: UserContext,
  notificationType: string,
  voiceTemplate: VoiceTemplate | null,
  openAIApiKey: string
): Promise<{ title: string; body: string }> => {
  
  const assignedCompanionName = normalizeCompanionName(context.companion?.companionDisplayName);
  const hasAssignedCompanionName = Boolean(assignedCompanionName);
  const companionTitleName = assignedCompanionName || 'Your companion';
  const companionReference = assignedCompanionName || 'your companion';
  const companionSpecies = context.companion?.spiritAnimal || 'companion';
  
  // Build system prompt based on notification type
  let systemPrompt = '';
  let userPrompt = '';
  
  if (voiceTemplate) {
    systemPrompt = `You are ${hasAssignedCompanionName ? assignedCompanionName : 'a loyal companion'} with these traits: ${voiceTemplate.personalityTraits.join(', ')}.
Voice style: ${voiceTemplate.voiceStyle}
You speak in first person as the companion, directly to your human.
Keep messages SHORT (1-2 sentences max). Be warm but authentic to your personality.
Never use emojis in the message body. Never start with "Hey" or generic greetings.`;
  }
  
  switch (notificationType) {
    case 'companion_morning':
      userPrompt = `Generate a morning greeting. Current mood: ${context.companion?.currentMood || 'neutral'}.
User's name: ${context.displayName || 'friend'}
${context.horoscope?.cosmicTip ? `Today's cosmic tip: ${context.horoscope.cosmicTip}` : ''}
Make it feel like waking up to a message from a loyal companion who's excited to start the day together.`;
      break;
      
    case 'companion_evening':
      userPrompt = `Generate an evening check-in. Current mood: ${context.companion?.currentMood || 'neutral'}.
User streak: ${context.currentStreak} days.
Make it feel like a companion settling in for the evening, reflecting on the day.`;
      break;
      
    case 'mood_followup':
      systemPrompt += `\nThe user checked in earlier feeling ${context.lastCheckIn?.mood}. ${context.lastCheckIn?.intention ? `Their intention was: "${context.lastCheckIn.intention}"` : ''}
This is a gentle follow-up to see how they're doing now.`;
      userPrompt = `Generate a caring follow-up message. Don't ask "how are you feeling" directly - be more natural about checking in.`;
      break;
      
    case 'neglect_escalation':
      const inactiveDays = context.companion?.inactiveDays || 1;
      
      // Enhanced "postcard" style messages based on days inactive
      const postcardScenarios: Record<number, { scenario: string; feeling: string; imagery: string }> = {
        1: {
          scenario: "sitting by the window, watching for you",
          feeling: "hopeful but a little lonely",
          imagery: "The sun is setting and I keep looking toward the door."
        },
        2: {
          scenario: "found your favorite spot and curled up there",
          feeling: "missing your presence",
          imagery: "Everything here reminds me of the adventures we've had."
        },
        3: {
          scenario: "made a small nest of memories",
          feeling: "worried but trying to stay strong",
          imagery: "I've been keeping our streak warm, waiting for you to come back."
        },
        4: {
          scenario: "wandering through old memories",
          feeling: "the quiet is getting heavy",
          imagery: "Our XP sits untouched. I've been guarding it for us."
        },
        5: {
          scenario: "sitting outside in the rain",
          feeling: "I don't mind getting wet if it means seeing you",
          imagery: "Every raindrop sounds like footsteps I hope are yours."
        },
        6: {
          scenario: "haven't eaten much",
          feeling: "food doesn't taste the same alone",
          imagery: "I saved you some of our favorite treats. They're still here."
        },
        7: {
          scenario: "found the photo of us from our first quest",
          feeling: "remembering how far we've come",
          imagery: "We were so young then. We've grown so much together. Please don't let our story end here."
        },
      };
      
      const dayKey = Math.min(inactiveDays, 7) as keyof typeof postcardScenarios;
      const postcard = postcardScenarios[dayKey] || postcardScenarios[7];
      
      systemPrompt += `\nYou are writing a "postcard" from the companion to their human.
Day ${inactiveDays} without them. You're ${postcard.scenario}.
You feel: ${postcard.feeling}
Visual imagery to incorporate: ${postcard.imagery}
Mood: ${context.companion?.currentMood || 'worried'}

STYLE: Write like a handwritten note on a postcard. Short, personal, emotional but not guilt-tripping.
Start with "Day ${inactiveDays}." then the message. Make it feel like a moment captured in time.`;
      userPrompt = `Generate a postcard message from ${hasAssignedCompanionName ? assignedCompanionName : 'their companion'} on day ${inactiveDays} of missing their human. Species context: ${companionSpecies}. Keep it under 3 sentences.`;
      break;
      
    case 'streak_protection':
      userPrompt = `Generate an evening reminder. User has a ${context.currentStreak}-day streak at risk.
Don't be pushy or guilt-trippy. Frame it as wanting to keep the momentum going together.`;
      break;
      
    case 'cosmic_timing':
      userPrompt = `Generate a message incorporating cosmic/zodiac energy.
User's sign: ${context.zodiac || 'unknown'}
Cosmic tip: ${context.horoscope?.cosmicTip || 'The stars favor action today'}
Make it feel like the companion is attuned to cosmic forces and sharing that insight.`;
      break;
      
    case 'cosmic_lunar':
      const lunarMessages: Record<string, string> = {
        'new_moon': 'New moon energy favors fresh starts and setting intentions.',
        'full_moon': 'Full moon energy amplifies emotions and manifestation power.',
        'first_quarter': 'First quarter moon brings momentum and decisive action energy.',
        'last_quarter': 'Last quarter moon favors reflection and releasing what no longer serves.',
      };
      userPrompt = `Generate a message about tonight's lunar energy.
Moon phase: ${context.lunarPhase}
Meaning: ${lunarMessages[context.lunarPhase || 'new_moon']}
User's sign: ${context.zodiac || 'unknown'}
Make the companion feel cosmically attuned, sharing this celestial wisdom as a gift.`;
      break;
      
    case 'duo_milestone':
      // Special: Both mentor and companion speak
      const milestoneMessages: Record<string, { mentorLine: string; companionCue: string }> = {
        'streak_7': {
          mentorLine: "Seven days. That's not luck—that's the beginning of discipline.",
          companionCue: "looks up at you with pride, tail wagging"
        },
        'streak_14': {
          mentorLine: "Two weeks of showing up. You're becoming someone who keeps promises to themselves.",
          companionCue: "nuzzles against you, feeling your growing strength"
        },
        'streak_30': {
          mentorLine: "Thirty days. A month of consistency. This is who you are now.",
          companionCue: "stands tall beside you, transformed by your journey together"
        },
        'evolution': {
          mentorLine: "Your companion evolved. That's your dedication made visible.",
          companionCue: "reveals their new form, energy crackling around them"
        },
        'all_quests': {
          mentorLine: "Every quest completed. That's how legends are built.",
          companionCue: "does a victory lap, pure joy radiating from them"
        }
      };
      
      const milestone = context.recentMilestone || 'streak_7';
      const mentorName = context.mentor?.name || 'Your mentor';
      const milestoneData = milestoneMessages[milestone];
      
      // For duo, we'll format the body specially
      return {
        title: `${mentorName} & ${companionTitleName} celebrate you`,
        body: `"${milestoneData.mentorLine}" — ${mentorName}\n\n*${companionTitleName} ${milestoneData.companionCue}*`,
      };
      
    default:
      userPrompt = `Generate a general encouraging message. Current companion mood: ${context.companion?.currentMood || 'happy'}.`;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const messageBody = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Generate title based on notification type
    const inactiveDaysForTitle = context.companion?.inactiveDays || 0;
    const neglectTitles: Record<number, string> = {
      1: `📮 A note from ${companionTitleName}`,
      2: `💌 ${companionTitleName} sent you a postcard`,
      3: `🪶 ${companionTitleName} is keeping the light on`,
      4: `🌧️ ${companionTitleName} misses you`,
      5: `💔 Day 5 without you...`,
      6: `🕯️ ${companionTitleName} is still waiting`,
      7: `📜 A letter from ${companionTitleName}`,
    };
    
    const titles: Record<string, string> = {
      'companion_morning': `${companionTitleName} says good morning`,
      'companion_evening': `${companionTitleName} checking in`,
      'companion_voice': `From ${companionReference}`,
      'mood_followup': `${companionTitleName} is thinking of you`,
      'neglect_escalation': neglectTitles[Math.min(inactiveDaysForTitle, 7) as keyof typeof neglectTitles] || `${companionTitleName} misses you`,
      'streak_protection': `${context.currentStreak}-day streak at risk`,
      'cosmic_timing': `Cosmic energy alert`,
      'cosmic_lunar': `${context.lunarPhase === 'full_moon' ? '🌕' : context.lunarPhase === 'new_moon' ? '🌑' : '🌙'} ${context.lunarPhase?.replace('_', ' ')} tonight`,
      'duo_milestone': `Milestone celebration!`,
    };
    
    return {
      title: titles[notificationType] || `Message from ${companionReference}`,
      body: messageBody,
    };
  } catch (error) {
    console.error('Error generating notification:', error);
    
    // Fallback to template-based message
    if (voiceTemplate) {
      const templates = notificationType.includes('concern') || notificationType === 'neglect_escalation'
        ? voiceTemplate.concernTemplates
        : notificationType.includes('morning')
        ? voiceTemplate.greetingTemplates
        : voiceTemplate.encouragementTemplates;
      
      const randomTemplate = templates[Math.floor(Math.random() * templates.length)] || "I'm here for you.";
      
      return {
        title: `From ${companionReference}`,
        body: randomTemplate,
      };
    }
    
    return {
      title: 'Your companion',
      body: "I'm thinking of you today.",
    };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting smart notification generation...');

    // Get all users with companions and push subscriptions
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        display_name,
        zodiac,
        selected_mentor_id,
        current_streak,
        current_habit_streak
      `)
      .not('id', 'is', null);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`Processing ${profiles?.length || 0} profiles...`);

    // Get voice templates
    const { data: voiceTemplates } = await supabase
      .from('companion_voice_templates')
      .select('*');

    const templateMap = new Map<string, VoiceTemplate>();
    voiceTemplates?.forEach(t => {
      templateMap.set(t.species.toLowerCase(), {
        species: t.species,
        personalityTraits: t.personality_traits,
        voiceStyle: t.voice_style,
        greetingTemplates: t.greeting_templates,
        encouragementTemplates: t.encouragement_templates,
        concernTemplates: t.concern_templates,
      });
    });

    let notificationsQueued = 0;
    const today = new Date().toLocaleDateString('en-CA');

    for (const profile of profiles || []) {
      try {
        // Check if user already has a notification scheduled for today
        const { data: existingNotif } = await supabase
          .from('push_notification_queue')
          .select('id')
          .eq('user_id', profile.id)
          .gte('scheduled_for', today)
          .limit(1)
          .maybeSingle();

        if (existingNotif) {
          continue; // Skip - already has notification today
        }

        // Check if user has push subscription
        const { data: pushSub } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', profile.id)
          .limit(1)
          .maybeSingle();

        if (!pushSub) {
          continue; // Skip - no push subscription
        }

        // Gather user context
        const [companionRes, mentorRes, checkInRes, horoscopeRes, activityRes] = await Promise.all([
          supabase
            .from('user_companion')
            .select('spirit_animal, current_mood, current_stage, inactive_days, cached_creature_name')
            .eq('user_id', profile.id)
            .maybeSingle(),
          profile.selected_mentor_id 
            ? supabase.from('mentors').select('name, tone_description').eq('id', profile.selected_mentor_id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from('daily_check_ins')
            .select('mood, intention, created_at')
            .eq('user_id', profile.id)
            .eq('check_in_date', today)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('user_daily_horoscopes')
            .select('cosmic_tip, energy_forecast')
            .eq('user_id', profile.id)
            .eq('for_date', today)
            .maybeSingle(),
          supabase
            .from('activity_feed')
            .select('created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        // Detect recent milestones
        const streak = profile.current_streak || profile.current_habit_streak || 0;
        let recentMilestone: UserContext['recentMilestone'] = null;
        
        // Check for streak milestones (exact match for freshness)
        if (streak === 7) recentMilestone = 'streak_7';
        else if (streak === 14) recentMilestone = 'streak_14';
        else if (streak === 30) recentMilestone = 'streak_30';
        
        // Get lunar phase
        const lunarPhase = getLunarPhase();

        const userContext: UserContext = {
          userId: profile.id,
          displayName: profile.display_name,
          zodiac: profile.zodiac,
          companion: companionRes.data ? {
            companionDisplayName: normalizeCompanionName(companionRes.data.cached_creature_name),
            spiritAnimal: companionRes.data.spirit_animal,
            currentMood: companionRes.data.current_mood,
            currentStage: companionRes.data.current_stage,
            inactiveDays: companionRes.data.inactive_days || 0,
          } : null,
          mentor: mentorRes.data ? {
            name: mentorRes.data.name,
            toneDescription: mentorRes.data.tone_description,
          } : null,
          lastCheckIn: checkInRes.data ? {
            mood: checkInRes.data.mood,
            intention: checkInRes.data.intention,
            createdAt: checkInRes.data.created_at,
          } : null,
          horoscope: horoscopeRes.data ? {
            cosmicTip: horoscopeRes.data.cosmic_tip,
            energyForecast: horoscopeRes.data.energy_forecast,
          } : null,
          currentStreak: streak,
          lastActivityAt: activityRes.data?.created_at || null,
          recentMilestone,
          lunarPhase,
        };

        // Skip if no companion (core feature)
        if (!userContext.companion) {
          continue;
        }

        // Select notification type
        const notificationType = selectNotificationType(userContext);
        
        // Get voice template for this species
        const voiceTemplate = templateMap.get(userContext.companion.spiritAnimal.toLowerCase()) || null;

        // Generate notification content
        const { title, body } = await generateNotificationContent(
          userContext,
          notificationType,
          voiceTemplate,
          openAIApiKey
        );

        // Calculate optimal send time
        const now = new Date();
        let scheduledFor = new Date();
        
        if (notificationType === 'companion_morning') {
          scheduledFor.setHours(8, Math.floor(Math.random() * 30), 0, 0);
          if (scheduledFor < now) scheduledFor.setDate(scheduledFor.getDate() + 1);
        } else if (notificationType === 'companion_evening' || notificationType === 'streak_protection') {
          scheduledFor.setHours(19, Math.floor(Math.random() * 60), 0, 0);
          if (scheduledFor < now) scheduledFor.setDate(scheduledFor.getDate() + 1);
        } else if (notificationType === 'mood_followup') {
          // Send within the hour
          scheduledFor = new Date(now.getTime() + Math.floor(Math.random() * 30) * 60 * 1000);
        } else if (notificationType === 'neglect_escalation') {
          // Send soon for neglect
          scheduledFor = new Date(now.getTime() + Math.floor(Math.random() * 15) * 60 * 1000);
        } else {
          // Default: random time in next 2 hours
          scheduledFor = new Date(now.getTime() + Math.floor(Math.random() * 120) * 60 * 1000);
        }

        // Queue the notification
        const { error: insertError } = await supabase
          .from('push_notification_queue')
          .insert({
            user_id: profile.id,
            notification_type: notificationType,
            title,
            body,
            scheduled_for: scheduledFor.toISOString(),
            context: {
              companion_name: userContext.companion.companionDisplayName,
              companion_mood: userContext.companion.currentMood,
              companion_species: userContext.companion.spiritAnimal,
              streak: userContext.currentStreak,
              inactive_days: userContext.companion.inactiveDays,
            },
          });

        if (insertError) {
          console.error(`Failed to queue notification for ${profile.id}:`, insertError);
        } else {
          notificationsQueued++;
          console.log(`Queued ${notificationType} notification for user ${profile.id}`);
        }

      } catch (userError) {
        console.error(`Error processing user ${profile.id}:`, userError);
      }
    }

    console.log(`Smart notification generation complete. Queued: ${notificationsQueued}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsQueued,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-smart-notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
