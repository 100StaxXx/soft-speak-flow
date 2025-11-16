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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const categories = ['discipline', 'confidence', 'focus', 'mindset', 'self-care', 'physique', 'productivity'];
    const challengeTemplates = [
      { category: 'discipline', days: 7, theme: 'Discipline Reset' },
      { category: 'confidence', days: 5, theme: 'Confidence Spark' },
      { category: 'focus', days: 10, theme: 'Focus & Deep Work' },
      { category: 'self-care', days: 7, theme: 'Self-Care Reset' },
      { category: 'mindset', days: 8, theme: 'Mental Toughness' },
      { category: 'physique', days: 14, theme: 'Physique Tune-Up' }
    ];

    const generatedChallenges = [];

    for (const template of challengeTemplates) {
      const systemPrompt = `You are a challenge designer for A Lil Push, a motivational app focused on practical growth.

Generate a ${template.days}-day challenge focused on ${template.category}.

Return a JSON object with:
{
  "title": "Challenge title (e.g., '7 Days of Discipline Reset')",
  "description": "2-3 sentence overview of what this challenge achieves",
  "daily_tasks": [
    {
      "day": 1,
      "title": "Day 1 task title",
      "description": "Clear, actionable task description"
    },
    // ... continue for all ${template.days} days
  ]
}

Make tasks:
- Specific and achievable in 15-30 minutes
- Progressive (building on previous days)
- Practical, not abstract
- Aligned with ${template.category} theme
- Written in direct, motivational language`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate the ${template.days}-day ${template.theme} challenge` }
          ],
        }),
      });

      if (!aiResponse.ok) {
        console.error("AI error for", template.theme);
        continue;
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0]?.message?.content || "";
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        
        const challengeData = JSON.parse(jsonMatch[0]);

        // Insert challenge
        const { data: challenge, error: challengeError } = await supabase
          .from("challenges")
          .insert({
            title: challengeData.title,
            description: challengeData.description,
            category: template.category,
            total_days: template.days,
            source: 'ai'
          })
          .select()
          .single();

        if (challengeError || !challenge) {
          console.error("Error inserting challenge:", challengeError);
          continue;
        }

        // Insert tasks
        const tasks = challengeData.daily_tasks.map((task: any) => ({
          challenge_id: challenge.id,
          day_number: task.day,
          task_title: task.title,
          task_description: task.description
        }));

        const { error: tasksError } = await supabase
          .from("challenge_tasks")
          .insert(tasks);

        if (tasksError) {
          console.error("Error inserting tasks:", tasksError);
        } else {
          generatedChallenges.push(challenge.title);
        }
      } catch (parseError) {
        console.error("Failed to parse challenge:", parseError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        generated: generatedChallenges.length,
        challenges: generatedChallenges 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});