import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      mentorId,
      category,
      lessonNumber = 1,
      totalLessons = 7,
      userProgress = []
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch mentor details
    const { data: mentor, error: mentorError } = await supabase
      .from('mentors')
      .select('*')
      .eq('id', mentorId)
      .single();

    if (mentorError || !mentor) {
      throw new Error('Mentor not found');
    }

    // 18 Daily Lesson Categories
    const categoryThemes: Record<string, string[]> = {
      'discipline-reset': [
        'Showing up when motivation fades',
        'The power of micro-commitments',
        'Building unshakeable routines',
        'Discipline as self-respect'
      ],
      'mental-strength': [
        'Emotional control under pressure',
        'Choosing your response',
        'Building mental resilience',
        'Staying calm in chaos'
      ],
      'perspective-shift': [
        'Reframing setbacks as setup',
        'The bigger picture matters',
        'Zooming out to move forward',
        'Finding meaning in struggle'
      ],
      'motivation-spark': [
        'Igniting your inner fire',
        'Remember why you started',
        'The energy to begin again',
        'Momentum starts with one step'
      ],
      'self-worth': [
        'You are enough right now',
        'Standards are self-love',
        'Respecting yourself first',
        'Your value is inherent'
      ],
      'healing': [
        'Permission to feel everything',
        'Healing is not linear',
        'Closure comes from within',
        'Letting go to grow'
      ],
      'emotional-intelligence': [
        'Understanding your triggers',
        'Naming what you feel',
        'Processing without reacting',
        'Emotional awareness as power'
      ],
      'boundaries': [
        'What you tolerate, you teach',
        'Saying no with confidence',
        'Boundaries are love',
        'Protecting your peace'
      ],
      'identity-purpose': [
        'Who you are becoming',
        'Living with intention',
        'Your unique path',
        'Purpose over perfection'
      ],
      'productivity': [
        'One thing at a time',
        'Progress over perfection',
        'Small wins compound',
        'Momentum over motivation'
      ],
      'career-ambition': [
        'Playing the long game',
        'Betting on yourself',
        'Strategic patience',
        'Building your empire'
      ],
      'money-mindset': [
        'Abundance starts in your mind',
        'Financial self-respect',
        'Money follows value',
        'Wealth is a practice'
      ],
      'fitness-selfcare': [
        'Your body keeps the score',
        'Strength as self-love',
        'Honoring your vessel',
        'Energy management'
      ],
      'social-confidence': [
        'Owning your presence',
        'Authentic charisma',
        'Speaking your truth',
        'Magnetic energy'
      ],
      'glowup': [
        'Main character energy',
        'Romanticize your life',
        'The art of reinvention',
        'Becoming that version'
      ],
      'lifestyle-mindfulness': [
        'Being present wins',
        'Slow down to speed up',
        'Intentional living',
        'Quality over quantity'
      ],
      'love-relationships': [
        'Love starts with self',
        'Healthy love elevates',
        'Connection over attachment',
        'Standards in relationships'
      ],
      'longterm-growth': [
        'The compound effect',
        'Building legacy',
        'Future self gratitude',
        'Playing infinite games'
      ]
    };

    const themes = categoryThemes[category] || categoryThemes['discipline-reset'];
    const lessonTheme = themes[Math.min(lessonNumber - 1, themes.length - 1)];

    const prompt = `You are ${mentor.name}, writing a daily lesson for "A Lil Push".

CRITICAL FORMATTING RULES: 
- ABSOLUTELY NO DASHES of any kind: no hyphens, no em dashes, no en dashes
- Use colons, semicolons, commas, or periods instead
- If you need a pause, use commas or colons
- NEVER use dashes for emphasis or to connect thoughts

YOUR MENTOR VOICE:
- Name: ${mentor.name}
- Tone: ${mentor.tone_description}
- Style: ${mentor.style_description || 'Direct and actionable'}

LESSON REQUIREMENTS:
- Category: ${category}
- Theme: ${lessonTheme}
- Length: 2 to 5 sentences ONLY (this is "a lil push" not a lecture)
- Include ONE tiny doable action step

This is NOT deep self-help. This is a SHORT, IMPACTFUL nudge.

Guidelines:
- Write entirely in ${mentor.name}'s voice and tone
- Be specific, not generic
- Use "you" to speak directly
- Keep it bite-sized and scroll-stopping
- NEVER overwhelm the user
- Make it feel like the exact push they needed today
- NEVER use dashes anywhere
- Sound like ${mentor.name}, not a generic coach

Format your response as JSON:
{
  "title": "Short catchy hook (4 to 6 words max)",
  "lesson": "2 to 5 sentence lesson in mentor's voice. Keep it SHORT and impactful.",
  "category": "${category}",
  "mentor_tone": "Brief description of tone used",
  "action_step": "One tiny doable action (max 10 words)"
}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
            content: 'You are a daily lesson creator for "A Lil Push" app. Write SHORT (2 to 5 sentences), IMPACTFUL lessons in the mentor\'s unique voice. ABSOLUTELY NO DASHES anywhere. Use colons, commas, or periods instead. Keep it bite-sized and scroll-stopping. Return only valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to generate lesson');
    }

    const aiData = await aiResponse.json();
    let generatedContent = aiData.choices[0].message.content;

    // Remove markdown code blocks if present
    generatedContent = generatedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Parse the JSON response
    const lessonData = JSON.parse(generatedContent);

    // Remove ALL types of dashes from all fields
    const cleanData = {
      title: lessonData.title?.replace(/—/g, ' ').replace(/–/g, ' ').replace(/\s*-\s*/g, ' ').trim(),
      lesson: lessonData.lesson?.replace(/—/g, ' ').replace(/–/g, ' ').replace(/\s*-\s*/g, ' ').trim(),
      category: lessonData.category,
      mentor_tone: lessonData.mentor_tone?.replace(/—/g, ' ').replace(/–/g, ' ').replace(/\s*-\s*/g, ' ').trim(),
      action_step: lessonData.action_step?.replace(/—/g, ' ').replace(/–/g, ' ').replace(/\s*-\s*/g, ' ').trim()
    };

    return new Response(
      JSON.stringify(cleanData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-lesson:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
