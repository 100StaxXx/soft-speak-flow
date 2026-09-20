import { editCompanionImage } from "./openaiCompanionImageClient.ts";

export const HATCH_SCENE_VERSION = "hatch-scene-v1";
export const HATCH_VIDEO_CONTINUITY =
  "BACKGROUND CONTINUITY: The egg and hatchling occupy the same uninterrupted elemental environment. Keep the opening landscape, ground, horizon, lighting and framing visible throughout every frame, including the final hold. Only the egg transforms into the supplied hatchling. Never fade the scenery to black, a blank studio, or a transparent cutout. The supplied end image includes the scene; preserve that entire scene.";

/** A video-only endpoint: never replace the canonical transparent companion asset. */
export async function prepareHatchSceneEndpoint(
  input: {
    guardedFetch: typeof fetch;
    openAIApiKey: string;
    model: string;
    size: string;
    userId: string;
    startImageUrl: string;
    companionImageUrl: string;
  },
  render = editCompanionImage,
) {
  return await render({
    guardedFetch: input.guardedFetch,
    openAIApiKey: input.openAIApiKey,
    model: input.model,
    size: input.size,
    userId: input.userId,
    quality: "high",
    background: "opaque",
    outputFormat: "png",
    referenceImages: [
      { imageUrl: input.startImageUrl },
      { imageUrl: input.companionImageUrl },
    ],
    prompt: [
      `COSMIQ ${HATCH_SCENE_VERSION}: prepare the ending frame of an egg hatch.`,
      "Reference 1 is the opening egg scene. Preserve its existing elemental background, landscape, ground, perspective, lighting and camera framing; do not introduce a different habitat.",
      "Reference 2 is the exact approved hatchling. Replace only the egg in reference 1 with this hatchling, naturally grounded in the same scene.",
      "Preserve reference 2's identity, species, color, markings, silhouette, anatomy, pose and illustrated style. No new limbs or accessories. No egg remains or duplicate companion.",
      "This is a full opaque scene, not a cutout. No blank or black background, transparency, frame, text, or interface. Do not remove the scenery behind the hatchling.",
    ].join(" "),
  });
}
