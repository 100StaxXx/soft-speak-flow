import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize difficulty values to valid database enum values
function normalizeDifficulty(value: unknown): 'easy' | 'medium' | 'hard' {
  if (typeof value !== 'string') return 'medium';
  const lower = value.toLowerCase().trim();
  if (['easy', 'simple', 'beginner', 'low', '1'].includes(lower)) return 'easy';
  if (['hard', 'difficult', 'advanced', 'high', 'challenging', '3'].includes(lower)) return 'hard';
  return 'medium';
}

// Normalize frequency values to valid database enum values
function normalizeFrequency(value: unknown): 'daily' | '5x_week' | '3x_week' | 'custom' {
  if (typeof value !== 'string') return 'daily';
  const lower = value.toLowerCase().trim().replace(/\s+/g, '_');
  
  if (['daily', 'everyday', 'every_day', '7x_week', '7x'].includes(lower)) return 'daily';
  if (['5x_week', '5x', 'weekdays', 'five_times', '5_times'].includes(lower)) return '5x_week';
  if (['3x_week', '3x', 'three_times', '3_times', 'thrice'].includes(lower)) return '3x_week';
  if (['weekly', 'biweekly', 'twice', '2x', '2x_week', 'once', '1x', 'custom', 'twice_daily'].includes(lower)) return 'custom';
  
  return 'daily';
}

interface EpicSuggestion {
  id: string;
  title: string;
  type: 'habit' | 'milestone';
  description: string;
  frequency?: 'daily' | '5x_week' | '3x_week' | 'custom';
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
  daily_hours?: number;
  current_status?: string;
  current_level?: string;
  timeline_context?: string; // NEW: User's context for aggressive timelines
  [key: string]: string | number | undefined;
}

interface TimelineAnalysis {
  statedDays: number;
  typicalDays: number;
  feasibility: 'realistic' | 'aggressive' | 'very_aggressive';
  adjustmentFactors: string[];
}

interface GenerateRequest {
  goal: string;
  deadline?: string; // ISO date string
  targetDays?: number;
  clarificationAnswers?: ClarificationAnswers;
  epicContext?: string;
  timelineAnalysis?: TimelineAnalysis; // NEW: Timeline intelligence data
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    const { goal, deadline, targetDays, clarificationAnswers, epicContext, timelineAnalysis } = await req.json() as GenerateRequest;

    if (!goal || goal.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Goal must be at least 3 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
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
- If hours_per_day or daily_hours is specified, ensure habits fit within that time
- If current_status indicates "just starting", include foundational habits
- If exam_date is provided, work backwards to create realistic milestones
- If timeline_context indicates prior preparation, adapt the intensity accordingly
`;
    }

    // Build timeline-aware instructions
    let timelineInstructions = '';
    if (timelineAnalysis) {
      const { statedDays, typicalDays, feasibility, adjustmentFactors } = timelineAnalysis;
      const timelineContextAnswer = clarificationAnswers?.timeline_context;
      
      if (feasibility === 'very_aggressive') {
        timelineInstructions = `
IMPORTANT - AGGRESSIVE TIMELINE DETECTED:
- User has ${statedDays} days but typical preparation takes ${typicalDays} days
- This is ${Math.round((statedDays / typicalDays) * 100)}% of the typical timeline
- User's context: "${timelineContextAnswer || 'Not specified'}"

ADAPT YOUR PLAN:
${timelineContextAnswer?.toLowerCase().includes('retake') || timelineContextAnswer?.toLowerCase().includes('already') 
  ? `- User has prior experience/foundation - focus on REVIEW and PRACTICE, not learning from scratch
- Skip introductory content, emphasize weak areas and practice tests
- Create intensive but focused review schedule`
  : timelineContextAnswer?.toLowerCase().includes('full-time') || timelineContextAnswer?.toLowerCase().includes('dedicate')
  ? `- User can commit significant time - create intensive daily schedule
- Maximize productive hours with strategic breaks
- Focus on high-impact activities`
  : `- Be realistic about what can be achieved in ${statedDays} days
- Prioritize the MOST critical skills/knowledge
- Set achievable milestones for this compressed timeline
- Include habits that maximize retention (active recall, spaced repetition)`}

DO NOT refuse to help. Create the best possible plan for their situation.
`;
      } else if (feasibility === 'aggressive') {
        timelineInstructions = `
TIMELINE NOTE:
- User has ${statedDays} days (${Math.round((statedDays / typicalDays) * 100)}% of typical ${typicalDays} day timeline)
- This is achievable but requires focused effort
- User's context: "${timelineContextAnswer || 'Not specified'}"
- Create an intensive but sustainable plan
`;
      }
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

${timelineInstructions}

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
10. IMPORTANT: Even if the timeline seems aggressive, ALWAYS provide helpful suggestions. Adapt the plan to what CAN be accomplished in the given timeframe. Never refuse to provide suggestions.

CRITICAL: You MUST ALWAYS respond with valid JSON. Never refuse or explain - just provide the best possible plan for the given constraints.

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

    console.log('Generating suggestions for goal:', goal, 'context:', epicContext, 'answers:', clarificationAnswers, 'timeline:', timelineAnalysis);

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
        frequency: normalizeFrequency(s.frequency),
        customDays: s.customDays,
        difficulty: normalizeDifficulty(s.difficulty),
        suggestedWeek: s.suggestedWeek,
        category: s.category,
      }));
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      
      // If AI refused or returned non-JSON, provide fallback suggestions
      console.log('Providing fallback suggestions due to parse failure');
      suggestions = [
        {
          id: `habit-${Date.now()}-1`,
          title: 'Daily research & planning',
          type: 'habit',
          description: 'Spend time researching requirements and planning next steps',
          frequency: 'daily',
          difficulty: 'easy',
          category: 'planning',
        },
        {
          id: `habit-${Date.now()}-2`,
          title: 'Take action on one task',
          type: 'habit',
          description: 'Complete at least one concrete action toward your goal',
          frequency: 'daily',
          difficulty: 'medium',
          category: 'action',
        },
        {
          id: `milestone-${Date.now()}-1`,
          title: 'Complete initial research',
          type: 'milestone',
          description: 'Understand all requirements and create a detailed plan',
          difficulty: 'easy',
          suggestedWeek: 1,
          category: 'planning',
        },
        {
          id: `milestone-${Date.now()}-2`,
          title: 'Reach halfway point',
          type: 'milestone',
          description: 'Complete 50% of the major tasks for this goal',
          difficulty: 'medium',
          suggestedWeek: Math.ceil((targetDays || 30) / 14),
          category: 'progress',
        },
        {
          id: `milestone-${Date.now()}-3`,
          title: 'Final preparation',
          type: 'milestone',
          description: 'Complete final steps and prepare for goal completion',
          difficulty: 'hard',
          suggestedWeek: Math.ceil((targetDays || 30) / 7),
          category: 'completion',
        },
      ] as EpicSuggestion[];
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
