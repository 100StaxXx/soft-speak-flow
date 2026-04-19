export interface DecomposedTaskSuggestion {
  title: string;
  durationMinutes: number;
}

interface BuildTaskBreakdownParams {
  fetchImpl: typeof fetch;
  openAIApiKey: string;
  taskTitle: string;
  taskDescription?: string | null;
  model?: string;
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const getDefaultTaskDecomposeModel = (): string => {
  try {
    return Deno.env.get("OPENAI_TASK_DECOMPOSE_MODEL") ??
      "google/gemini-2.5-flash";
  } catch {
    return "google/gemini-2.5-flash";
  }
};

const normalizeDurationMinutes = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 30;

  const allowed = [15, 30, 45, 60, 90, 120];
  const rounded = Math.max(15, Math.min(120, Math.round(value / 15) * 15));
  return allowed.find((candidate) => candidate === rounded) ?? 30;
};

const normalizeTaskSuggestion = (
  value: unknown,
): DecomposedTaskSuggestion | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const title = typeof (value as { title?: unknown }).title === "string"
    ? (value as { title: string }).title.trim()
    : "";
  if (!title) return null;

  return {
    title,
    durationMinutes: normalizeDurationMinutes(
      (value as { durationMinutes?: unknown }).durationMinutes,
    ),
  };
};

export async function buildTaskBreakdownSuggestions(
  params: BuildTaskBreakdownParams,
): Promise<DecomposedTaskSuggestion[]> {
  const systemPrompt = `You are a task breakdown expert. Given a goal or large task, break it into 3-7 actionable, specific subtasks.

Rules:
- Each subtask should be completable in one session (15 min - 2 hours)
- Start each subtask with an action verb (Research, Draft, Create, Contact, Review, Schedule, etc.)
- Order by logical sequence (what needs to happen first)
- Be specific and concrete, not vague
- Include estimated duration in minutes (15, 30, 45, 60, 90, 120)

You MUST use the decompose_task function to return your response.`;

  const userPrompt = params.taskDescription?.trim()
    ? `Break down this goal into actionable subtasks:\n\nGoal: "${params.taskTitle}"\nContext: "${params.taskDescription.trim()}"`
    : `Break down this goal into actionable subtasks:\n\nGoal: "${params.taskTitle}"`;

  const response = await params.fetchImpl(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model ?? getDefaultTaskDecomposeModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "decompose_task",
            description: "Return 3-7 actionable subtasks for the given goal.",
            parameters: {
              type: "object",
              properties: {
                subtasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "The subtask title, starting with an action verb",
                      },
                      durationMinutes: {
                        type: "number",
                        description: "Estimated duration in minutes (15, 30, 45, 60, 90, or 120)",
                      },
                    },
                    required: ["title", "durationMinutes"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["subtasks"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "decompose_task" },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Task decomposition failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          function?: {
            name?: string;
            arguments?: string;
          };
        }>;
      };
    }>;
  };

  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments || toolCall.function.name !== "decompose_task") {
    throw new Error("Invalid task decomposition response format");
  }

  const parsed = JSON.parse(toolCall.function.arguments) as {
    subtasks?: unknown[];
  };

  return (parsed.subtasks ?? [])
    .map(normalizeTaskSuggestion)
    .filter((suggestion): suggestion is DecomposedTaskSuggestion => Boolean(suggestion));
}
