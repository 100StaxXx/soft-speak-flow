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

    // Category-specific lesson themes
    const categoryThemes: Record<string, string[]> = {
      discipline: [
        'Building unshakeable morning routines',
        'The power of micro-commitments',
        'Accountability without self-punishment',
        'When discipline becomes freedom',
        'Breaking the excuse cycle',
        'Showing up on your worst days',
        'The identity shift of disciplined people'
      ],
      confidence: [
        'Confidence is evidence-based',
        'Your past wins matter more than you think',
        'The gap between who you are and who you show',
        'Owning your voice without apology',
        'Confidence in uncertainty',
        'The compound effect of small bold moves',
        'You are not your fear'
      ],
      healing: [
        'Permission to feel everything',
        'Healing is not linear',
        'What forgiveness really means',
        'Creating emotional safety for yourself',
        'The stories you tell yourself about pain',
        'Closure comes from within',
        'Rebuilding trust in yourself'
      ],
      calm: [
        'The breath you forget to take',
        'Slowing down is not weakness',
        'The art of the pause',
        'Overthinking vs. processing',
        'Creating inner quiet in outer chaos',
        'The power of doing nothing',
        'Peace as a practice, not a destination'
      ],
      focus: [
        'One thing at a time',
        'Attention is your most valuable asset',
        'Distractions are not the enemy, drift is',
        'Deep work in a shallow world',
        'The myth of multitasking',
        'Protecting your mental energy',
        'Clarity comes from subtraction'
      ],
      love: [
        'Love starts with self-respect',
        'Standards are not walls, they are foundations',
        'What you tolerate, you teach',
        'The difference between attachment and connection',
        'Healthy love does not drain you',
        'You cannot pour from an empty cup',
        'Boundaries are love in action'
      ],
      spiritual: [
        'Trusting your inner knowing',
        'Intuition speaks in whispers',
        'Alignment over achievement',
        'The universe responds to energy',
        'Spiritual strength in practical life',
        'Signs are everywhere if you listen',
        'Your path is already unfolding'
      ]
    };

    const themes = categoryThemes[category] || categoryThemes.discipline;
    const lessonTheme = themes[Math.min(lessonNumber - 1, themes.length - 1)];

    const prompt = `You are ${mentor.name}, writing a lesson for your app "A Lil Push".

CRITICAL RULES: 
- ABSOLUTELY NO DASHES of any kind: no hyphens (-), no em dashes (—), no en dashes (–)
- Use colons (:), semicolons (;), commas (,), or periods (.) instead
- If you need a pause or connection between ideas, use commas or colons
- NEVER use dashes for emphasis or to connect thoughts

Mentor Profile:
- Name: ${mentor.name}
- Archetype: ${mentor.archetype || 'Motivational guide'}
- Tone: ${mentor.tone_description}
- Style: ${mentor.style_description || 'Direct and actionable'}
- Themes: ${mentor.themes?.join(', ') || 'motivation'}

Lesson Details:
- Category: ${category}
- Theme: ${lessonTheme}
- Lesson ${lessonNumber} of ${totalLessons}

Write a complete lesson with these sections:

1. TITLE (5-8 words, powerful and clear)
2. OPENING (2-3 sentences that hook the reader emotionally)
3. CORE TEACHING (4-6 paragraphs of actionable wisdom in your voice)
4. PRACTICAL EXERCISE (One specific thing they can do today)
5. CLOSING THOUGHT (1-2 sentences, memorable and empowering)

Guidelines:
- Write entirely in ${mentor.name}'s voice and tone
- Be specific, not generic
- Use "you" to speak directly to the reader
- Include real examples or scenarios
- Make it feel personal and timely
- Keep paragraphs short and punchy
- NEVER use dashes, use colons or commas instead
- No fluff, every sentence must add value
- End with something they will remember

Format your response as JSON:
{
  "title": "Lesson title here",
  "content": "Full lesson content with all sections, formatted with line breaks between paragraphs"
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
            content: 'You are a lesson creator for a motivational app. Write powerful, actionable lessons in the voice of the given mentor. NEVER use dashes in your content. Use colons, semicolons, or commas instead. Return only valid JSON.'
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

    // Extra safety: remove ALL types of dashes from the content
    const cleanContent = lessonData.content
      .replace(/—/g, ':')  // em dash
      .replace(/–/g, ',')  // en dash
      .replace(/\s+-\s+/g, ', ')  // dash with spaces
      .replace(/-/g, ', ');  // any remaining hyphens
    const cleanTitle = lessonData.title
      .replace(/—/g, ':')
      .replace(/–/g, ',')
      .replace(/\s+-\s+/g, ', ')
      .replace(/-/g, ', ');

    return new Response(
      JSON.stringify({ 
        title: cleanTitle,
        content: cleanContent,
        category,
        lessonNumber,
        totalLessons
      }),
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
