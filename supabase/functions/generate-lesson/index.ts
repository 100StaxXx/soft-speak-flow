import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date().toLocaleDateString('en-CA');

    // Check if we already have a lesson for today
    const { data: existingLesson } = await supabase
      .from('lessons')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .maybeSingle();

    if (existingLesson) {
      return new Response(
        JSON.stringify({ lesson: existingLesson, created: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get total lessons count to determine lesson number
    const { count } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true });

    const lessonNumber = (count || 0) + 1;

    // 18 Daily Lesson Categories (cycling through)
    const categories = [
      'discipline-reset', 'mental-strength', 'perspective-shift', 'motivation-spark',
      'self-worth', 'healing', 'emotional-intelligence', 'boundaries',
      'identity-purpose', 'productivity', 'career-ambition', 'money-mindset',
      'fitness-selfcare', 'social-confidence', 'glowup', 'lifestyle-mindfulness',
      'relationships', 'creativity-flow'
    ];

    const categoryIndex = (lessonNumber - 1) % categories.length;
    const currentCategory = categories[categoryIndex];

    // Get a random active mentor
    const { data: mentors } = await supabase
      .from('mentors')
      .select('*')
      .eq('is_active', true);

    if (!mentors || mentors.length === 0) {
      throw new Error('No active mentors found');
    }

    const randomMentor = mentors[Math.floor(Math.random() * mentors.length)];

    // Generate lesson content using OpenAI
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const prompt = `Create a powerful daily life lesson for day ${lessonNumber} on the topic of "${currentCategory}". 

The lesson should be:
- Actionable and practical (not just theory)
- Under 300 words
- Written in a ${randomMentor.tone_description} tone
- Focused on ${randomMentor.description}
- Include 1-2 specific action steps

Format:
Title: [compelling 5-7 word title]
Description: [1 sentence preview]
Content: [the full lesson with action steps]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await response.json();
    const lessonText = aiData.choices?.[0]?.message?.content || '';

    // Parse the AI response
    const titleMatch = lessonText.match(/Title:\s*(.+)/i);
    const descMatch = lessonText.match(/Description:\s*(.+)/i);
    const contentMatch = lessonText.match(/Content:\s*([\s\S]+)/i);

    const title = titleMatch?.[1]?.trim() || `Day ${lessonNumber}: ${currentCategory}`;
    const description = descMatch?.[1]?.trim() || `Daily lesson on ${currentCategory}`;
    const content = contentMatch?.[1]?.trim() || lessonText;

    // Save to database
    const { data: newLesson, error: insertError } = await supabase
      .from('lessons')
      .insert({
        title,
        description,
        content,
        category: currentCategory,
        mentor_id: randomMentor.id,
        lesson_number: lessonNumber,
        is_premium: false,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ lesson: newLesson, created: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating lesson:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
