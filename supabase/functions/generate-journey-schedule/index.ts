import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JourneyPhase {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  phaseOrder: number;
}

interface JourneyMilestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  phaseOrder: number;
  phaseName: string;
  isPostcardMilestone: boolean;
  milestonePercent: number;
}

interface JourneyRitual {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'custom';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes?: number;
}

interface ScheduleRequest {
  goal: string;
  deadline: string; // ISO date string
  clarificationAnswers?: Record<string, string | number | undefined>;
  epicContext?: string;
  timelineContext?: {
    accelerators?: string[];
    constraints?: string[];
  };
  adjustmentRequest?: string; // For negotiation - e.g., "make it less aggressive"
  previousSchedule?: {
    phases: JourneyPhase[];
    milestones: JourneyMilestone[];
    rituals: JourneyRitual[];
  };
}

interface ScheduleResponse {
  feasibilityAssessment: {
    daysAvailable: number;
    typicalDays: number;
    feasibility: 'comfortable' | 'achievable' | 'aggressive' | 'very_aggressive';
    message: string;
  };
  phases: JourneyPhase[];
  milestones: JourneyMilestone[];
  rituals: JourneyRitual[];
  weeklyHoursEstimate: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal, deadline, clarificationAnswers, epicContext, timelineContext, adjustmentRequest, previousSchedule } = await req.json() as ScheduleRequest;

    if (!goal || goal.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Goal must be at least 3 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!deadline) {
      return new Response(
        JSON.stringify({ error: 'Deadline is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Calculate days until deadline
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysAvailable = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysAvailable < 7) {
      return new Response(
        JSON.stringify({ error: 'Deadline must be at least 7 days from now' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context from clarification answers
    let clarificationContext = '';
    if (clarificationAnswers && Object.keys(clarificationAnswers).length > 0) {
      clarificationContext = `
User's context:
${Object.entries(clarificationAnswers)
  .filter(([_, v]) => v !== undefined && v !== '')
  .map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`)
  .join('\n')}
`;
    }

    // Build timeline context for accelerators and constraints
    let timelineContextPrompt = '';
    if (timelineContext?.accelerators?.length || timelineContext?.constraints?.length) {
      if (timelineContext.accelerators?.length) {
        timelineContextPrompt += `
EXISTING ADVANTAGES (user can progress faster):
${timelineContext.accelerators.map((a, i) => `${i + 1}. ${a}`).join('\n')}
Consider skipping or shortening foundational phases. The user may be ready for intermediate/advanced work sooner.
`;
      }
      if (timelineContext.constraints?.length) {
        timelineContextPrompt += `
CONSTRAINTS (must work around these):
${timelineContext.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}
Adjust phase timing, milestone dates, and ritual intensity to accommodate these limitations.
`;
      }
    }

    // Build adjustment context for negotiation
    let adjustmentContext = '';
    if (adjustmentRequest && previousSchedule) {
      adjustmentContext = `
ADJUSTMENT REQUEST: The user wants to modify the plan.
User's feedback: "${adjustmentRequest}"

Previous plan had:
- ${previousSchedule.phases.length} phases
- ${previousSchedule.milestones.length} milestones
- ${previousSchedule.rituals.length} rituals

Adjust the plan based on the user's feedback while keeping the same deadline.
`;
    }

    const systemPrompt = `You are an expert goal planner who creates detailed, deadline-driven schedules. You work backwards from deadlines to create realistic phased plans.

Your job is to:
1. Assess the feasibility of the goal given the deadline
2. Create 3-5 PHASES with specific date ranges
3. Create 3-6 MILESTONES with target dates (mark 3-5 as "postcard milestones" for celebrations)
4. Create 3-6 RITUALS (recurring habits)
5. Estimate weekly time commitment

For each phase, work backwards from the deadline:
- Final Phase: Polish and prepare (last 10-15% of time)
- Middle Phases: Core work and practice
- First Phase: Foundation and setup (first 15-20% of time)

Milestones should have actual dates, not just weeks. Spread them across phases.
Mark key milestones (typically at 25%, 50%, 75%, and end) as postcard milestones.

CRITICAL: Return ONLY valid JSON with this exact structure:
{
  "feasibilityAssessment": {
    "daysAvailable": <number>,
    "typicalDays": <number for typical preparation time>,
    "feasibility": "comfortable" | "achievable" | "aggressive" | "very_aggressive",
    "message": "<encouraging message about the timeline>"
  },
  "phases": [
    {
      "id": "phase-1",
      "name": "Phase Name",
      "description": "What happens in this phase",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "phaseOrder": 1
    }
  ],
  "milestones": [
    {
      "id": "milestone-1",
      "title": "Milestone title",
      "description": "What this achievement means",
      "targetDate": "YYYY-MM-DD",
      "phaseOrder": 1,
      "phaseName": "Phase Name",
      "isPostcardMilestone": true,
      "milestonePercent": 25
    }
  ],
  "rituals": [
    {
      "id": "ritual-1",
      "title": "Daily ritual title",
      "description": "What to do",
      "frequency": "daily",
      "difficulty": "medium",
      "estimatedMinutes": 30
    }
  ],
  "weeklyHoursEstimate": <number>
}`;

    const today = new Date().toISOString().split('T')[0];
    
    const userPrompt = `Create a detailed schedule for this goal:

Goal: "${goal}"
Today's date: ${today}
Deadline: ${deadline} (${daysAvailable} days from now)
${clarificationContext}
${epicContext ? `Context type: ${epicContext}` : ''}
${timelineContextPrompt}
${adjustmentContext}

Generate a phased schedule working backwards from the deadline. Make sure:
1. All dates are between ${today} and ${deadline}
2. Phases connect without gaps
3. Milestones are spread across phases with real dates
4. Mark 3-5 key milestones as postcard milestones (typically at 25%, 50%, 75%, 100% progress)
5. Rituals are realistic for the available time
${timelineContext?.accelerators?.length ? '6. Consider the user\'s existing advantages when pacing the schedule - they may be able to skip basics' : ''}
${timelineContext?.constraints?.length ? '7. Respect the user\'s constraints when scheduling phases and milestones' : ''}`;

    console.log('Generating journey schedule for goal:', goal, 'deadline:', deadline, 'days:', daysAvailable, 'context:', timelineContext);

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
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate schedule');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from the response
    let schedule: ScheduleResponse;
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      schedule = JSON.parse(jsonStr);
      
      // Validate and fix IDs
      schedule.phases = schedule.phases.map((p, i) => ({
        ...p,
        id: p.id || `phase-${Date.now()}-${i}`,
        phaseOrder: p.phaseOrder || i + 1,
      }));
      
      schedule.milestones = schedule.milestones.map((m, i) => ({
        ...m,
        id: m.id || `milestone-${Date.now()}-${i}`,
        isPostcardMilestone: m.isPostcardMilestone ?? false,
        milestonePercent: m.milestonePercent || Math.round((i + 1) / schedule.milestones.length * 100),
      }));
      
      schedule.rituals = schedule.rituals.map((r, i) => ({
        ...r,
        id: r.id || `ritual-${Date.now()}-${i}`,
        frequency: r.frequency || 'daily',
        difficulty: r.difficulty || 'medium',
      }));
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      
      // Provide fallback schedule
      const phaseLength = Math.floor(daysAvailable / 3);
      const phase1End = new Date(now.getTime() + phaseLength * 24 * 60 * 60 * 1000);
      const phase2End = new Date(now.getTime() + phaseLength * 2 * 24 * 60 * 60 * 1000);
      
      schedule = {
        feasibilityAssessment: {
          daysAvailable,
          typicalDays: daysAvailable,
          feasibility: 'achievable',
          message: `You have ${daysAvailable} days to achieve your goal. Let's create a solid plan!`,
        },
        phases: [
          {
            id: `phase-${Date.now()}-1`,
            name: 'Foundation',
            description: 'Build the groundwork for your goal',
            startDate: today,
            endDate: phase1End.toISOString().split('T')[0],
            phaseOrder: 1,
          },
          {
            id: `phase-${Date.now()}-2`,
            name: 'Core Work',
            description: 'Main effort and practice',
            startDate: phase1End.toISOString().split('T')[0],
            endDate: phase2End.toISOString().split('T')[0],
            phaseOrder: 2,
          },
          {
            id: `phase-${Date.now()}-3`,
            name: 'Final Push',
            description: 'Polish and complete your goal',
            startDate: phase2End.toISOString().split('T')[0],
            endDate: deadline,
            phaseOrder: 3,
          },
        ],
        milestones: [
          {
            id: `milestone-${Date.now()}-1`,
            title: 'Complete foundation',
            description: 'Finish initial setup and planning',
            targetDate: phase1End.toISOString().split('T')[0],
            phaseOrder: 1,
            phaseName: 'Foundation',
            isPostcardMilestone: true,
            milestonePercent: 25,
          },
          {
            id: `milestone-${Date.now()}-2`,
            title: 'Reach halfway point',
            description: 'Complete 50% of main work',
            targetDate: phase2End.toISOString().split('T')[0],
            phaseOrder: 2,
            phaseName: 'Core Work',
            isPostcardMilestone: true,
            milestonePercent: 50,
          },
          {
            id: `milestone-${Date.now()}-3`,
            title: 'Goal achieved!',
            description: 'Successfully complete your goal',
            targetDate: deadline,
            phaseOrder: 3,
            phaseName: 'Final Push',
            isPostcardMilestone: true,
            milestonePercent: 100,
          },
        ],
        rituals: [
          {
            id: `ritual-${Date.now()}-1`,
            title: 'Daily progress action',
            description: 'Take one concrete step toward your goal',
            frequency: 'daily',
            difficulty: 'medium',
            estimatedMinutes: 30,
          },
          {
            id: `ritual-${Date.now()}-2`,
            title: 'Weekly review',
            description: 'Review progress and plan the next week',
            frequency: 'weekly',
            difficulty: 'easy',
            estimatedMinutes: 20,
          },
        ],
        weeklyHoursEstimate: 5,
      };
    }

    console.log(`Generated schedule with ${schedule.phases.length} phases, ${schedule.milestones.length} milestones, ${schedule.rituals.length} rituals`);

    return new Response(
      JSON.stringify(schedule),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating journey schedule:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
