import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
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

    // Build prompts using PromptBuilder for consistency
    const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

    for (let i = 0; i < challengesToGenerate; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const totalDays = Math.floor(Math.random() * 10) + 5; // 5-14 days

      const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
        templateKey: 'weekly_challenges',
        variables: {
          totalDays,
          category
        }
      });

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

      // Validate output structure using template rules
      const validator = new OutputValidator(validationRules, {
        ...outputConstraints,
        min_tasks: totalDays,
        max_tasks: totalDays
      });
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