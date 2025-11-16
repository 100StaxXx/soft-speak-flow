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
    const { checkInId } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get check-in details
    const { data: checkIn, error: checkInError } = await supabase
      .from('daily_check_ins')
      .select('*, profiles!inner(selected_mentor_id)')
      .eq('id', checkInId)
      .single()

    if (checkInError) throw checkInError

    // Get mentor personality
    const { data: mentor } = await supabase
      .from('mentors')
      .select('name, tone_description, slug')
      .eq('id', checkIn.profiles.selected_mentor_id)
      .single()

    if (!mentor) throw new Error('Mentor not found')

    // Get today's pep talk theme
    const today = new Date().toISOString().split('T')[0]
    const { data: pepTalk } = await supabase
      .from('daily_pep_talks')
      .select('title, topic_category')
      .eq('for_date', today)
      .eq('mentor_slug', mentor.slug)
      .maybeSingle()

    const pepTalkContext = pepTalk 
      ? `Today's pep talk theme: "${pepTalk.title}" (${pepTalk.topic_category}). Reference this theme if relevant to their intention.`
      : ''

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured')

    const prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

A user just completed their morning check-in:
- Mood: ${checkIn.mood}
- Their focus for today: "${checkIn.intention}"

${pepTalkContext}

Respond with a brief, personalized message (2-3 sentences) that:
1. Acknowledges their current mood
2. Supports their intention for the day
3. References today's pep talk theme if it connects to their intention
4. Matches your distinctive voice

Keep it authentic, direct, and energizing.`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      console.error('AI API error:', await response.text())
      throw new Error('AI generation failed')
    }

    const aiData = await response.json()
    const mentorResponse = aiData.choices?.[0]?.message?.content?.trim()

    if (mentorResponse) {
      await supabase
        .from('daily_check_ins')
        .update({ mentor_response: mentorResponse })
        .eq('id', checkInId)
    }

    return new Response(JSON.stringify({ success: true, mentorResponse }), {
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
