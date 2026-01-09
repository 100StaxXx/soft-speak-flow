import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  frequency: 'daily' | '5x_week' | '3x_week' | 'custom';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes?: number;
}

interface ScheduleRequest {
  goal: string;
  deadline: string; // ISO date string
  clarificationAnswers?: Record<string, string | number | undefined>;
  epicContext?: string;
  timelineContext?: string;
  adjustmentRequest?: string; // For negotiation - e.g., "make it less aggressive"
  previousSchedule?: {
    phases: JourneyPhase[];
    milestones: JourneyMilestone[];
    rituals: JourneyRitual[];
  };
}

type StoryTypeSlug = 'treasure_hunt' | 'mystery' | 'pilgrimage' | 'heroes_journey' | 'rescue_mission' | 'exploration';
type ThemeColorId = 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar';

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
  suggestedChapterCount: number; // AI-determined optimal number of chapters/postcards
  suggestedStoryType: StoryTypeSlug;
  suggestedThemeColor: ThemeColorId;
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

    // Build timeline context prompt
    let timelineContextPrompt = '';
    if (timelineContext && timelineContext.trim()) {
      timelineContextPrompt = `
IMPORTANT CONTEXT from the user about their situation:
"${timelineContext}"

Consider this when planning - it may include:
- Existing skills or experience (could allow skipping or shortening early phases)
- Time constraints or availability limitations (adjust pacing accordingly)
- Dependencies or prerequisites they're waiting on
- Equipment or resources they have or need

Adjust the timeline based on this context.
`;
    }

    // Build adjustment context for negotiation
    let adjustmentContext = '';
    if (adjustmentRequest && previousSchedule) {
      adjustmentContext = `
ADJUSTMENT REQUEST: The user wants to modify the plan.
User's feedback: "${adjustmentRequest}"

Previous plan had:
- ${previousSchedule.phases.length} phases
- ${previousSchedule.milestones.length} milestones (${previousSchedule.milestones.filter(m => m.isPostcardMilestone).length} postcard/chapter milestones)
- ${previousSchedule.rituals.length} rituals

Adjust the plan based on the user's feedback while keeping the same deadline.
Keep the same number of postcard milestones unless the feedback specifically asks to change this.
`;
    }

    const systemPrompt = `You are an expert goal planner who creates detailed, deadline-driven schedules. You work backwards from deadlines to create realistic phased plans.

Your job is to:
1. Assess the feasibility of the goal given the deadline
2. Create 3-5 PHASES with specific date ranges
3. DETERMINE THE OPTIMAL NUMBER OF CHAPTERS/POSTCARDS based on:
   - Goal complexity (simple goals = fewer chapters, complex multi-step goals = more)
   - Timeline length (7-14 days: 3-4 chapters, 15-30 days: 4-5, 31-60 days: 5-6, 60+ days: 6-7)
   - Natural breaking points in the journey
4. Create postcard milestones with specific target dates - one per chapter, evenly distributed
5. You may also create 1-3 additional non-postcard milestones as intermediate goals
6. Create 3-6 RITUALS (recurring habits)
7. Estimate weekly time commitment
8. INFER THE BEST STORY TYPE based on the goal:
   - "treasure_hunt": Finding/acquiring something (job, house, money, items, certifications)
   - "mystery": Learning/understanding (studying, research, problem-solving, exams)
   - "pilgrimage": Inner growth/wellness (meditation, health, spirituality, mental health)
   - "heroes_journey": Becoming something (career change, mastering skills, transformation)
   - "rescue_mission": Urgency/helping others (deadlines, caregiving, emergencies)
   - "exploration": Discovery/creativity (travel, art, trying new things, hobbies)
9. SELECT A MATCHING THEME COLOR based on story type:
   - "heroic" (gold): treasure_hunt, heroes_journey
   - "warrior" (red): rescue_mission
   - "mystic" (pink): mystery
   - "nature" (green): exploration, pilgrimage
   - "solar" (orange): general/default

POSTCARD MILESTONE GUIDELINES:
- Each postcard milestone represents a story chapter - a major progress point
- Distribute them evenly across the timeline
- Minimum 3 chapters (for short/simple goals), maximum 7 (for long/complex goals)
- Each should have isPostcardMilestone: true and a unique milestonePercent

For each phase, work backwards from the deadline:
- Final Phase: Polish and prepare (last 10-15% of time)
- Middle Phases: Core work and practice
- First Phase: Foundation and setup (first 15-20% of time)

Milestones should have actual dates, not just weeks. Spread them across phases.

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
  "weeklyHoursEstimate": <number>,
  "suggestedChapterCount": <number between 3-7 - must match the count of postcard milestones>,
  "suggestedStoryType": "treasure_hunt" | "mystery" | "pilgrimage" | "heroes_journey" | "rescue_mission" | "exploration",
  "suggestedThemeColor": "heroic" | "warrior" | "mystic" | "nature" | "solar"
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
3. Determine the optimal number of postcard milestones (3-7) based on goal complexity and timeline length
4. Each postcard milestone has a specific target date and represents a story chapter
5. Spread milestones across phases with real dates
6. Rituals are realistic for the available time
7. suggestedChapterCount matches the exact count of milestones with isPostcardMilestone: true
${timelineContext ? '8. Adjust the schedule based on the user\'s context (existing skills, constraints, etc.)' : ''}`;

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

    // Log raw AI response for debugging
    console.log('[Journey Schedule] Raw AI response length:', content?.length, 'chars');

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
      
      // Log parsed rituals for debugging
      console.log('[Journey Schedule] Parsed rituals:', schedule.rituals?.length, schedule.rituals?.map(r => r.title));
      
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
        frequency: normalizeFrequency(r.frequency),
        difficulty: normalizeDifficulty(r.difficulty),
      }));
      
      // Ensure suggestedChapterCount matches actual postcard milestone count
      const postcardCount = schedule.milestones.filter(m => m.isPostcardMilestone).length;
      schedule.suggestedChapterCount = postcardCount > 0 ? postcardCount : (schedule.suggestedChapterCount || 5);
      
      // Ensure story type and theme color have valid values
      const validStoryTypes: StoryTypeSlug[] = ['treasure_hunt', 'mystery', 'pilgrimage', 'heroes_journey', 'rescue_mission', 'exploration'];
      const validThemeColors: ThemeColorId[] = ['heroic', 'warrior', 'mystic', 'nature', 'solar'];
      
      if (!validStoryTypes.includes(schedule.suggestedStoryType)) {
        schedule.suggestedStoryType = 'heroes_journey';
      }
      if (!validThemeColors.includes(schedule.suggestedThemeColor)) {
        // Default theme based on story type
        const themeMap: Record<StoryTypeSlug, ThemeColorId> = {
          treasure_hunt: 'heroic',
          heroes_journey: 'heroic',
          rescue_mission: 'warrior',
          mystery: 'mystic',
          exploration: 'nature',
          pilgrimage: 'nature',
        };
        schedule.suggestedThemeColor = themeMap[schedule.suggestedStoryType] || 'solar';
      }
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      
      // Calculate fallback chapter count based on timeline
      let fallbackChapterCount = 5;
      if (daysAvailable <= 14) fallbackChapterCount = 3;
      else if (daysAvailable <= 30) fallbackChapterCount = 4;
      else if (daysAvailable <= 60) fallbackChapterCount = 5;
      else fallbackChapterCount = 6;
      
      // Provide fallback schedule with correct number of chapters
      const phaseLength = Math.floor(daysAvailable / 3);
      const phase1End = new Date(now.getTime() + phaseLength * 24 * 60 * 60 * 1000);
      const phase2End = new Date(now.getTime() + phaseLength * 2 * 24 * 60 * 60 * 1000);
      
      // Generate milestones based on fallback chapter count
      const fallbackMilestones: JourneyMilestone[] = [];
      for (let i = 0; i < fallbackChapterCount; i++) {
        const percent = Math.round(((i + 1) / fallbackChapterCount) * 100);
        const dayOffset = Math.floor((daysAvailable * percent) / 100);
        const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        
        let phaseOrder = 1;
        let phaseName = 'Foundation';
        if (percent > 66) {
          phaseOrder = 3;
          phaseName = 'Final Push';
        } else if (percent > 33) {
          phaseOrder = 2;
          phaseName = 'Core Work';
        }
        
        fallbackMilestones.push({
          id: `milestone-${Date.now()}-${i}`,
          title: i === fallbackChapterCount - 1 ? 'Goal achieved!' : `Chapter ${i + 1} milestone`,
          description: i === fallbackChapterCount - 1 ? 'Successfully complete your goal' : `Complete ${percent}% of your journey`,
          targetDate: targetDate.toISOString().split('T')[0],
          phaseOrder,
          phaseName,
          isPostcardMilestone: true,
          milestonePercent: percent,
        });
      }
      
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
        milestones: fallbackMilestones,
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
            frequency: 'custom',
            difficulty: 'easy',
            estimatedMinutes: 20,
          },
        ],
        weeklyHoursEstimate: 5,
        suggestedChapterCount: fallbackChapterCount,
        suggestedStoryType: 'heroes_journey',
        suggestedThemeColor: 'heroic',
      };
    }

    console.log(`Generated schedule with ${schedule.phases.length} phases, ${schedule.milestones.length} milestones (${schedule.suggestedChapterCount} chapters), ${schedule.rituals.length} rituals`);

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
