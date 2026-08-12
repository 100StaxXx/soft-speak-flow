import type { VisualIdentityProfile } from "./companionLineage.ts";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

export type CompanionImageJudgeMode = "bootstrap" | "egg" | "evolution" | "launcher";

export interface CompanionImageJudgeScores {
  continuity: number;
  difference: number;
  anatomy: number;
  stageMaturity: number;
  centering: number;
  backgroundCutout: number;
  overall: number;
  subjectCenterX: number | null;
  subjectCenterY: number | null;
  notes: string;
}

const clampScore = (value: number): number => Math.max(0, Math.min(10, value));
const clampNormalizedCenter = (value: number | null): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;

const buildJudgeInstructions = ({
  mode,
  profile,
  previousLevel,
  nextLevel,
}: {
  mode: CompanionImageJudgeMode;
  profile: VisualIdentityProfile;
  previousLevel?: number | null;
  nextLevel?: number | null;
}): string => {
  const boundaryContext =
    typeof previousLevel === "number" && typeof nextLevel === "number"
      ? `Evaluate the jump from level ${previousLevel} to level ${nextLevel}.`
      : "Evaluate the companion image on its own merits.";

  switch (mode) {
    case "bootstrap":
      return [
        "You are judging a starter-form fantasy companion portrait for lineage clarity and product quality.",
        boundaryContext,
        `Spirit animal lineage: ${profile.spiritAnimal}`,
        `Core element: ${profile.coreElement}`,
        `Favorite color anchor: ${profile.favoriteColor}`,
        "The candidate image is the generated stage-1 hatchling.",
        "StageMaturity means: 10 only when the candidate is unmistakably an infant or very young juvenile for its species; 0-4 when it has adult markers such as a mane, antlers, adult flight plumage, mature musculature, or fully mature proportions.",
        "If a reference image is present, it may depict the mature identity seed. Preserve its species, face, markings, palette, and illustration language while judging the candidate itself as an infant form.",
        "Continuity means: it matches the family bible and reads as a strong starter form for this lineage.",
        "Difference should be 10 for bootstrap images because there is no prior portrait to compare against.",
        "Anatomy means: no extra limbs, no broken face logic, and no obvious malformed body plan.",
        "Centering means: the subject is well framed and not awkwardly cropped.",
        "BackgroundCutout means: 10 for a clean companion-only transparent/empty cutout; 0-4 for any visible sky, clouds, landscape, room, floor, frame, card, rectangular backdrop, or scenic environment.",
      ].join("\n");
    case "egg":
      return [
        "You are judging a magical egg portrait derived from a hidden hatchling.",
        boundaryContext,
        `Spirit animal lineage: ${profile.spiritAnimal}`,
        `Core element: ${profile.coreElement}`,
        `Favorite color anchor: ${profile.favoriteColor}`,
        "The first image is the hidden hatchling reference. The second image is the candidate egg.",
        "Continuity means: the egg clearly hints at the same lineage through shape language, markings, aura, and palette.",
        "Difference should be 10 when the candidate is a convincing egg with no obvious full-body reveal.",
        "Anatomy means: the egg is coherent, readable, and not malformed.",
        "StageMaturity should be 10 for a convincing unrevealed egg.",
        "Centering means: the egg is cleanly framed and visually centered.",
        "BackgroundCutout means: 10 for a clean egg-only transparent/empty cutout; 0-4 for any visible sky, clouds, landscape, room, floor, frame, card, rectangular backdrop, or scenic environment.",
      ].join("\n");
    case "launcher":
      return [
        "You are judging a dedicated mobile launcher cutout derived from an existing companion portrait.",
        boundaryContext,
        `Spirit animal lineage: ${profile.spiritAnimal}`,
        `Core element: ${profile.coreElement}`,
        `Favorite color anchor: ${profile.favoriteColor}`,
        "The first image is the current companion reference. The second image is the candidate launcher cutout.",
        "Continuity means: it is clearly the same companion identity, species, silhouette logic, palette, markings, and maturity.",
        "Difference should be 10 when the only meaningful change is presentation/framing, not a redesign or evolution.",
        "Anatomy means: no extra limbs, no broken face logic, and no obvious malformed body plan.",
        "StageMaturity means: the candidate matches the same maturity as the launcher reference.",
        "Centering means: the subject is well framed, full body, and not awkwardly cropped.",
        "BackgroundCutout means: 10 for a clean companion-only transparent/empty cutout; 0-4 for any visible sky, clouds, landscape, room, floor, frame, card, rectangular backdrop, or scenic environment.",
      ].join("\n");
    case "evolution":
    default:
      return [
        "You are judging a major fantasy creature evolution render.",
        boundaryContext,
        `Spirit animal lineage: ${profile.spiritAnimal}`,
        `Core element: ${profile.coreElement}`,
        `Favorite color anchor: ${profile.favoriteColor}`,
        "The first image is the previous boundary portrait. The second image is the candidate evolution.",
        "Continuity means: same creature line, same facial and silhouette logic, same elemental identity.",
        "Difference means: clearly more evolved at thumbnail size, with meaningful silhouette or posture change and stronger elemental expression.",
        "Anatomy means: no malformed limbs, duplicate heads, or broken body logic.",
        "StageMaturity means: the candidate is appropriately more mature for the requested next boundary without jumping to an unrelated age or species.",
        "Centering means: the subject is framed well and not awkwardly cropped.",
        "BackgroundCutout means: 10 for a clean companion-only transparent/empty cutout; 0-4 for any visible sky, clouds, landscape, room, floor, frame, card, rectangular backdrop, or scenic environment.",
      ].join("\n");
  }
};

