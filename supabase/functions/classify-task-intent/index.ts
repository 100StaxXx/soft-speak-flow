import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input, clarification, previousContext, epicAnswers } = await req.json();

    if (!input || typeof input !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Input text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an intent classifier for a productivity app. Analyze the user's input and classify it as one of:

1. **quest** - A single, specific task that can be completed in one sitting or one day
   - Examples: "buy groceries", "call mom", "finish report", "clean room"
   
2. **epic** - A long-term goal requiring multiple steps, habits, or milestones over days/weeks/months
   - Examples: "get my real estate license", "run a marathon", "learn Spanish", "lose 20 pounds", "prepare for the bar exam", "study for MCAT"
   - Key indicators: timeframes like "by June", "in 3 months", certifications, exams, learning goals, fitness transformations
   - **COMPLEX EPICS that need clarification**: exams (bar, CPA, MCAT, etc.), certifications, multi-subject learning, fitness goals with specific targets
   
3. **habit** - A recurring action to be done regularly
   - Examples: "meditate daily", "drink 8 glasses of water", "read for 30 minutes every day"
   - Key indicators: "every", "daily", "weekly", frequency words

4. **brain-dump** - Multiple tasks mentioned conversationally, often with context
   - Examples: "Tomorrow is Sunday, I need to vacuum, do dishes, laundry, and take out trash"
   - Key indicators: lists of activities, commas/and separating tasks, day/context mentioned, 2+ distinct tasks

**FOR EPIC TYPE - CLARIFICATION LOGIC:**

When detecting an epic, decide if you need clarifying questions:

ASK CLARIFICATION IF the goal is:
- An exam/certification (bar exam, CPA, MCAT, real estate license, etc.) - Ask about subjects, exam date, study hours
- A fitness goal (run marathon, lose weight) - Ask about current level, target date, available time
- Learning a skill (learn Spanish, learn coding) - Ask about current level, target proficiency, study time
- A major project (write a book, launch business) - Ask about scope, deadline, available hours

DO NOT ASK IF:
- User already provided specific details ("study 2 hours daily for bar exam until July")
- Goal is simple enough to break down without context ("read more books")

When asking epic clarification, generate 2-4 questions appropriate to the goal type:
- Use "date" type for target dates/deadlines
- Use "number" type for hours per day, days per week
- Use "select" type for predefined options (subjects, current level, etc.)
- Use "text" type for open-ended answers

**EPIC CLARIFICATION EXAMPLES:**

For "prepare for the bar exam":
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "exam_preparation",
  "epicClarifyingQuestions": [
    { "id": "subjects", "question": "Which subjects do you need to focus on?", "type": "select", "options": ["All MBE subjects", "Essays & PT", "State-specific", "Full review"], "required": true },
    { "id": "exam_date", "question": "When is your exam?", "type": "date", "placeholder": "Select exam date", "required": true },
    { "id": "hours_per_day", "question": "How many hours per day can you study?", "type": "number", "placeholder": "e.g., 4", "required": true },
    { "id": "current_status", "question": "Where are you in your preparation?", "type": "select", "options": ["Just starting", "Some progress made", "In review phase", "Final cramming"], "required": false }
  ]
}

For "run a marathon":
{
  "type": "epic",
  "needsClarification": true,
  "epicContext": "fitness_goal",
  "epicClarifyingQuestions": [
    { "id": "target_date", "question": "When is your target marathon?", "type": "date", "placeholder": "Select race date", "required": true },
    { "id": "current_level", "question": "What's your current running level?", "type": "select", "options": ["Beginner (< 5 miles)", "Intermediate (5-10 miles)", "Advanced (10+ miles)"], "required": true },
    { "id": "days_per_week", "question": "How many days per week can you train?", "type": "number", "placeholder": "e.g., 4", "required": true }
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
  "epicClarifyingQuestions": [{ "id": string, "question": string, "type": string, "options": array, "placeholder": string, "required": boolean }],
  "epicContext": "exam_preparation|fitness_goal|learning|project|other",
  "epicDetails": { "subjects": array, "targetDate": string, "hoursPerDay": number, "currentStatus": string, "suggestedTargetDays": number }
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

    // For epic, ensure clarification fields exist
    if (classification.type === 'epic') {
      classification.needsClarification = classification.needsClarification ?? false;
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
