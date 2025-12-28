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

interface GenerateRequest {
  goal: string;
  deadline?: string; // ISO date string
  targetDays?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal, deadline, targetDays } = await req.json() as GenerateRequest;

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

    const systemPrompt = `You are an expert habit coach and goal planner. Your job is to break down goals into actionable habits (recurring daily/weekly actions) and milestones (one-time achievements).

Rules:
1. Generate 3-5 habits (recurring actions that build toward the goal)
2. Generate 2-4 milestones (one-time checkpoints/achievements)
3. Habits should be specific, measurable, and realistic
4. Milestones should be spread across the timeline
5. Each item needs a clear, actionable title and brief description
6. Assign appropriate difficulty (easy for quick daily tasks, medium for moderate effort, hard for challenging ones)
7. For habits, suggest frequency (daily, weekly, or specific days)
8. For milestones, suggest which week they should be completed by

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

Generate practical, specific suggestions that will help achieve this goal.`;

    console.log('Generating suggestions for goal:', goal);

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
