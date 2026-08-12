import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRoleAuth } from "../_shared/auth.ts";
import { resolveNotificationCompanionContext } from "../_shared/companionName.ts";
import { buildProactiveNudgeCompanionIdentity } from "./companionIdentity.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Low-frequency, optional return invitations. Time away never harms the companion.
const getConcernLevel = (inactiveDays: number) => {
  if (inactiveDays === 3) return { level: 'open_door', tone: 'warm, casual, and pressure-free', sendPush: true };
  if (inactiveDays === 7) return { level: 'fresh_start', tone: 'welcoming and practical', sendPush: true };
  if (inactiveDays === 14) return { level: 'whenever_ready', tone: 'steady and spacious', sendPush: true };
  if (inactiveDays === 30) return { level: 'new_beginning', tone: 'warm and entirely free of obligation', sendPush: true };
  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await requireServiceRoleAuth(req, corsHeaders);
  if (auth instanceof Response) {
    return auth;
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

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIApiKey) throw new Error('OPENAI_API_KEY not configured')

    let nudgesGenerated = 0
    let concernNudgesGenerated = 0
    let pushEligibleNudges = 0

    for (const profile of profiles) {
      try {
        // Get today's date
        const today = new Date().toLocaleDateString('en-CA')
        const currentHour = new Date().getHours()

        // ========== PRESSURE-FREE RETURN INVITATIONS ==========
        const { data: companion } = await supabase
          .from('user_companion')
          .select('id, user_id, preset_id, current_stage, inactive_days, spirit_animal, core_element, companion_name, cached_creature_name')
          .eq('user_id', profile.id)
          .maybeSingle()

        if (companion && companion.inactive_days >= 1) {
          const companionContext = await resolveNotificationCompanionContext({
            supabase,
            companion,
            logPrefix: "[generate-proactive-nudges]",
          });
          const concernInfo = getConcernLevel(companion.inactive_days);
          
          if (concernInfo) {
            // Check if we already sent a nudge today for this concern level
            const { data: existingNudge } = await supabase
              .from('mentor_nudges')
              .select('id')
              .eq('user_id', profile.id)
              .eq('nudge_type', 'companion_return_invitation')
              .gte('created_at', today)
              .maybeSingle()

            if (!existingNudge) {
              const { data: mentor } = await supabase
                .from('mentors')
                .select('name, tone_description')
                .eq('id', profile.selected_mentor_id)
                .maybeSingle()

              if (mentor) {
                const {
                  companionDisplayName,
                  companionIdentity,
                } = buildProactiveNudgeCompanionIdentity(companionContext?.displayName);
                
                const contextPrompt = `The user has not opened the app for ${companion.inactive_days} days. Write one ${concernInfo.tone} sentence offering an optional, tiny way to begin again. ${companionIdentity} may warmly witness their return but is healthy, safe, and living fully while they are away.`;

                const prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

${contextPrompt}

IMPORTANT: Stay true to your mentor personality. Never say the companion is lonely, waiting, fading, hungry, harmed, in danger, or dependent on the user. Never mention lost progress, urgency, streak risk, or an obligation to return. Make clear there is nothing to make up for.`;

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openAIApiKey}`,
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
                      nudge_type: 'companion_return_invitation',
                      message: message,
                      context: {
                        inactive_days: companion.inactive_days,
                        concern_level: concernInfo.level,
                        companion_name: companionDisplayName,
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

              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openAIApiKey}`,
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

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openAIApiKey}`,
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

              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openAIApiKey}`,
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
