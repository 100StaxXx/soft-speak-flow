import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Concern level messages based on inactive days
// Push notifications at: 3, 5, 6, 7, and 14+ days
const getConcernLevel = (inactiveDays: number) => {
  if (inactiveDays === 1) return { level: 'gentle', tone: 'curious and casual', sendPush: false };
  if (inactiveDays === 2) return { level: 'concerned', tone: 'noticeably worried but supportive', sendPush: false };
  if (inactiveDays === 3) return { level: 'urgent', tone: 'genuinely concerned and caring', sendPush: true };
  if (inactiveDays === 4) return { level: 'waiting', tone: 'patient but hopeful', sendPush: false };
  // Dormancy warning push at day 5
  if (inactiveDays === 5) return { level: 'dormancy_warning', tone: 'worried about losing connection, caring but urgent', sendPush: true };
  // Critical push at day 6 (dormancy imminent)
  if (inactiveDays === 6) return { level: 'dormancy_imminent', tone: 'deeply concerned, this is a final warning', sendPush: true };
  if (inactiveDays === 7) return { level: 'emotional', tone: 'deeply worried and emotional', sendPush: true };
  if (inactiveDays >= 8 && inactiveDays < 14) return { level: 'hopeful', tone: 'still hopeful, missing you', sendPush: false };
  if (inactiveDays >= 14) return { level: 'final', tone: 'sad but hopeful, like a friend who misses you deeply', sendPush: true };
  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Generating proactive nudges...')

    // Get all active users with selected mentors and companions
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, selected_mentor_id')
      .not('selected_mentor_id', 'is', null)

    if (!profiles) {
      return new Response(JSON.stringify({ success: true, nudgesGenerated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured')

    let nudgesGenerated = 0
    let concernNudgesGenerated = 0
    let pushEligibleNudges = 0

    for (const profile of profiles) {
      try {
        // Get today's date
        const today = new Date().toLocaleDateString('en-CA')
        const currentHour = new Date().getHours()

        // ========== COMPANION NEGLECT CONCERN ESCALATION ==========
        // Check if user has an inactive companion
        const { data: companion } = await supabase
          .from('user_companion')
          .select('inactive_days, spirit_animal')
          .eq('user_id', profile.id)
          .maybeSingle()

        if (companion && companion.inactive_days >= 1) {
          const concernInfo = getConcernLevel(companion.inactive_days);
          
          if (concernInfo) {
            // Check if we already sent a nudge today for this concern level
            const { data: existingNudge } = await supabase
              .from('mentor_nudges')
              .select('id')
              .eq('user_id', profile.id)
              .eq('nudge_type', 'companion_concern')
              .gte('created_at', today)
              .maybeSingle()

            if (!existingNudge) {
              const { data: mentor } = await supabase
                .from('mentors')
                .select('name, tone_description')
                .eq('id', profile.selected_mentor_id)
                .maybeSingle()

              if (mentor) {
                const companionName = companion.spirit_animal || 'companion';
                
                let contextPrompt = '';
                switch (concernInfo.level) {
                  case 'gentle':
                    contextPrompt = `The user hasn't checked in for 1 day. Their ${companionName} companion is starting to miss them. Generate a brief, ${concernInfo.tone} message (1 sentence) checking in.`;
                    break;
                  case 'concerned':
                    contextPrompt = `The user has been away for 2 days. Their ${companionName} companion is worried and their energy is starting to fade. Generate a ${concernInfo.tone} message (1-2 sentences) expressing concern about both the user and their companion.`;
                    break;
                  case 'urgent':
                    contextPrompt = `The user has been inactive for 3 days! Their ${companionName} companion is sad and losing energy daily. Generate an ${concernInfo.tone} message (1-2 sentences) that conveys urgency without being guilt-trippy. Mention the companion misses them.`;
                    break;
                  case 'waiting':
                    contextPrompt = `The user has been away for ${companion.inactive_days} days. Their ${companionName} companion is waiting patiently. Generate a ${concernInfo.tone} message (1 sentence) - gentle and understanding.`;
                    break;
                  case 'dormancy_warning':
                    contextPrompt = `The user has been away for 5 days. Their ${companionName} companion is in danger - if they don't return within 2 days, the companion will go dormant (a deep sleep state). Generate a ${concernInfo.tone} message (2 sentences max). Mention they only have 2 days left before their companion falls into a deep sleep. Be genuine, not guilt-trippy.`;
                    break;
                  case 'dormancy_imminent':
                    contextPrompt = `URGENT: The user has been away for 6 days. Their ${companionName} companion will go dormant TOMORROW if they don't return. Generate a ${concernInfo.tone} message (2 sentences max). This is the final warning before dormancy. Convey urgency without being manipulative - their companion truly needs them.`;
                    break;
                  case 'emotional':
                    contextPrompt = `The user has been gone for a week (${companion.inactive_days} days). Their ${companionName} companion is not doing well - visibly sad and weakening. Generate a ${concernInfo.tone} message (2 sentences max) from the heart. This should feel personal, not like a notification.`;
                    break;
                  case 'hopeful':
                    contextPrompt = `The user has been away for ${companion.inactive_days} days. Their ${companionName} companion is still waiting faithfully. Generate a ${concernInfo.tone} brief message (1 sentence) - patient, no pressure.`;
                    break;
                  case 'final':
                    contextPrompt = `The user has been away for over two weeks (${companion.inactive_days} days). Their ${companionName} companion is waiting faithfully but struggling. Generate a ${concernInfo.tone} final message (2 sentences max). Don't be dramatic, just genuine - like a friend who really misses them and wants them to know the door is always open.`;
                    break;
                }

                const prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

${contextPrompt}

IMPORTANT: Stay true to your mentor personality. Don't be preachy or use guilt tactics. Be genuine and caring.`;

                const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${lovableApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'google/gemini-2.5-flash',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 150,
                    temperature: 0.75,
                  }),
                })

                if (response.ok) {
                  const aiData = await response.json()
                  const message = aiData.choices?.[0]?.message?.content?.trim()

                  if (message) {
                    await supabase.from('mentor_nudges').insert({
                      user_id: profile.id,
                      nudge_type: 'companion_concern',
                      message: message,
                      context: {
                        inactive_days: companion.inactive_days,
                        concern_level: concernInfo.level,
                        companion_animal: companion.spirit_animal,
                        send_push: concernInfo.sendPush, // Flag for push notification
                      },
                    })
                    concernNudgesGenerated++
                    nudgesGenerated++
                    if (concernInfo.sendPush) {
                      pushEligibleNudges++
                      console.log(`Push-eligible nudge created for user ${profile.id} (${companion.inactive_days} days inactive)`)
                    }
                  }
                }
              }
            }
          }
        }

        // ========== EXISTING NUDGE LOGIC (no push notifications for these) ==========

        // Check morning check-in (only nudge after 10am if not completed)
        if (currentHour >= 10 && currentHour < 12) {
          const { data: checkIn } = await supabase
            .from('daily_check_ins')
            .select('id')
            .eq('user_id', profile.id)
            .eq('check_in_type', 'morning')
            .eq('check_in_date', today)
            .maybeSingle()

          if (!checkIn) {
            // No morning check-in yet
            const { data: mentor } = await supabase
              .from('mentors')
              .select('name, tone_description')
              .eq('id', profile.selected_mentor_id)
              .maybeSingle()

            if (mentor) {
              const prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

The user hasn't completed their morning check-in yet (it's now mid-morning). Generate a brief, friendly nudge (1 sentence max) to encourage them to check in. Stay true to your personality.`

              const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${lovableApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  messages: [{ role: 'user', content: prompt }],
                  max_tokens: 100,
                  temperature: 0.75,
                }),
              })

              if (response.ok) {
                const aiData = await response.json()
                const message = aiData.choices?.[0]?.message?.content?.trim()

                if (message) {
                  await supabase.from('mentor_nudges').insert({
                    user_id: profile.id,
                    nudge_type: 'check_in',
                    message: message,
                    context: { send_push: false },
                  })
                  nudgesGenerated++
                }
              }
            }
          }
        }

        // Check habits (only nudge after 8pm if no habits completed today)
        if (currentHour >= 20) {
          const { data: completions } = await supabase
            .from('habit_completions')
            .select('id')
            .eq('user_id', profile.id)
            .eq('date', today)
            .limit(1)

          if (!completions || completions.length === 0) {
            // Check if they have active habits
            const { data: habits } = await supabase
              .from('habits')
              .select('id')
              .eq('user_id', profile.id)
              .eq('is_active', true)
              .limit(1)

            if (habits && habits.length > 0) {
              const { data: mentor } = await supabase
                .from('mentors')
                .select('name, tone_description')
                .eq('id', profile.selected_mentor_id)
                .maybeSingle()

              if (mentor) {
                const prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

The user has active habits but hasn't completed any today (it's evening now). Generate a brief nudge (1 sentence max) to encourage them before the day ends. Stay true to your personality.`

                const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${lovableApiKey}`,
                    'Content-Type': 'application/json',
                  },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  messages: [{ role: 'user', content: prompt }],
                  max_tokens: 100,
                  temperature: 0.75,
                }),
                })

                if (response.ok) {
                  const aiData = await response.json()
                  const message = aiData.choices?.[0]?.message?.content?.trim()

                  if (message) {
                    await supabase.from('mentor_nudges').insert({
                      user_id: profile.id,
                      nudge_type: 'habit_reminder',
                      message: message,
                      context: { send_push: false },
                    })
                    nudgesGenerated++
                  }
                }
              }
            }
          }
        }

        // Surprise encouragement - random check at various times (10% chance per run)
        if (Math.random() < 0.18) {
          const { data: recentActivity } = await supabase
            .from('activity_feed')
            .select('created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Check if user has been quiet (no activity in last 6 hours)
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
          const lastActivity = recentActivity ? new Date(recentActivity.created_at) : null
          
          if (!lastActivity || lastActivity < sixHoursAgo) {
            const { data: mentor } = await supabase
              .from('mentors')
              .select('name, tone_description')
              .eq('id', profile.selected_mentor_id)
              .maybeSingle()

            if (mentor) {
              const prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

The user has been quiet today. Generate a brief, unexpected check-in message (1 sentence max) to let them know you're thinking of them. Make it feel like a genuine surprise, not a scheduled reminder. Stay true to your personality.`

              const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${lovableApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  messages: [{ role: 'user', content: prompt }],
                  max_tokens: 100,
                  temperature: 0.75,
                }),
              })

              if (response.ok) {
                const aiData = await response.json()
                const message = aiData.choices?.[0]?.message?.content?.trim()

                if (message) {
                  await supabase.from('mentor_nudges').insert({
                    user_id: profile.id,
                    nudge_type: 'encouragement',
                    message: message,
                    context: { send_push: false },
                  })
                  nudgesGenerated++
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing user ${profile.id}:`, error)
      }
    }

    console.log(`Generated ${nudgesGenerated} nudges (${concernNudgesGenerated} concern, ${pushEligibleNudges} push-eligible)`)

    return new Response(JSON.stringify({ 
      success: true, 
      nudgesGenerated, 
      concernNudgesGenerated,
      pushEligibleNudges 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
