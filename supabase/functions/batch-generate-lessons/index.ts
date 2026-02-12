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

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { mentor_id, count = 10 } = await req.json();

    // Get mentor info
    const { data: mentor } = await supabase
      .from('mentors')
      .select('*')
      .eq('id', mentor_id)
      .single();

    if (!mentor) {
      throw new Error('Mentor not found');
    }

    // 18 Daily Lesson Categories
    const categories = [
      'discipline-reset', 'mental-strength', 'perspective-shift', 'motivation-spark',
      'self-worth', 'healing', 'emotional-intelligence', 'boundaries',
      'identity-purpose', 'productivity', 'career-ambition', 'money-mindset',
      'fitness-selfcare', 'social-confidence', 'glowup', 'lifestyle-mindfulness',
      'relationships', 'creativity-flow'
    ];

    const lessons = [];

    for (let i = 0; i < count; i++) {
      const categoryIndex = i % categories.length;
      const currentCategory = categories[categoryIndex];
      
      const prompt = `Create a powerful daily life lesson on the topic of "${currentCategory}". 

The lesson should be:
- Actionable and practical (not just theory)
- Under 300 words
- Written in a ${mentor.tone_description} tone
- Focused on ${mentor.description}
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

      const titleMatch = lessonText.match(/Title:\s*(.+)/i);
      const descMatch = lessonText.match(/Description:\s*(.+)/i);
      const contentMatch = lessonText.match(/Content:\s*([\s\S]+)/i);

      const title = titleMatch?.[1]?.trim() || `Lesson ${i + 1}: ${currentCategory}`;
      const description = descMatch?.[1]?.trim() || `Daily lesson on ${currentCategory}`;
      const content = contentMatch?.[1]?.trim() || lessonText;

      lessons.push({
        title,
        description,
        content,
        category: currentCategory,
        mentor_id: mentor.id,
        lesson_number: i + 1,
        is_premium: false,
      });

      console.log(`Generated lesson ${i + 1} for ${mentor.name}`);
    }

    // Insert all lessons
    const { data: insertedLessons, error: insertError } = await supabase
      .from('lessons')
      .insert(lessons)
      .select();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: insertedLessons?.length || 0,
        mentor: mentor.name 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error batch generating lessons:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
