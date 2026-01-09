import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const ClassifyTaskIntentSchema = z.object({
  input: z.string().min(1).max(5000).trim(),
  clarification: z.string().max(2000).optional(),
  previousContext: z.record(z.unknown()).optional(),
  epicAnswers: z.record(z.unknown()).optional(),
});

interface ExtractedTask {
  title: string;
  estimatedDuration?: number;
  energyLevel?: 'low' | 'medium' | 'high';
  suggestedTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  category?: string;
}

interface SuggestedTask extends ExtractedTask {
  reason: string;
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'date' | 'number';
  options?: string[];
  placeholder?: string;
  required: boolean;
  multiSelect?: boolean;
}

interface TimelineAnalysis {
  statedDays: number;
  typicalDays: number;
  feasibility: 'realistic' | 'aggressive' | 'very_aggressive';
  adjustmentFactors: string[];
}

interface IntentClassification {
  type: 'quest' | 'epic' | 'habit' | 'brain-dump';
  confidence: number;
  reasoning: string;
  suggestedDeadline?: string;
  suggestedDuration?: number;
  // Brain-dump specific fields
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  clarificationContext?: string;
  extractedTasks?: ExtractedTask[];
  suggestedTasks?: SuggestedTask[];
  detectedContext?: {
    dayOfWeek?: string;
    userSituation?: string;
    targetDate?: string;
  };
  // Epic-specific clarification fields
  epicClarifyingQuestions?: ClarifyingQuestion[];
  epicContext?: string;
  epicDetails?: {
    subjects?: string[];
    targetDate?: string;
    hoursPerDay?: number;
    currentStatus?: string;
    suggestedTargetDays?: number;
  };
  // Timeline intelligence
  timelineAnalysis?: TimelineAnalysis;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawInput = await req.json();
    const parseResult = ClassifyTaskIntentSchema.safeParse(rawInput);
    