export const judgeCompanionImage = async ({
  guardedFetch,
  openAIApiKey,
  profile,
  mode,
  candidateImageUrl,
  referenceImageUrl,
  previousLevel,
  nextLevel,
}: {
  guardedFetch: typeof fetch;
  openAIApiKey: string;
  profile: VisualIdentityProfile;
  mode: CompanionImageJudgeMode;
  candidateImageUrl: string;
  referenceImageUrl?: string | null;
  previousLevel?: number | null;
  nextLevel?: number | null;
}): Promise<CompanionImageJudgeScores | null> => {
  const judgeTool = {
    type: "function",
    function: {
      name: "score_companion_image",
      description: "Score a fantasy companion image for continuity, difference, anatomy, centering, and overall quality.",
      parameters: {
        type: "object",
        properties: {
          continuity: { type: "number" },
          difference: { type: "number" },
          anatomy: { type: "number" },
          stageMaturity: { type: "number" },
          centering: { type: "number" },
          backgroundCutout: { type: "number" },
          overall: { type: "number" },
          subjectCenterX: { type: "number" },
          subjectCenterY: { type: "number" },
          notes: { type: "string" },
        },
        required: ["continuity", "difference", "anatomy", "stageMaturity", "centering", "backgroundCutout", "overall", "subjectCenterX", "subjectCenterY", "notes"],
        additionalProperties: false,
      },
    },
  };

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: buildJudgeInstructions({
        mode,
        profile,
        previousLevel,
        nextLevel,
      }),
    },
  ];

  if (referenceImageUrl) {
    content.push({
      type: "image_url",
      image_url: { url: referenceImageUrl },
    });
  }

  content.push({
    type: "image_url",
    image_url: { url: candidateImageUrl },
  });

  try {
    const response = await guardedFetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_COMPANION_JUDGE_MODEL")
          ?? Deno.env.get("OPENAI_TEXT_MODEL")
          ?? "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content,
          },
        ],
        tools: [judgeTool],
        tool_choice: {
          type: "function",
          function: {
            name: "score_companion_image",
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn("Companion image judge request failed", await response.text());
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

    const rawArguments = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (typeof rawArguments !== "string") {
      return null;
    }

    const parsed = JSON.parse(rawArguments) as Record<string, unknown>;
    return {
      continuity: clampScore(typeof parsed.continuity === "number" ? parsed.continuity : 0),
      difference: clampScore(typeof parsed.difference === "number" ? parsed.difference : 0),
      anatomy: clampScore(typeof parsed.anatomy === "number" ? parsed.anatomy : 0),
      stageMaturity: clampScore(typeof parsed.stageMaturity === "number" ? parsed.stageMaturity : 0),
      centering: clampScore(typeof parsed.centering === "number" ? parsed.centering : 0),
      backgroundCutout: clampScore(typeof parsed.backgroundCutout === "number" ? parsed.backgroundCutout : 0),
      overall: clampScore(typeof parsed.overall === "number" ? parsed.overall : 0),
      subjectCenterX: clampNormalizedCenter(
        typeof parsed.subjectCenterX === "number" ? parsed.subjectCenterX : null,
      ),
      subjectCenterY: clampNormalizedCenter(
        typeof parsed.subjectCenterY === "number" ? parsed.subjectCenterY : null,
      ),
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch (error) {
    console.warn("Companion image judge threw", error);
    return null;
  }
};
