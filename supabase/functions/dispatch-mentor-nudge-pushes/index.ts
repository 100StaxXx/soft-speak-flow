import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushError {
  nudgeId: string;
  error: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Dispatching mentor nudge push notifications...')

    // Get pending push-eligible nudges that haven't been sent yet
    const { data: pendingNudges, error: fetchError } = await supabase
      .from('mentor_nudges')
      .select('id, user_id, message, nudge_type, context')
      .is('push_sent_at', null)
      .is('dismissed_at', null)
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('Error fetching pending nudges:', fetchError)
      throw fetchError
    }

    // Filter to only nudges marked for push in context
    const pushEligibleNudges = pendingNudges?.filter(nudge => {
      const context = nudge.context as { send_push?: boolean } | null
      return context?.send_push === true
    }) || []

    if (pushEligibleNudges.length === 0) {
      console.log('No push-eligible nudges to dispatch')
      return new Response(JSON.stringify({ 
        success: true, 
        dispatched: 0, 
        errors: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${pushEligibleNudges.length} push-eligible nudges`)

    let dispatched = 0
    const errors: PushError[] = []

    for (const nudge of pushEligibleNudges) {
      try {
        // Get user's iOS device tokens
        const { data: deviceTokens, error: tokenError } = await supabase
          .from('push_device_tokens')
          .select('device_token')
          .eq('user_id', nudge.user_id)
          .eq('platform', 'ios')

        if (tokenError) {
          console.error(`Error fetching tokens for user ${nudge.user_id}:`, tokenError)
          errors.push({ nudgeId: nudge.id, error: tokenError.message })
          continue
        }

        if (!deviceTokens || deviceTokens.length === 0) {
          console.log(`No iOS device tokens for user ${nudge.user_id}, marking as sent`)
          // Mark as sent anyway so we don't keep trying
          await supabase
            .from('mentor_nudges')
            .update({ push_sent_at: new Date().toISOString() })
            .eq('id', nudge.id)
          continue
        }

        // Get mentor name for the title
        const { data: profile } = await supabase
          .from('profiles')
          .select('selected_mentor_id')
          .eq('id', nudge.user_id)
          .maybeSingle()

        let mentorName = 'Your mentor'
        if (profile?.selected_mentor_id) {
          const { data: mentor } = await supabase
            .from('mentors')
            .select('name')
            .eq('id', profile.selected_mentor_id)
            .maybeSingle()
          if (mentor) mentorName = mentor.name
        }

        // Get companion name from context
        const context = nudge.context as { companion_animal?: string; concern_level?: string } | null
        const companionName = context?.companion_animal || 'Your companion'
        const concernLevel = context?.concern_level

        // Build notification title based on nudge type and concern level
        let title = `${mentorName} says:`
        if (nudge.nudge_type === 'companion_concern') {
          if (concernLevel === 'dormancy_warning') {
            title = `${companionName} is fading... 🌑`
          } else if (concernLevel === 'dormancy_imminent') {
            title = `${companionName} needs you now ⚠️`
          } else {
            title = `${companionName} misses you 💔`
          }
        }

        // Send to each device
        for (const token of deviceTokens) {
          try {
            const apnsResponse = await fetch(`${supabaseUrl}/functions/v1/send-apns-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-key': internalSecret,
              },
              body: JSON.stringify({
                deviceToken: token.device_token,
                title: title,
                body: nudge.message,
                data: {
                  type: 'mentor_nudge',
                  nudge_id: nudge.id,
                  nudge_type: nudge.nudge_type,
                  // Deep link to companion page for dormancy warnings
                  url: concernLevel?.includes('dormancy') ? '/companion' : undefined,
                },
              }),
            })

            if (!apnsResponse.ok) {
              const errorText = await apnsResponse.text()
              console.error(`APNs error for nudge ${nudge.id}:`, errorText)
            } else {
              console.log(`Push sent for nudge ${nudge.id} to device`)
            }
          } catch (sendError) {
            console.error(`Error sending to device:`, sendError)
          }
        }

        // Mark nudge as pushed
        await supabase
          .from('mentor_nudges')
          .update({ push_sent_at: new Date().toISOString() })
          .eq('id', nudge.id)

        dispatched++
      } catch (nudgeError) {
        console.error(`Error processing nudge ${nudge.id}:`, nudgeError)
        errors.push({ 
          nudgeId: nudge.id, 
          error: nudgeError instanceof Error ? nudgeError.message : 'Unknown error' 
        })
      }
    }

    console.log(`Dispatched ${dispatched} push notifications, ${errors.length} errors`)

    return new Response(JSON.stringify({ 
      success: true, 
      dispatched,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined
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