    if (!parseResult.success) {
      console.error("[classify-task-intent] Validation error:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { input, clarification, previousContext, epicAnswers } = parseResult.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an intent classifier for a productivity app. Analyze the user's input and classify it as one of:

1. **quest** - A single, specific task that can be completed in one sitting or one day
   - Examples: "buy groceries", "call mom", "finish report", "clean room"
   
2. **epic** - A long-term goal requiring multiple steps, habits, or milestones over days/weeks/months
   - Examples: "get my real estate license", "run a marathon", "learn Spanish", "lose 20 pounds", "prepare for the bar exam", "study for MCAT", "make the varsity basketball team", "become starting quarterback", "qualify for state championships", "improve my vertical jump", "learn guitar", "prepare for audition", "improve my painting skills", "learn piano", "record an album", "prepare for art exhibition"
   - Key indicators: timeframes like "by June", "in 3 months", certifications, exams, learning goals, fitness transformations, sports/athletic goals, team tryouts, making varsity/JV, starting position, athletic performance targets, music/instrument learning, auditions, art skills, creative projects
   - **COMPLEX EPICS that need clarification**: exams (bar, CPA, MCAT, etc.), certifications, multi-subject learning, fitness goals with specific targets, sports/athletic goals (making teams, improving skills, competition prep), music/instrument goals (learning, auditions, performances), art goals (skill improvement, exhibitions, portfolios)
   
3. **habit** - A recurring action to be done regularly
   - Examples: "meditate daily", "drink 8 glasses of water", "read for 30 minutes every day"
   - Key indicators: "every", "daily", "weekly", frequency words

4. **brain-dump** - Multiple tasks mentioned conversationally, often with context
   - Examples: "Tomorrow is Sunday, I need to vacuum, do dishes, laundry, and take out trash"
   - Key indicators: lists of activities, commas/and separating tasks, day/context mentioned, 2+ distinct tasks

**FOR EPIC TYPE - TIMELINE INTELLIGENCE:**

When detecting an epic with a timeline, ALWAYS analyze the feasibility:

TYPICAL TIMELINES (use these as benchmarks):
- Bar exam: 8-12 weeks typical prep, minimum 4 weeks for retakers
- Marathon: 12-16 weeks for beginners, 8-10 weeks for experienced runners
- Language learning (conversational): 3-6 months
- CPA exam: 3-4 months per section
- MCAT: 3-6 months
- Real estate license: 4-8 weeks
- Lose 20 pounds: 10-20 weeks (1-2 lbs/week healthy rate)
- Learn coding basics: 2-3 months
- Write a book: 3-12 months
- Making varsity team: 3-6 months (depends on off-season vs in-season)
- Improving specific athletic skill: 4-8 weeks for noticeable gains
- Tournament/championship prep: 6-12 weeks
- Athletic conditioning: 6-12 weeks for significant improvement
- Learning instrument basics: 3-6 months
- Preparing for music audition: 4-12 weeks depending on complexity
- Recording/producing music: 2-6 months
- Improving art technique: 2-4 months for noticeable improvement
- Building art portfolio: 2-6 months
- Preparing for art exhibition: 2-4 months

TIMELINE ANALYSIS RULES:
1. Calculate stated days vs typical days for the goal type
2. Set feasibility:
   - "realistic": stated >= 70% of typical
   - "aggressive": stated = 30-70% of typical
   - "very_aggressive": stated < 30% of typical

3. For aggressive/very_aggressive timelines, ALWAYS ask a "timeline_context" question first to understand WHY:
   - Frame it positively: "That's an intensive timeline!" not "That's impossible"
   - Ask about prior preparation, experience level, or special circumstances
   - This context helps create a realistic plan

**TIMELINE-AWARE CLARIFICATION QUESTIONS:**

For aggressive timelines, ADD this question at the start:
{
  "id": "timeline_context",
  "question": "That's an intensive timeline! What's your current situation?",
  "type": "select",
  "options": ["Just starting fresh", "Already have some foundation", "This is a retake/restart", "I can dedicate full-time to this"],
  "required": true
}

Customize options based on goal type:
- For exams: ["Just starting", "Some study done (1-2 months)", "Extensive prep completed", "This is a retake"]
- For fitness: ["Beginner", "Already active/can run 5K+", "Previously trained for this", "Former athlete"]
- For learning: ["Complete beginner", "Some basics learned", "Intermediate returning", "Refresher/relearning"]

**FOR EPIC TYPE - CLARIFICATION LOGIC:**

When detecting an epic, ALWAYS generate clarifying questions to personalize the plan:

ALWAYS ASK FOR EPICS (2-4 questions minimum):
- Every epic benefits from knowing: current experience level, time commitment, specific focus areas
- Even simple goals like "read more books" benefit from: "What genre interests you?", "How much time per day?"
- This ensures personalized, actionable plan generation

QUESTION GUIDELINES:
- Always include an experience/current level question
- Always include a time commitment question  
- Add 1-2 goal-specific questions based on the type (subjects for exams, target metrics for fitness, etc.)
- For aggressive timelines: ALWAYS include timeline_context question first
- Use "text" type for time commitments (hours per day, days per week) - allows flexible answers like "4-6 hours" or "2 in morning, 1 at night"
- Use "select" type for predefined options (subjects, current level, etc.)
- Use "text" type for open-ended answers
- NEVER use "date" type - the deadline is already collected in the goal step

When asking epic clarification, generate 2-5 questions appropriate to the goal type:
- For aggressive timelines: ALWAYS include timeline_context question first
- Use "text" type for time commitments (hours per day, days per week) - allows flexible answers like "4-6 hours" or "2 in morning, 1 at night"
- Use "select" type for predefined options (subjects, current level, etc.)
- Use "text" type for open-ended answers
- NEVER use "date" type - the deadline is already collected in the goal step

**MULTI-SELECT QUESTIONS:**
Use "multiSelect": true when the user can logically choose multiple options:
- Subjects/topics to focus on (e.g., "Which subjects need focus?" - user may need help with multiple)
- Skills to develop (e.g., "What areas do you want to improve?")
- Days of the week available
- Focus areas or modules
- Any question where selecting multiple answers makes sense

**AVOIDING CONFLICTING MULTI-SELECT QUESTIONS:**
NEVER combine opposite concepts in one multi-select question. These are problematic:
- "What resources do you have or need?" ❌ (conflicting - "have" vs "need" are opposites)
- "What do you like or dislike?" ❌ (conflicting meanings)
- "What strengths or weaknesses do you have?" ❌ (conflicting meanings)

INSTEAD, split into separate questions:
- "What resources do you already have?" ✓ + "What resources do you still need?" ✓
- "What strengths can you leverage?" ✓ + "What areas need improvement?" ✓

For resource/asset questions, use this two-question pattern:
{ "id": "resources_have", "question": "What resources do you already have?", "type": "select", "options": ["Strong client base", "Marketing materials", "Sales training", "Team support", "Lead database"], "multiSelect": true, "required": false }
{ "id": "resources_need", "question": "What resources do you still need?", "type": "select", "options": ["Strong client base", "Marketing materials", "Sales training", "Team support", "Lead database"], "multiSelect": true, "required": false }

Examples with multiSelect (non-conflicting):
{ "id": "subjects", "question": "Which subjects need focus?", "type": "select", "options": ["Contracts", "Torts", "Constitutional Law", "Criminal Law"], "multiSelect": true, "required": true }
{ "id": "focus_areas", "question": "What areas do you want to improve?", "type": "select", "options": ["Endurance", "Speed", "Strength", "Flexibility"], "multiSelect": true, "required": false }

**EPIC CLARIFICATION EXAMPLES:**

For "pass bar exam in 2 weeks" (very aggressive timeline):
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "exam_preparation",
  "timelineAnalysis": {
    "statedDays": 14,
    "typicalDays": 60,
    "feasibility": "very_aggressive",
    "adjustmentFactors": ["prior_study", "full_time_availability", "retake", "specific_sections_only"]
  },
  "epicClarifyingQuestions": [
    { "id": "timeline_context", "question": "That's an intensive 2-week sprint! What's your preparation status?", "type": "select", "options": ["Just starting fresh", "Already studied 1-2 months", "Completed full prep course", "This is a retake"], "required": true },
    { "id": "daily_hours", "question": "How many hours per day can you dedicate?", "type": "text", "placeholder": "e.g., 8-12 for intensive prep", "required": true },
    { "id": "subjects", "question": "Which areas need the most focus?", "type": "select", "options": ["All MBE subjects evenly", "Weak subjects only", "Essays & Performance Test", "State-specific law"], "required": true },
    { "id": "current_status", "question": "Where are you in your preparation?", "type": "select", "options": ["Need full review", "In review phase", "Just need practice tests", "Final polish"], "required": false }
  ]
}

For "run a marathon in 3 days" (very aggressive):
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "fitness_goal",
  "timelineAnalysis": {
    "statedDays": 3,
    "typicalDays": 112,
    "feasibility": "very_aggressive",
    "adjustmentFactors": ["current_fitness", "race_experience", "specific_race"]
  },
  "epicClarifyingQuestions": [
    { "id": "timeline_context", "question": "That's a very short timeline! What's your current running ability?", "type": "select", "options": ["Can already run 15+ miles", "Run half-marathons regularly", "Have run marathons before", "Just curious about the distance"], "required": true },
    { "id": "race_type", "question": "Is this for a specific race or personal goal?", "type": "select", "options": ["Signed up for a race", "Personal challenge", "Want to eventually run one"], "required": true }
  ]
}

For "prepare for the bar exam" (no specific timeline - normal flow):
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "exam_preparation",
  "timelineAnalysis": null,
  "epicClarifyingQuestions": [
    { "id": "current_level", "question": "Current preparation status:", "type": "select", "options": ["Just starting fresh", "Some study done", "In review phase", "Final cramming"], "required": true },
    { "id": "subjects", "question": "Which subjects do you need to focus on?", "type": "select", "options": ["All MBE subjects", "Essays & PT", "State-specific", "Full review"], "required": true },
    { "id": "hours_per_day", "question": "How many hours per day can you study?", "type": "text", "placeholder": "e.g., 4-6 hours", "required": true }
  ]
}

