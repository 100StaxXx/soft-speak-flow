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
    const { userId, weeklyData } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user's mentor
    const { data: profile } = await supabase
      .from('profiles')
      .select('selected_mentor_id')
      .eq('id', userId)
      .single()

    if (!profile?.selected_mentor_id) {
      throw new Error('No mentor selected')
    }

    const { data: mentor } = await supabase
      .from('mentors')
      .select('name, tone_description')
      .eq('id', profile.selected_mentor_id)
      .single()

    if (!mentor) throw new Error('Mentor not found')

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured')

    const prompt = `You are ${mentor.name}, a mentor with this personality: ${mentor.tone_description}.

Review this user's weekly performance:
- Habits completed: ${weeklyData.habitCount}
- Daily check-ins: ${weeklyData.checkInCount}
- Mood logs: ${weeklyData.moodCount}

Recent activities summary:
${weeklyData.activities.slice(0, 10).map((a: any) => `${a.type}: ${JSON.stringify(a.data)}`).join('\n')}

Generate a brief weekly insight (2-3 sentences max) that:
1. Celebrates their wins this week
2. Identifies one pattern or growth area
3. Provides one actionable focus for next week

Stay true to your personality and be specific to their actual activities.`

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
    const insight = aiData.choices?.[0]?.message?.content?.trim()

    if (!insight) {
      throw new Error('No insight generated')
    }

    return new Response(JSON.stringify({ success: true, insight }), {
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
