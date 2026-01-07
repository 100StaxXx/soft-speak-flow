import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HardCommitment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface GeneratedTask {
  title: string;
  scheduledTime: string;
  estimatedDuration: number;
  priority: "low" | "medium" | "high";
  category?: string;
  blockType?: string;
  isAnchor?: boolean;
  epicId?: string;
  rationale?: string;
}

interface ContactNeedingAttention {
  id: string;
  name: string;
  reason: "overdue" | "going_cold";
  daysSinceContact?: number;
  reminderReason?: string | null;
}

interface RequestBody {
  planDate: string;
  energyLevel: "low" | "medium" | "high";
  flexTimeHours: number;
  hardCommitments: HardCommitment[];
  protectedHabitIds: string[];
  prioritizedEpicIds: string[];
  dayShape: "front_load" | "spread" | "back_load" | "auto";
  contactsNeedingAttention?: ContactNeedingAttention[];
  adjustmentRequest?: string;
  previousPlan?: {
    tasks: GeneratedTask[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const {
      planDate,
      energyLevel,
      flexTimeHours,
      hardCommitments,
      protectedHabitIds,
      prioritizedEpicIds,
      dayShape,
      contactsNeedingAttention,
      adjustmentRequest,
      previousPlan,
    } = body;

    // Fetch protected habits
    let protectedHabits: any[] = [];
    if (protectedHabitIds.length > 0) {
      const { data } = await supabaseClient
        .from("habits")
        .select("id, title, preferred_time, category, current_streak")
        .in("id", protectedHabitIds);
      protectedHabits = data || [];
    }

    // Fetch prioritized epics and their milestones
    let epicContext: any[] = [];
    if (prioritizedEpicIds.length > 0) {
      const { data: epics } = await supabaseClient
        .from("epics")
        .select("id, title, description")
        .in("id", prioritizedEpicIds);

      const { data: milestones } = await supabaseClient
        .from("epic_milestones")
        .select("id, title, epic_id, milestone_percent")
        .in("epic_id", prioritizedEpicIds)
        .is("completed_at", null)
        .order("milestone_percent", { ascending: true })
        .limit(5);

      epicContext = (epics || []).map((e) => ({
        ...e,
        nextMilestones: (milestones || []).filter((m) => m.epic_id === e.id).slice(0, 2),
      }));
    }

    // Fetch existing tasks for context
    const { data: existingTasks } = await supabaseClient
      .from("daily_tasks")
      .select("id, task_text, scheduled_time, estimated_duration, priority")
      .eq("user_id", user.id)
      .eq("task_date", planDate)
      .eq("completed", false);

    // Fetch user learning data
    const { data: aiLearning } = await supabaseClient
      .from("user_ai_learning")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Build the AI prompt
    const systemPrompt = buildSystemPrompt({
      energyLevel,
      flexTimeHours,
      dayShape,
      protectedHabits,
      epicContext,
      existingTasks: existingTasks || [],
      hardCommitments,
      contactsNeedingAttention: contactsNeedingAttention || [],
      aiLearning,
      adjustmentRequest,
      previousPlan,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserPrompt(body, previousPlan, adjustmentRequest) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_daily_plan",
              description: "Generate a personalized daily plan with tasks",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        scheduledTime: { type: "string", description: "Time in HH:MM format (24h)" },
                        estimatedDuration: { type: "number", description: "Duration in minutes" },
                        priority: { type: "string", enum: ["low", "medium", "high"] },
                        category: { type: "string" },
                        blockType: { type: "string", enum: ["focus", "admin", "health", "social", "quick_win", "relationship"] },
                        isAnchor: { type: "boolean" },
                        epicId: { type: "string" },
                        contactId: { type: "string", description: "ID of linked contact if this is a relationship task" },
                        rationale: { type: "string" },
                      },
                      required: ["title", "scheduledTime", "estimatedDuration", "priority"],
                    },
                  },
                  insights: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-3 brief insights about the plan",
                  },
                  dayShape: {
                    type: "string",
                    enum: ["front_load", "spread", "back_load"],
                  },
                },
                required: ["tasks", "insights", "dayShape"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_daily_plan" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No plan generated");
    }

    const plan = JSON.parse(toolCall.function.arguments);

    // Calculate total hours and balance score
    const totalMinutes = plan.tasks.reduce((sum: number, t: GeneratedTask) => sum + (t.estimatedDuration || 0), 0);
    const totalHours = totalMinutes / 60;

    // Calculate balance score based on task distribution and variety
    const balanceScore = calculateBalanceScore(plan.tasks, dayShape);

    return new Response(
      JSON.stringify({
        tasks: plan.tasks,
        insights: plan.insights || [],
        totalHours,
        balanceScore,
        dayShape: plan.dayShape || dayShape,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-smart-daily-plan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSystemPrompt(context: {
  energyLevel: string;
  flexTimeHours: number;
  dayShape: string;
  protectedHabits: any[];
  epicContext: any[];
  existingTasks: any[];
  hardCommitments: HardCommitment[];
  contactsNeedingAttention: ContactNeedingAttention[];
  aiLearning: any;
  adjustmentRequest?: string;
  previousPlan?: any;
}): string {
  const {
    energyLevel,
    flexTimeHours,
    dayShape,
    protectedHabits,
    epicContext,
    existingTasks,
    hardCommitments,
    contactsNeedingAttention,
    aiLearning,
  } = context;

  let prompt = `You are a productivity expert creating a personalized daily plan. Generate practical, actionable tasks.

## User Context
- Energy Level: ${energyLevel}
- Available Flex Time: ${flexTimeHours} hours
- Day Shape Preference: ${dayShape === "auto" ? "You decide based on context" : dayShape}

## Hard Rules
1. Never schedule during hard commitments
2. Account for 15min buffer between major tasks
3. Scale difficulty based on energy level
4. Prioritize protected habits and epic milestones
5. Include a mix of task types (focus, admin, health, quick_wins)

## Energy Scaling
- Low energy: Max 4-5 simpler tasks, longer breaks, no heavy focus blocks
- Medium energy: 6-8 balanced tasks, standard breaks
- High energy: 8-10 tasks including challenging work, can front-load demanding tasks

## Day Shape Guidelines
- front_load: Heavy tasks 8AM-12PM, light tasks afternoon
- spread: Even distribution with energy dip 2-3PM
- back_load: Light morning, heavy tasks 2PM-6PM
`;

  if (protectedHabits.length > 0) {
    prompt += `\n## Protected Habits (MUST include, preserve streaks!)
${protectedHabits.map((h) => `- ${h.title} (${h.current_streak || 0} day streak${h.preferred_time ? `, usually at ${h.preferred_time}` : ""})`).join("\n")}
`;
  }

  if (contactsNeedingAttention.length > 0) {
    prompt += `\n## Contacts Needing Attention (Create relationship tasks with contactId set!)
${contactsNeedingAttention.map((c) => `- ${c.name} (ID: ${c.id}) - ${c.reason === "overdue" ? `Follow-up overdue${c.reminderReason ? `: ${c.reminderReason}` : ""}` : `${c.daysSinceContact} days since last contact`}`).join("\n")}

For each contact, create a task like "Follow up with [Name]" or "Check in with [Name]" and set:
- blockType: "relationship"
- contactId: the contact's ID
- priority: "high" for overdue, "medium" for going cold
`;
  }

  if (epicContext.length > 0) {
    prompt += `\n## Prioritized Epics
${epicContext.map((e) => `- ${e.title}: ${e.nextMilestones.map((m: any) => m.title).join(", ")}`).join("\n")}
`;
  }

  if (existingTasks.length > 0) {
    prompt += `\n## Existing Tasks (work around these)
${existingTasks.map((t) => `- ${t.task_text} at ${t.scheduled_time || "unscheduled"}`).join("\n")}
`;
  }

  if (hardCommitments.length > 0) {
    prompt += `\n## Hard Commitments (DO NOT schedule over these)
${hardCommitments.map((c) => `- ${c.title}: ${c.startTime} - ${c.endTime}`).join("\n")}
`;
  }

  if (aiLearning) {
    prompt += `\n## User Patterns (learned from behavior)`;
    
    // Peak productivity times (stored directly on aiLearning)
    if (aiLearning.peak_productivity_times?.length > 0) {
      prompt += `\n- Peak productivity hours: ${aiLearning.peak_productivity_times.join(", ")}:00`;
    }
    
    // Scheduling patterns (stored in scheduling_patterns column)
    const patterns = aiLearning.scheduling_patterns || {};
    if (patterns.commonStartTimes?.length > 0) {
      prompt += `\n- Preferred start times: ${patterns.commonStartTimes.map((h: number) => `${h}:00`).join(", ")}`;
    }
    if (patterns.avgCompletionHour?.hard) {
      prompt += `\n- Hard tasks usually completed around: ${Math.round(patterns.avgCompletionHour.hard)}:00`;
    }
    if (patterns.lunchBreakPattern?.detected) {
      prompt += `\n- Takes lunch break: ${patterns.lunchBreakPattern.start}:00-${patterns.lunchBreakPattern.end}:00`;
    }
    if (patterns.morningProductivity > 0.6) {
      prompt += `\n- Strong morning productivity`;
    } else if (patterns.eveningProductivity > 0.4) {
      prompt += `\n- Active in evenings`;
    }
    
    // Work style (stored directly on aiLearning)
    if (aiLearning.inferred_work_style && aiLearning.work_style_confidence > 50) {
      prompt += `\n- Work style: ${aiLearning.inferred_work_style} (${aiLearning.work_style_confidence}% confidence)`;
    }
    
    // Day-of-week patterns for today
    const today = new Date().getDay();
    const dayPatterns = aiLearning.day_of_week_patterns?.[today] || {};
    if (dayPatterns.peakHours?.length > 0) {
      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today];
      prompt += `\n- On ${dayName}s, most productive at: ${dayPatterns.peakHours.slice(0, 3).join(", ")}:00`;
    }
    if (dayPatterns.avgTaskCount) {
      prompt += `\n- Typical task count on this day: ${Math.round(dayPatterns.avgTaskCount)}`;
    }
    
    // Successful categories from preference weights
    const catWeights = aiLearning.preference_weights?.categories || {};
    const topCategories = Object.entries(catWeights)
      .filter(([, w]) => (w as number) > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([cat]) => cat);
    if (topCategories.length > 0) {
      prompt += `\n- High completion categories: ${topCategories.join(", ")}`;
    }
    
    // Learned recurring tasks (what the user often creates)
    const successfulPatterns = aiLearning.successful_patterns || {};
    if (successfulPatterns.recurring_tasks?.length > 0) {
      prompt += `\n\n## Recurring Task Templates (user often creates these)
${successfulPatterns.recurring_tasks.slice(0, 8).map((t: string) => `- ${t}`).join('\n')}

Consider including similar tasks when they fit the day's energy and focus.`;
    }
    
    // Most successful task type combos
    if (successfulPatterns.category_difficulty) {
      const topCombos = Object.entries(successfulPatterns.category_difficulty)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3);
      if (topCombos.length > 0) {
        prompt += `\n\n## Most Successful Task Types
${topCombos.map(([combo, count]) => `- ${combo.replace('_', ' ')}: ${count} completed`).join('\n')}`;
      }
    }
    
    // AI-accepted tasks from previous plans (what the user kept)
    if (successfulPatterns.ai_accepted?.length > 0) {
      prompt += `\n\n## Previously Accepted AI Tasks
The user has saved plans containing these tasks before:
${successfulPatterns.ai_accepted.slice(0, 8).map((t: string) => `- ${t}`).join('\n')}

These represent task types the user found valuable from previous AI suggestions.`;
    }
    
    // Successful energy + day shape configurations
    if (successfulPatterns.plan_types) {
      const topPlanTypes = Object.entries(successfulPatterns.plan_types)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 2);
      if (topPlanTypes.length > 0) {
        prompt += `\n\n## Preferred Plan Configurations
${topPlanTypes.map(([combo, count]) => `- ${combo.replace('_', ' ')}: used ${count} time(s)`).join('\n')}`;
      }
    }
  }

  return prompt;
}

