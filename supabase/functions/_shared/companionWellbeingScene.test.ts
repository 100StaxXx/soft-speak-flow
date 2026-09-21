import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ImageMagick, MagickColors, MagickFormat } from "npm:@imagemagick/magick-wasm@0.0.43";
import { composeWellbeingScene, downloadScenePortrait, initializeSceneCompositor } from "./companionWellbeingScene.ts";
import { getCompanionHabitatPath, COMPANION_HABITATS } from "../../../src/shared/companionHabitat.ts";

Deno.test("flattens transparent companion pixels over visible scenery into an opaque video frame", async () => {
  await initializeSceneCompositor();
  const portrait = ImageMagick.read(MagickColors.Transparent, 64, 64, (img) => {
    img.getPixels((pixels) => {
      for (let y = 20; y < 44; y++) for (let x = 20; x < 44; x++) pixels.setPixel(x, y, [255, 0, 0, 255]);
    });
    return img.write(MagickFormat.Png, (bytes) => new Uint8Array(bytes));
  });
  const habitat = ImageMagick.read(MagickColors.Blue, 96, 64, (img) => img.write(MagickFormat.WebP, (bytes) => new Uint8Array(bytes)));
  const scene = await composeWellbeingScene(portrait, habitat);
  ImageMagick.read(scene, (img) => {
    assertEquals([img.width, img.height], [64, 64]);
    assertEquals(img.hasAlpha, false);
    img.getPixels((pixels) => {
      const corner = pixels.getPixel(2, 2);
      const center = pixels.getPixel(32, 32);
      assert(corner[2] > 220 && corner[0] < 30, "Habitat must remain visible behind the animal");
      assert(center[0] > 220 && center[2] < 30, "Companion must remain intact on top");
    });
  });
});

Deno.test("every stage uses exactly the same bundled habitat artwork as the app", async () => {
  for (const element of Object.keys(COMPANION_HABITATS)) {
    for (const stage of [1, 5, 13, 21, 36, 56, 81]) {
      const path = getCompanionHabitatPath(element, stage)!;
      const app = await Deno.readFile(new URL(`../../../public${path}`, import.meta.url));
      const server = await Deno.readFile(new URL(`../companion-wellbeing-video/habitats/${path.split("/").pop()}`, import.meta.url));
      assertEquals(server, app);
    }
  }
  assertEquals(getCompanionHabitatPath("storm", 0), null);
  assertEquals(getCompanionHabitatPath("../private", 1), null);
  assertEquals(getCompanionHabitatPath(" STORM ", 5), "/companion-habitats/storm-initiate.webp");
});

Deno.test("real storm habitat and PNG portrait compose without changing the source files", async () => {
  const portrait = await Deno.readFile(new URL("../../../public/companion-presets/buttercat/t1_youth/normal/buttercat__t1_youth__normal__storm.png", import.meta.url));
  const habitat = await Deno.readFile(new URL("../companion-wellbeing-video/habitats/storm.webp", import.meta.url));
  const result = await composeWellbeingScene(portrait, habitat);
  ImageMagick.read(result, (img) => {
    assertEquals(img.hasAlpha, false);
    assert(Math.max(img.width, img.height) <= 1024);
    assert(result.length > 10000);
  });
});

Deno.test("rejects HTML fallback, oversized files and vector input instead of silently dropping the habitat", async () => {
  await assertRejects(() => downloadScenePortrait("https://example.test/portrait", (async () => new Response("<html>", { headers: { "content-type": "text/html" } })) as typeof fetch));
  await assertRejects(() => downloadScenePortrait("https://example.test/portrait", (async () => new Response("x", { headers: { "content-type": "image/png", "content-length": "9999999" } })) as typeof fetch));
  await assertRejects(() => composeWellbeingScene(new TextEncoder().encode("<svg/>"), new Uint8Array()));
});
