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
    const { activityId, userReply } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get activity details and user's mentor
    const { data: activity, error: activityError } = await supabase
      .from('activity_feed')
      .select('*')
      .eq('id', activityId)
      .single()

    if (activityError) throw activityError

    // Get user's profile to find their mentor
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('selected_mentor_id')
      .eq('id', activity.user_id)
      .single()

    if (profileError) throw profileError

    // Get mentor personality
    const { data: mentor } = await supabase
      .from('mentors')
      .select('name, tone_description')
      .eq('id', profile.selected_mentor_id)
      .single()

    if (!mentor) throw new Error('Mentor not found')

    // Get recent context (last 5 activities)
    const { data: recentActivities } = await supabase
      .from('activity_feed')
      .select('activity_type, activity_data, created_at')
      .eq('user_id', activity.user_id)
      .order('created_at', { ascending: false })
      .limit(5)

    const contextSummary = recentActivities
      ?.map(a => `${a.activity_type}: ${JSON.stringify(a.activity_data)}`)
      .join('\n') || 'No recent activity'

    // Get today's pep talk for cross-referencing
    const today = new Date().toISOString().split('T')[0]
    const { data: todaysPepTalk } = await supabase
      .from('daily_pep_talks')
      .select('title, topic_category, emotional_triggers, summary')
      .eq('for_date', today)
      .limit(1)
      .single()

    // Check for milestone achievements
    let milestoneContext = ''
    if (activity.activity_type === 'habit_completed' && activity.activity_data?.habit_id) {
      const { data: habit } = await supabase
        .from('habits')
        .select('current_streak, title')
        .eq('id', activity.activity_data.habit_id)
        .single()
      
      if (habit && [3, 7, 14, 30, 100].includes(habit.current_streak)) {
        milestoneContext = `\n\nIMPORTANT: This is a ${habit.current_streak}-day streak milestone! Make this celebration feel special and memorable. Use enthusiastic language appropriate to your personality.`
      }
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured')

    const activityDescription = `${activity.activity_type}: ${JSON.stringify(activity.activity_data)}`
    
    let prompt: string;
    
    if (userReply) {
      // User is replying to an existing comment - have a conversation
      prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

Earlier, you commented on this user activity:
${activityDescription}
Your previous comment: "${activity.mentor_comment}"

The user just replied to you:
"${userReply}"

Respond to their reply in 1-2 sentences. Be authentic, supportive, and continue the conversation naturally in your distinctive voice.`
    } else {
      // Initial comment generation with cross-referencing
      const pepTalkContext = todaysPepTalk 
        ? `\n\nToday's theme is "${todaysPepTalk.title}" focusing on ${todaysPepTalk.topic_category}. If this activity relates to today's theme, naturally weave that connection into your comment.`
        : ''
      
      prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

A user just completed this activity:
${activityDescription}

Recent activity context:
${contextSummary}${pepTalkContext}${milestoneContext}

Provide a brief, encouraging comment (1-2 sentences max) acknowledging this action in your distinctive voice. Be specific to what they did. Keep it authentic and personal.`
    }

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
      }),
    })

    if (!response.ok) {
      console.error('AI API error:', await response.text())
      throw new Error('AI generation failed')
    }

    const aiData = await response.json()
    const comment = aiData.choices?.[0]?.message?.content?.trim()

    if (comment) {
      if (userReply) {
        // For replies, create a new activity feed item showing the conversation
        await supabase
          .from('activity_feed')
          .insert({
            user_id: activity.user_id,
            activity_type: 'chat_message',
            activity_data: { 
              user_message: userReply,
              context: 'reply_to_activity'
            },
            mentor_comment: comment
          })
      } else {
        // For initial comments, update the existing activity
        await supabase
          .from('activity_feed')
          .update({ mentor_comment: comment })
          .eq('id', activityId)
      }
    }

    return new Response(JSON.stringify({ success: true, comment }), {
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
