import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Generating proactive nudges...')

    // Get all active users with selected mentors
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

    for (const profile of profiles) {
      try {
        // Get today's date
        const today = new Date().toISOString().split('T')[0]
        const currentHour = new Date().getHours()

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
              .single()

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
                .single()

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
                    })
                    nudgesGenerated++
                  }
                }
              }
            }
          }
        }

        // Surprise encouragement - random check at various times (10% chance per run)
        if (Math.random() < 0.1) {
          const { data: recentActivity } = await supabase
            .from('activity_feed')
            .select('created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          // Check if user has been quiet (no activity in last 6 hours)
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
          const lastActivity = recentActivity ? new Date(recentActivity.created_at) : null
          
          if (!lastActivity || lastActivity < sixHoursAgo) {
            const { data: mentor } = await supabase
              .from('mentors')
              .select('name, tone_description')
              .eq('id', profile.selected_mentor_id)
              .single()

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

    console.log(`Generated ${nudgesGenerated} nudges`)

    return new Response(JSON.stringify({ success: true, nudgesGenerated }), {
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
