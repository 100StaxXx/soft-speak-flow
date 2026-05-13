import {
  coerceCompanionVisualAnchors,
  type CompanionVisualAnchors,
  type VisualIdentityProfile,
} from "./companionLineage.ts";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

const buildAnchorInstructions = ({
  profile,
  level,
  priorGenerationMetadata,
}: {
  profile: VisualIdentityProfile;
  level: number;
  priorGenerationMetadata?: unknown;
}): string => {
  const priorNotes = priorGenerationMetadata &&
      typeof priorGenerationMetadata === "object" &&
      !Array.isArray(priorGenerationMetadata)
    ? priorGenerationMetadata as Record<string, unknown>
    : null;
  const sourceType = typeof priorNotes?.sourceType === "string"
    ? priorNotes.sourceType
    : null;
  const notes = typeof priorNotes?.notes === "string" ? priorNotes.notes : null;

  return [
    "Analyze this fantasy companion portrait into structured visual anchors for a future evolution prompt.",
    `Current level: ${level}`,
    `Spirit animal lineage: ${profile.spiritAnimal}`,
    `Core element: ${profile.coreElement}`,
    `Favorite color anchor: ${profile.favoriteColor}`,
    `Body plan: ${profile.bodyPlan}`,
    "",
    "Extract only visible or strongly implied visual identity details.",
    "Focus on what should make the next stage feel like the same individual after a major evolution.",
    "Use short concrete phrases, not paragraphs.",
    "Separate traits that must be preserved from traits that are safe to evolve or intensify.",
    "",
    ...(sourceType ? [`Prior generation source: ${sourceType}`] : []),
    ...(notes ? [`Prior generation notes: ${notes}`] : []),
  ].join("\n");
};

export const extractCompanionVisualAnchors = async ({
  guardedFetch,
  openAIApiKey,
  profile,
  imageUrl,
  level,
  priorGenerationMetadata,
}: {
  guardedFetch: typeof fetch;
  openAIApiKey: string;
  profile: VisualIdentityProfile;
  imageUrl: string;
  level: number;
  priorGenerationMetadata?: unknown;
}): Promise<CompanionVisualAnchors | null> => {
  const anchorTool = {
    type: "function",
    function: {
      name: "extract_companion_visual_anchors",
      description:
        "Extract structured visual anchors from a fantasy companion portrait for lineage-consistent evolution.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          silhouette: { type: "array", items: { type: "string" } },
          anatomy: { type: "array", items: { type: "string" } },
          face: { type: "array", items: { type: "string" } },
          markings: { type: "array", items: { type: "string" } },
          palette: { type: "array", items: { type: "string" } },
          elementalEffects: { type: "array", items: { type: "string" } },
          poseFraming: { type: "array", items: { type: "string" } },
          artStyle: { type: "array", items: { type: "string" } },
          signatureFeatures: { type: "array", items: { type: "string" } },
          mustPreserve: { type: "array", items: { type: "string" } },
          safeToEvolve: { type: "array", items: { type: "string" } },
        },
        required: [
          "summary",
          "silhouette",
          "anatomy",
          "face",
          "markings",
          "palette",
          "elementalEffects",
          "poseFraming",
          "artStyle",
          "signatureFeatures",
          "mustPreserve",
          "safeToEvolve",
        ],
        additionalProperties: false,
      },
    },
  };

  try {
    const response = await guardedFetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_COMPANION_VISION_MODEL") ??
          Deno.env.get("OPENAI_TEXT_MODEL") ??
          "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: buildAnchorInstructions({
                  profile,
                  level,
                  priorGenerationMetadata,
                }),
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        tools: [anchorTool],
        tool_choice: {
          type: "function",
          function: {
            name: "extract_companion_visual_anchors",
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn(
        "Companion visual anchor extraction failed",
        await response.text(),
      );
      return null;
    }

    const payload = await response.json() as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{
            function?: {
              arguments?: string;
            };
          }>;
        };
      }>;
    };
    const rawArguments = payload.choices?.[0]?.message?.tool_calls?.[0]
      ?.function?.arguments;
    if (typeof rawArguments !== "string") {
      return null;
    }

    const parsed = JSON.parse(rawArguments) as Record<string, unknown>;
    return coerceCompanionVisualAnchors(
      {
        ...parsed,
        schemaVersion: 1,
        level,
        sourceImageUrl: imageUrl,
        capturedAt: new Date().toISOString(),
      },
      level,
      imageUrl,
    );
  } catch (error) {
    console.warn("Companion visual anchor extraction threw", error);
    return null;
  }
};