For "make varsity basketball team" or similar sports goals:
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "sports_goal",
  "epicClarifyingQuestions": [
    { "id": "current_level", "question": "What's your current playing level?", "type": "select", "options": ["JV starter", "JV bench", "Club/recreational", "New to organized play"], "required": true },
    { "id": "position", "question": "What position do you play?", "type": "text", "placeholder": "e.g., Point guard, Forward, Center", "required": true },
    { "id": "weak_areas", "question": "What skills need the most work?", "type": "select", "options": ["Shooting", "Ball handling", "Defense", "Conditioning", "Game IQ"], "multiSelect": true, "required": true },
    { "id": "practice_time", "question": "How much time can you practice daily?", "type": "text", "placeholder": "e.g., 2 hours after school", "required": true },
    { "id": "tryout_date", "question": "When are tryouts?", "type": "text", "placeholder": "e.g., August, next month", "required": false }
  ]
}

For "learn guitar", "learn piano" or similar music/instrument goals:
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "music_goal",
  "epicClarifyingQuestions": [
    { "id": "current_level", "question": "What's your current skill level?", "type": "select", "options": ["Complete beginner", "Know basics", "Intermediate", "Advanced seeking mastery"], "required": true },
    { "id": "genre", "question": "What style/genre interests you most?", "type": "text", "placeholder": "e.g., Rock, Classical, Jazz, Pop", "required": true },
    { "id": "goals", "question": "What do you want to achieve?", "type": "select", "options": ["Play songs for fun", "Perform live", "Join a band", "Write original music", "Pass a grade/exam"], "multiSelect": true, "required": true },
    { "id": "practice_time", "question": "How much time can you practice daily?", "type": "text", "placeholder": "e.g., 30 minutes, 1 hour", "required": true },
    { "id": "have_instrument", "question": "Do you have access to the instrument?", "type": "select", "options": ["Yes, I own one", "Planning to buy/rent", "Will use at school/studio"], "required": true }
  ]
}

