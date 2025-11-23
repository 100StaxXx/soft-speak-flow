import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OutputValidator } from "../_shared/outputValidator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const categories = ['discipline', 'confidence', 'focus', 'mindset', 'self-care', 'physique', 'productivity'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const challengesToGenerate = 4;
    const generated = [];

    for (let i = 0; i < challengesToGenerate; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const totalDays = Math.floor(Math.random() * 10) + 5; // 5-14 days

      const systemPrompt = `You are a challenge designer for A Lil Push app. Create actionable, motivational challenges.
      
Tone: Direct, supportive, empowering. Not overly soft. Think practical self-improvement.`;

      const userPrompt = `Create a ${totalDays}-day challenge in the "${category}" category.
      
Requirements:
- Title should be compelling and clear (e.g., "7-Day Discipline Reset", "5-Day Confidence Spark")
- Description should be 2-3 sentences explaining what the challenge achieves
- Create ${totalDays} daily tasks, each with a title and description
- Tasks should be simple, achievable, and build progressively
- Each task should take 5-30 minutes max

Return the challenge structure.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'create_challenge',
              description: 'Create a new challenge with daily tasks',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        day_number: { type: 'number' },
                        task_title: { type: 'string' },
                        task_description: { type: 'string' }
                      },
                      required: ['day_number', 'task_title', 'task_description']
                    }
                  }
                },
                required: ['title', 'description', 'tasks'],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'create_challenge' } }
        }),
      });

      if (!aiResponse.ok) {
        console.error(`AI API error for challenge ${i + 1}: ${aiResponse.status}`);
        continue;
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices[0].message.tool_calls?.[0];
      const challengeData = JSON.parse(toolCall.function.arguments);

      // Validate output structure
      const validationRules = {
        required_fields: ['title', 'description', 'tasks'],
        max_length: { title: 100, description: 500 }
      };
      const outputConstraints = {
        min_tasks: totalDays,
        max_tasks: totalDays
      };
      const validator = new OutputValidator(validationRules, outputConstraints);
      const validationResult = validator.validate(challengeData);

      if (!validationResult.isValid) {
        console.error(`Challenge ${i + 1} validation failed:`, validationResult.errors);
        continue;
      }

      // Insert challenge
      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .insert({
          title: challengeData.title,
          description: challengeData.description,
          category,
          total_days: totalDays,
          duration_days: totalDays,
          source: 'ai'
        })
        .select()
        .single();

      if (challengeError) {
        console.error('Error inserting challenge:', challengeError);
        continue;
      }

      // Insert tasks
      const tasks = challengeData.tasks.map((task: any) => ({
        challenge_id: challenge.id,
        day_number: task.day_number,
        task_title: task.task_title,
        task_description: task.task_description
      }));

      const { error: tasksError } = await supabase
        .from('challenge_tasks')
        .insert(tasks);

      if (tasksError) {
        console.error('Error inserting tasks:', tasksError);
        continue;
      }

      generated.push(challenge);

      // Log generation metrics
      const responseTime = Date.now() - startTime;
      await supabase
        .from('ai_output_validation_log')
        .insert({
          template_key: 'weekly_challenges',
          input_data: { category, totalDays },
          output_data: { challenge: challengeData },
          validation_passed: true,
          model_used: 'google/gemini-2.5-flash',
          response_time_ms: responseTime
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        generated: generated.length,
        challenges: generated 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-weekly-challenges:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});