function buildUserPrompt(
  body: RequestBody,
  previousPlan?: any,
  adjustmentRequest?: string
): string {
  if (adjustmentRequest && previousPlan) {
    return `The user wants to adjust their plan. Here's the current plan:

${JSON.stringify(previousPlan.tasks, null, 2)}

User's adjustment request: "${adjustmentRequest}"

Please regenerate the plan incorporating this feedback while maintaining the core structure.`;
  }

  let prompt = `Generate a daily plan for ${body.planDate} with these parameters:
- Energy: ${body.energyLevel}
- Flex time: ${body.flexTimeHours} hours
- Day shape: ${body.dayShape}
- Protected habits: ${body.protectedHabitIds.length} habits
- Prioritized epics: ${body.prioritizedEpicIds.length} epics`;

  // Include initial custom requests if provided (before plan generation)
  if (adjustmentRequest && !previousPlan) {
    prompt += `

## User's Special Requests
The user has specifically asked for: "${adjustmentRequest}"

Make sure to incorporate these requests into the generated plan.`;
  }

  prompt += `

Create a balanced, achievable plan that respects the user's energy and available time.`;

  return prompt;
}

function calculateBalanceScore(tasks: GeneratedTask[], dayShape: string): number {
  if (!tasks || tasks.length === 0) return 0;

  let score = 70; // Base score

  // Check for variety in block types
  const blockTypes = new Set(tasks.map((t) => t.blockType).filter(Boolean));
  if (blockTypes.size >= 3) score += 10;
  if (blockTypes.size >= 4) score += 5;

  // Check for priority distribution
  const priorities = tasks.map((t) => t.priority);
  const hasHighPriority = priorities.some((p) => p === "high");
  const hasMediumPriority = priorities.some((p) => p === "medium");
  const hasLowPriority = priorities.some((p) => p === "low");
  if (hasHighPriority && hasMediumPriority && hasLowPriority) score += 10;

  // Check for reasonable time gaps
  const times = tasks
    .map((t) => {
      const [h, m] = t.scheduledTime.split(":").map(Number);
      return h * 60 + m;
    })
    .sort((a, b) => a - b);

  let hasReasonableGaps = true;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap < 15 || gap > 180) hasReasonableGaps = false;
  }
  if (hasReasonableGaps) score += 5;

  return Math.min(100, Math.max(0, score));
}
