export type CompanionChatSurface = "companion" | "journeys";
type CompanionChatMessageRole = "assistant" | "developer" | "system" | "user";
type EnvGetter = (name: string) => string | null | undefined;

export const DEFAULT_COMPANION_CHAT_MODEL = "gpt-5.5";

export const resolveCompanionChatModel = (env: EnvGetter): string =>
  env("OPENAI_COMPANION_CHAT_MODEL") ?? DEFAULT_COMPANION_CHAT_MODEL;

export interface CompanionChatCompletionBody {
  model: string;
  messages: Array<{ role: CompanionChatMessageRole; content: string }>;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  reasoning_effort?: "none";
}

const normalizeChatModelName = (model: string) => model.trim().toLowerCase();

const isReasoningChatModel = (model: string) =>
  /^(gpt-5|o[1-9])/.test(normalizeChatModelName(model));

const supportsNoReasoningEffort = (model: string) =>
  /^gpt-5\.5(?:-\d{4}-\d{2}-\d{2})?$/.test(normalizeChatModelName(model));

export function buildCompanionChatCompletionBody(params: {
  model: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: "assistant" | "user"; content: string }>;
  message: string;
  surface: CompanionChatSurface;
}): CompanionChatCompletionBody {
  const usesReasoningParams = isReasoningChatModel(params.model);
  const instructionRole: CompanionChatMessageRole = usesReasoningParams
    ? "developer"
    : "system";

  return {
    model: params.model,
    ...(usesReasoningParams
      ? {
        ...(supportsNoReasoningEffort(params.model)
          ? { reasoning_effort: "none" as const }
          : {}),
        max_completion_tokens: 260,
      }
      : {
        temperature: params.surface === "journeys" ? 0.35 : 0.9,
        max_tokens: 260,
      }),
    messages: [
      { role: instructionRole, content: params.systemPrompt },
      ...params.conversationHistory.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      { role: "user" as const, content: params.message },
    ],
  };
}
