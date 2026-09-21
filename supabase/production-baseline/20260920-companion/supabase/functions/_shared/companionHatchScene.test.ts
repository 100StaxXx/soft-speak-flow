import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { prepareHatchSceneEndpoint, HATCH_VIDEO_CONTINUITY } from "./companionHatchScene.ts";

Deno.test("hatch ending frame uses the egg's scene and approved companion, never a transparent canvas", async () => {
  let call: any;
  const guardedFetch = (() => { throw new Error("No paid network call in this test"); }) as typeof fetch;
  const result = await prepareHatchSceneEndpoint({
    guardedFetch, openAIApiKey: "test", model: "existing-model", size: "1024x1024", userId: "test-user",
    startImageUrl: "https://example.test/egg-scene.png", companionImageUrl: "data:image/png;base64,approved",
  }, async (input) => {
    call = input;
    return { imageDataUrl: "data:image/png;base64,opaque-scene", revisedPrompt: null, size: input.size };
  });
  assertEquals(call.background, "opaque");
  assertEquals(call.guardedFetch, guardedFetch);
  assertEquals(call.model, "existing-model");
  assertEquals(call.referenceImages, [{ imageUrl: "https://example.test/egg-scene.png" }, { imageUrl: "data:image/png;base64,approved" }]);
  assert(call.prompt.includes("Preserve its existing elemental background"));
  assert(call.prompt.includes("Replace only the egg"));
  assertEquals(result.imageDataUrl, "data:image/png;base64,opaque-scene");
  assert(HATCH_VIDEO_CONTINUITY.includes("including the final hold"));
});
