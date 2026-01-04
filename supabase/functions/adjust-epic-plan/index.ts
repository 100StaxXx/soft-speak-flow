import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID regex for validation
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Input validation schema
const AdjustEpicPlanSchema = z.object({
  epicId: z.string().regex(uuidRegex, "Invalid epicId format"),
  adjustmentType: z.enum(['extend_deadline', 'reduce_scope', 'add_habits', 'remove_habits', 'reschedule', 'custom']),
  reason: z.string().max(1000).optional(),
  newDeadline: z.string().optional(),
  daysToAdd: z.number().int().min(1).max(365).optional(),
  habitsToRemove: z.array(z.string().regex(uuidRegex)).max(50).optional(),
  customRequest: z.string().max(2000).optional(),
});

interface AdjustmentSuggestion {
  id: string;
  type: 'habit_change' | 'milestone_change' | 'timeline_change' | 'difficulty_change';
  action: 'add' | 'remove' | 'modify';
  title: string;
  description: string;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawInput = await req.json();
    const parseResult = AdjustEpicPlanSchema.safeParse(rawInput);
    
    if (!parseResult.success) {
      console.error("[adjust-epic-plan] Validation error:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { epicId, adjustmentType, reason, newDeadline, daysToAdd, habitsToRemove, customRequest } = parseResult.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the epic with its habits
    const { data: epic, error: epicError } = await supabase
      .from('epics')
      .select(`
        *,
        epic_habits (
          habit_id,
          habits (
            id,
            title,
            difficulty,
            frequency
          )
        ),
        epic_milestones (
          id,
          title,
          milestone_percent,
          completed_at
        )
      `)
      .eq('id', epicId)
      .single();

    if (epicError || !epic) {
      console.error('Epic fetch error:', epicError);
      return new Response(
        JSON.stringify({ error: 'Epic not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate current status
    const startDate = new Date(epic.start_date);
    const endDate = new Date(epic.end_date);
    const now = new Date();
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const expectedProgress = Math.min(100, (daysElapsed / totalDays) * 100);
    const actualProgress = epic.progress_percentage || 0;
    const progressDelta = actualProgress - expectedProgress;

    // Build context for AI
    const epicContext = {
      title: epic.title,
      description: epic.description,
      targetDays: epic.target_days,
      daysElapsed,
      daysRemaining,
      actualProgress,
      expectedProgress,
      progressDelta,
      habits: epic.epic_habits?.map((eh: any) => ({
        id: eh.habit_id,
        title: eh.habits?.title,
        difficulty: eh.habits?.difficulty,
        frequency: eh.habits?.frequency,
      })).filter((h: any) => h.title) || [],
      milestones: epic.epic_milestones?.map((m: any) => ({
        id: m.id,
        title: m.title,
        percent: m.milestone_percent,
        completed: !!m.completed_at,
      })) || [],
    };

    // Determine what kind of adjustments to suggest
    let adjustmentPrompt = '';
    switch (adjustmentType) {
      case 'extend_deadline':
        adjustmentPrompt = `The user wants to extend their deadline${daysToAdd ? ` by ${daysToAdd} days` : ''}${newDeadline ? ` to ${newDeadline}` : ''}.
Suggest how to redistribute milestones and potentially add more habits to fill the extra time productively.`;
        break;
      case 'reduce_scope':
        adjustmentPrompt = `The user is behind schedule (${actualProgress.toFixed(0)}% actual vs ${expectedProgress.toFixed(0)}% expected).
Suggest which habits could be simplified or removed, and how to adjust milestones to make the goal more achievable.`;
        break;
      case 'add_habits':
        adjustmentPrompt = `The user wants to add more habits to their epic. They're currently at ${actualProgress.toFixed(0)}% progress with ${daysRemaining} days remaining.
Suggest 2-3 new habits that would complement their existing ones and help achieve the goal faster.`;
        break;
      case 'remove_habits':
        adjustmentPrompt = `The user wants to simplify their plan${habitsToRemove?.length ? ` by removing specific habits` : ''}.
Suggest which habits are least critical and how to compensate for their removal.`;
        break;
      case 'reschedule':
        adjustmentPrompt = `The user wants to reschedule their habits or milestones.
Analyze their current progress and suggest an optimal schedule adjustment.`;
        break;
      case 'custom':
        adjustmentPrompt = customRequest || 'The user wants to adjust their plan. Provide general suggestions for improvement.';
        break;
    }

    if (reason) {
      adjustmentPrompt += `\n\nUser's reason: "${reason}"`;
    }

    const systemPrompt = `You are an expert habit coach helping users adjust their epic (long-term goal) plans.
You analyze their current progress and suggest practical adjustments.

Current Epic Status:
- Title: ${epicContext.title}
- Description: ${epicContext.description || 'No description'}
- Target Duration: ${epicContext.targetDays} days
- Days Elapsed: ${epicContext.daysElapsed}
- Days Remaining: ${epicContext.daysRemaining}
- Actual Progress: ${epicContext.actualProgress.toFixed(1)}%
- Expected Progress: ${epicContext.expectedProgress.toFixed(1)}%
- Progress Delta: ${epicContext.progressDelta > 0 ? '+' : ''}${epicContext.progressDelta.toFixed(1)}%

Current Habits:
${epicContext.habits.map((h: any) => `- ${h.title} (${h.difficulty}, ${h.frequency})`).join('\n') || 'No habits'}

Current Milestones:
${epicContext.milestones.map((m: any) => `- ${m.title} at ${m.percent}% ${m.completed ? '✓' : ''}`).join('\n') || 'No milestones'}

Return a JSON object with this structure:
{
  "analysis": "Brief analysis of their current situation (2-3 sentences)",
  "suggestions": [
    {
      "id": "unique-id",
      "type": "habit_change|milestone_change|timeline_change|difficulty_change",
      "action": "add|remove|modify",
      "title": "Short title for this suggestion",
      "description": "What this change involves",
      "details": { /* optional specific data */ }
    }
  ],
  "encouragement": "A short motivational message"
}`;

    console.log('Generating adjustment suggestions for epic:', epicId, 'type:', adjustmentType);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: adjustmentPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate adjustment suggestions');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from the response
    let result;
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      throw new Error('Failed to parse adjustment suggestions');
    }

    console.log(`Generated ${result.suggestions?.length || 0} adjustment suggestions for epic: ${epicId}`);

    return new Response(
      JSON.stringify({
        analysis: result.analysis,
        suggestions: result.suggestions || [],
        encouragement: result.encouragement,
        epicStatus: {
          daysElapsed: epicContext.daysElapsed,
          daysRemaining: epicContext.daysRemaining,
          actualProgress: epicContext.actualProgress,
          expectedProgress: epicContext.expectedProgress,
          progressDelta: epicContext.progressDelta,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating adjustment suggestions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
