import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskTitle, taskDescription } = await req.json();

    if (!taskTitle) {
      return new Response(
        JSON.stringify({ error: 'Task title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `You are a task breakdown expert. Given a goal or large task, break it into 3-7 actionable, specific subtasks.

Rules:
- Each subtask should be completable in one session (15 min - 2 hours)
- Start each subtask with an action verb (Research, Draft, Create, Contact, Review, Schedule, etc.)
- Order by logical sequence (what needs to happen first)
- Be specific and concrete, not vague
- Include estimated duration in minutes (15, 30, 45, 60, 90, 120)

You MUST use the decompose_task function to return your response.`;

    const userPrompt = taskDescription 
      ? `Break down this goal into actionable subtasks:\n\nGoal: "${taskTitle}"\nContext: "${taskDescription}"`
      : `Break down this goal into actionable subtasks:\n\nGoal: "${taskTitle}"`;

    console.log('Calling OpenAI to decompose task:', taskTitle);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'decompose_task',
              description: 'Return 3-7 actionable subtasks for the given goal.',
              parameters: {
                type: 'object',
                properties: {
                  subtasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { 
                          type: 'string',
                          description: 'The subtask title, starting with an action verb'
                        },
                        durationMinutes: { 
                          type: 'number',
                          description: 'Estimated duration in minutes (15, 30, 45, 60, 90, or 120)'
                        }
                      },
                      required: ['title', 'durationMinutes'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['subtasks'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'decompose_task' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'decompose_task') {
      throw new Error('Invalid AI response format');
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log('Parsed subtasks:', result.subtasks);

    return new Response(
      JSON.stringify({ subtasks: result.subtasks }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in decompose-task:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