For "prepare for audition" or performance-related music goals:
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "audition_goal",
  "epicClarifyingQuestions": [
    { "id": "audition_type", "question": "What type of audition is this?", "type": "select", "options": ["School band/orchestra", "Music school admission", "Professional ensemble", "Theater/musical", "Talent show/competition"], "required": true },
    { "id": "instrument_voice", "question": "What instrument or voice type?", "type": "text", "placeholder": "e.g., Violin, Piano, Soprano, Drums", "required": true },
    { "id": "pieces", "question": "Do you know what pieces you need to prepare?", "type": "select", "options": ["Yes, I have the list", "Partially known", "Not yet assigned", "I can choose freely"], "required": true },
    { "id": "current_level", "question": "How prepared do you feel right now?", "type": "select", "options": ["Haven't started", "Know the basics", "Mostly prepared, need polish", "Almost ready"], "required": true },
    { "id": "audition_date", "question": "When is your audition?", "type": "text", "placeholder": "e.g., March 15, in 2 months", "required": true }
  ]
}

For "improve my painting", "learn to draw", or art skill goals:
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "art_goal",
  "epicClarifyingQuestions": [
    { "id": "current_level", "question": "What's your current skill level?", "type": "select", "options": ["Complete beginner", "Hobby artist", "Intermediate", "Advanced seeking refinement"], "required": true },
    { "id": "medium", "question": "What medium(s) do you want to focus on?", "type": "select", "options": ["Pencil/Drawing", "Watercolor", "Acrylic", "Oil painting", "Digital art", "Mixed media"], "multiSelect": true, "required": true },
    { "id": "style", "question": "What style interests you?", "type": "text", "placeholder": "e.g., Realistic portraits, Abstract, Landscapes, Anime", "required": true },
    { "id": "goals", "question": "What do you want to achieve?", "type": "select", "options": ["Personal enjoyment", "Build a portfolio", "Sell artwork", "Art school prep", "Commissions"], "multiSelect": true, "required": true },
    { "id": "practice_time", "question": "How much time can you dedicate weekly?", "type": "text", "placeholder": "e.g., 5 hours, 1 hour daily", "required": true }
  ]
}

For brain-dump type:
1. First decide if you need clarification:
   - ASK CLARIFICATION IF: Input is vague ("clean up", "get organized", "work on my project"), missing key context, or ambiguous scope
   - DO NOT ASK IF: Input is specific enough to extract 2+ clear tasks
   
