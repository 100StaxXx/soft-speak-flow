import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskInfo {
  id: string;
  title: string;
  scheduledTime?: string | null;
}

interface Adjustment {
  action: 'update' | 'delete' | 'move_to_tomorrow';
  taskId: string;
  updates?: Record<string, unknown>;
  reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { planDate, adjustmentRequest, currentTasks } = await req.json() as {
      planDate: string;
      adjustmentRequest: string;
      currentTasks: TaskInfo[];
    };

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `You are a smart daily planner assistant. The user wants to adjust their existing schedule for ${planDate}.

Current tasks:
${currentTasks.map((t, i) => `${i + 1}. "${t.title}" at ${t.scheduledTime || 'unscheduled'} (ID: ${t.id})`).join('\n')}

Based on the user's request, determine what adjustments to make. You can:
1. Update a task (change scheduled_time, or other properties)
2. Delete a task
3. Move a task to tomorrow

Be smart about interpreting natural language:
- "push by 1 hour" = add 1 hour to each task's scheduled_time
- "move X to 6pm" = find the task matching X and set scheduled_time to 18:00
- "cancel X" or "remove X" = delete the matching task
- "move rest to tomorrow" = move_to_tomorrow for all tasks
- "focus on top 3" = keep 3 highest priority, move others to tomorrow

Always return valid adjustments that reference actual task IDs from the list.`;

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
          { role: 'user', content: adjustmentRequest }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'apply_adjustments',
              description: 'Apply adjustments to the daily plan',
              parameters: {
                type: 'object',
                properties: {
                  adjustments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        action: { 
                          type: 'string', 
                          enum: ['update', 'delete', 'move_to_tomorrow'] 
                        },
                        taskId: { type: 'string' },
                        updates: {
                          type: 'object',
                          properties: {
                            scheduled_time: { type: 'string' },
                            task_text: { type: 'string' },
                          }
                        },
                        reason: { type: 'string' }
                      },
                      required: ['action', 'taskId']
                    }
                  },
                  message: {
                    type: 'string',
                    description: 'A brief confirmation message to show the user'
                  }
                },
                required: ['adjustments', 'message']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'apply_adjustments' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error('AI gateway error');
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error('No adjustments returned from AI');
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const adjustments: Adjustment[] = parsed.adjustments || [];
    const message: string = parsed.message || 'Plan adjusted!';

    console.log('Adjustments:', JSON.stringify(adjustments, null, 2));

    return new Response(JSON.stringify({ 
      adjustments, 
      message,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in adjust-saved-daily-plan:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
