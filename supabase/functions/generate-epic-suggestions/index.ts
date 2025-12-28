import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EpicSuggestion {
  id: string;
  title: string;
  type: 'habit' | 'milestone';
  description: string;
  frequency?: 'daily' | 'weekly' | 'custom';
  customDays?: number[];
  difficulty: 'easy' | 'medium' | 'hard';
  suggestedWeek?: number; // For milestones - which week to target
  category?: string;
}

interface ClarificationAnswers {
  subjects?: string;
  exam_date?: string;
  target_date?: string;
  hours_per_day?: number;
  days_per_week?: number;
  current_status?: string;
  current_level?: string;
  [key: string]: string | number | undefined;
}

interface GenerateRequest {
  goal: string;
  deadline?: string; // ISO date string
  targetDays?: number;
  clarificationAnswers?: ClarificationAnswers;
  epicContext?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal, deadline, targetDays, clarificationAnswers, epicContext } = await req.json() as GenerateRequest;

    if (!goal || goal.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Goal must be at least 3 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Calculate duration context
    let durationContext = '';
    if (deadline) {
      const deadlineDate = new Date(deadline);
      const now = new Date();
      const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      durationContext = `The user wants to achieve this by ${deadline} (${daysUntil} days from now).`;
    } else if (targetDays) {
      durationContext = `The user has ${targetDays} days to complete this goal.`;
    }

    // Build clarification context if provided
    let clarificationContext = '';
    if (clarificationAnswers && Object.keys(clarificationAnswers).length > 0) {
      clarificationContext = `
User's specific context and preferences:
${Object.entries(clarificationAnswers)
  .filter(([_, v]) => v !== undefined && v !== '')
  .map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`)
  .join('\n')}

Use this context to personalize the suggestions. For example:
- If subjects are specified, create subject-specific study habits
- If hours_per_day is specified, ensure habits fit within that time
- If current_status indicates "just starting", include foundational habits
- If exam_date is provided, work backwards to create realistic milestones
`;
    }

    // Add epic-type specific instructions
    let epicTypeInstructions = '';
    if (epicContext === 'exam_preparation') {
      epicTypeInstructions = `
This is exam preparation. Generate:
1. Subject-specific study habits (rotate subjects if multiple)
2. Practice test milestones at regular intervals
3. Review/consolidation habits
4. Self-care habits to prevent burnout (breaks, exercise)
5. Progressive difficulty - start easier, build up to full practice exams
`;
    } else if (epicContext === 'fitness_goal') {
      epicTypeInstructions = `
This is a fitness goal. Generate:
1. Progressive training habits (start small, build up)
2. Rest and recovery habits
3. Nutrition-related habits if relevant
4. Milestones based on distance/time improvements
5. Include cross-training and flexibility
`;
    } else if (epicContext === 'learning') {
      epicTypeInstructions = `
This is a learning goal. Generate:
1. Daily practice habits appropriate to skill
2. Review/spaced repetition habits
3. Application/project milestones
4. Community/immersion habits if applicable
5. Progressive difficulty milestones
`;
    }

    const systemPrompt = `You are an expert habit coach and goal planner. Your job is to break down goals into actionable habits (recurring daily/weekly actions) and milestones (one-time achievements).

${epicTypeInstructions}

Rules:
1. Generate 3-6 habits (recurring actions that build toward the goal)
2. Generate 3-5 milestones (one-time checkpoints/achievements) spread across the timeline
3. Habits should be specific, measurable, and realistic
4. Each habit should fit within the user's available time (if specified)
5. Milestones should be progressive and motivating
6. Assign appropriate difficulty (easy for quick daily tasks, medium for moderate effort, hard for challenging ones)
7. For habits, suggest frequency (daily, weekly, or specific days)
8. For milestones, suggest which week they should be completed by
9. If user specified hours per day, ensure total habit time ≤ that amount

Return a JSON object with this exact structure:
{
  "suggestions": [
    {
      "id": "unique-id-1",
      "title": "Short actionable title",
      "type": "habit",
      "description": "Brief explanation",
      "frequency": "daily",
      "difficulty": "easy",
      "category": "category-name"
    },
    {
      "id": "unique-id-2", 
      "title": "Milestone title",
      "type": "milestone",
      "description": "What this milestone represents",
      "difficulty": "medium",
      "suggestedWeek": 2,
      "category": "category-name"
    }
  ]
}`;

    const userPrompt = `Break down this goal into habits and milestones:

Goal: "${goal}"
${durationContext}
${clarificationContext}

Generate practical, specific suggestions that will help achieve this goal. Make sure habits are realistic and milestones are properly spaced.`;

    console.log('Generating suggestions for goal:', goal, 'context:', epicContext, 'answers:', clarificationAnswers);

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
          { role: 'user', content: userPrompt }
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
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted, please try again later.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate suggestions');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from the response
    let suggestions: EpicSuggestion[];
    try {
      // Extract JSON from markdown code blocks if present
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      suggestions = parsed.suggestions || parsed;
      
      // Validate and ensure IDs exist
      suggestions = suggestions.map((s: any, i: number) => ({
        id: s.id || `suggestion-${Date.now()}-${i}`,
        title: s.title,
        type: s.type || 'habit',
        description: s.description || '',
        frequency: s.frequency || 'daily',
        customDays: s.customDays,
        difficulty: s.difficulty || 'medium',
        suggestedWeek: s.suggestedWeek,
        category: s.category,
      }));
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      throw new Error('Failed to parse AI suggestions');
    }

    console.log(`Generated ${suggestions.length} suggestions for goal: ${goal}`);

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating epic suggestions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