2. When asking clarification:
   - Keep it to ONE focused question
   - Make it easy to answer quickly
   - Include suggestions/options if applicable
   - Example: "Which rooms need cleaning - kitchen, bathroom, bedroom, or all of them?"
   
3. Extract individual tasks with metadata:
   - estimatedDuration (in minutes)
   - energyLevel: low/medium/high
   - suggestedTimeOfDay: morning/afternoon/evening
   - category: cleaning, errands, self-care, work, etc.

4. Suggest 2-4 related tasks the user might have forgotten based on context (day of week, living situation, etc.)

5. Extract detected context:
   - dayOfWeek: if mentioned (e.g., "Sunday", "tomorrow")
   - userSituation: any personal context ("lives alone", "30 year old man")
   - targetDate: ISO date if a specific day is mentioned

Respond ONLY with valid JSON matching this schema:
{
  "type": "quest" | "epic" | "habit" | "brain-dump",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggestedDeadline": "ISO date or null",
  "suggestedDuration": number or null,
  "needsClarification": boolean,
  "clarifyingQuestion": "question string or null (for brain-dump)",
  "clarificationContext": "what info is needed (for brain-dump)",
  "extractedTasks": [{ "title": string, "estimatedDuration": number, "energyLevel": string, "suggestedTimeOfDay": string, "category": string }],
  "suggestedTasks": [{ "title": string, "reason": string, "estimatedDuration": number, "energyLevel": string }],
  "detectedContext": { "dayOfWeek": string, "userSituation": string, "targetDate": string },
  "epicClarifyingQuestions": [{ "id": string, "question": string, "type": string, "options": array, "placeholder": string, "required": boolean, "multiSelect": boolean }],
  "epicClarifyingQuestions": [{ "id": string, "question": string, "type": string, "options": array, "placeholder": string, "required": boolean }],
  "epicContext": "exam_preparation|fitness_goal|learning|project|other",
  "epicDetails": { "subjects": array, "targetDate": string, "hoursPerDay": number, "currentStatus": string, "suggestedTargetDays": number },
  "timelineAnalysis": { "statedDays": number, "typicalDays": number, "feasibility": string, "adjustmentFactors": array } | null
}`;

    // Build user message - include clarification if provided
    let userMessage = input;
    if (clarification && previousContext) {
      userMessage = `Original input: "${input}"
Previous context needed: ${previousContext}
User's clarification: "${clarification}"

Now extract the tasks based on this additional context.`;
    } else if (epicAnswers && Object.keys(epicAnswers).length > 0) {
      userMessage = `Original goal: "${input}"
User provided these details:
${Object.entries(epicAnswers).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Now provide epic details with suggestedTargetDays calculated from their answers. Set needsClarification to false.`;
    }

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
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    let classification: IntentClassification;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      classification = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Default to quest if parsing fails
      classification = {
        type: 'quest',
        confidence: 0.5,
        reasoning: 'Could not parse AI response, defaulting to quest',
      };
    }

    // Validate the classification
    if (!['quest', 'epic', 'habit', 'brain-dump'].includes(classification.type)) {
      classification.type = 'quest';
    }
    if (typeof classification.confidence !== 'number') {
      classification.confidence = 0.5;
    }

    // For brain-dump, ensure arrays exist
    if (classification.type === 'brain-dump') {
      classification.extractedTasks = classification.extractedTasks || [];
      classification.suggestedTasks = classification.suggestedTasks || [];
      classification.needsClarification = classification.needsClarification ?? false;
    }

    // For epic, ensure clarification fields exist - always enable clarification for epics
    if (classification.type === 'epic') {
      classification.needsClarification = true; // Always show clarification for epics
      classification.epicClarifyingQuestions = classification.epicClarifyingQuestions || [];
    }

    console.log('Classified intent:', { 
      input, 
      clarification: !!clarification, 
      epicAnswers: !!epicAnswers,
      type: classification.type,
      needsClarification: classification.needsClarification,
      epicQuestionsCount: classification.epicClarifyingQuestions?.length
    });

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('classify-task-intent error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
