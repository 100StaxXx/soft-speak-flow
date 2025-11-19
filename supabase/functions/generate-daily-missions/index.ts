import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeneratedMission {
  mission: string;
  xp: number;
  category: string;
  difficulty?: string;
}

const MISSION_GENERATION_PROMPT = `You are a mission generator for a personal growth app. Generate 3 daily missions that follow these strict rules:

**CORE RULES:**
- Missions must be simple, safe, and achievable in under 10 minutes
- Missions should promote momentum, clarity, connection, or discipline
- Do NOT include anything dangerous, expensive, medical, or emotionally heavy
- Missions must be actionable TODAY, without needing extra items
- Always keep it 1 sentence
- Tone should feel like gentle guidance from a mentor

**SAFETY FILTERS (NEVER INCLUDE):**
🚫 Driving, intense exercise, mixing supplements
🚫 Buying something, traveling far, booking services
🚫 Confronting someone, serious emotional conversations
🚫 Weight loss, trauma, grief, medical advice
🚫 Anything requiring specific items (except universal ones like water, phone, notebook)

**MISSION STRUCTURE:**
Include exactly 1 mission from each category:

1. **Connection Mission** ("good human day" - kindness/gratitude)
   - Text a friend/family and check in
   - Send someone a compliment
   - Thank someone for something small
   - Reach out to someone you haven't spoken to
   - Tell someone you appreciate them

2. **Quick Win** (momentum/confidence builder)
   - Do one thing you've been avoiding for less than 5 minutes
   - Finish one tiny task right now
   - Complete the easiest to-do item first
   - Organize your home screen for 2 minutes

3. **Identity Mission** (supports habits/discipline)
   - Complete all your habits today
   - Do something your future self will thank you for
   - Give yourself a 2-minute discipline burst

**XP ALLOCATION:**
- Connection missions: 5-10 XP
- Quick wins: 5-10 XP
- Identity missions: 10-15 XP

**OUTPUT FORMAT (JSON only, no markdown):**
[
  {
    "mission": "exact mission text in one sentence",
    "xp": number (5-15),
    "category": "connection" | "quick_win" | "identity",
    "difficulty": "easy" | "medium"
  }
]

Generate 3 missions now - one from each category. Return ONLY the JSON array, no other text.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, forceRegenerate = false } = await req.json();
    const today = new Date().toISOString().split('T')[0];

    // Check if missions already exist for today
    const { data: existing } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today);

    if (existing && existing.length > 0 && !forceRegenerate) {
      return new Response(
        JSON.stringify({ missions: existing, generated: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_habit_streak')
      .eq('id', userId)
      .single();

    const streak = profile?.current_habit_streak || 0;

    // Call Lovable AI to generate missions
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Generating AI missions for user ${userId} (streak: ${streak})`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: MISSION_GENERATION_PROMPT
          },
          {
            role: 'user',
            content: `Generate 3 daily missions for a user with ${streak} day habit streak. Make them personal and encouraging.`
          }
        ],
        temperature: 0.9,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`Failed to generate missions with AI: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices[0].message.content;
    
    console.log('AI response:', generatedText);

    // Parse AI response
    let missions: GeneratedMission[];
    try {
      // Remove markdown code blocks if present
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      missions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedText);
      throw new Error('Invalid AI response format');
    }

    if (!Array.isArray(missions) || missions.length !== 3) {
      console.error('Invalid mission count:', missions);
      throw new Error('AI did not generate exactly 3 missions');
    }

    console.log('Parsed missions:', missions);

    // Map to database format
    const missionsToInsert = missions.map((m) => ({
      user_id: userId,
      mission_date: today,
      mission_text: m.mission,
      mission_type: m.category || 'general',
      category: m.category || 'general',
      xp_reward: m.xp || 10,
      difficulty: m.difficulty || 'medium',
      auto_complete: false, // AI-generated missions are manual completion
      completed: false,
      progress_target: 1,
      progress_current: 0,
      is_bonus: false,
    }));

    // Insert missions
    const { data: created, error } = await supabase
      .from('daily_missions')
      .insert(missionsToInsert)
      .select();

    if (error) {
      console.error('Error inserting missions:', error);
      throw error;
    }

    console.log(`Generated ${created?.length || 0} missions for user ${userId}`);

    return new Response(
      JSON.stringify({ missions: created, generated: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating missions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
