import {
  ImageMagick, initializeImageMagick, MagickFormat, Gravity, CompositeOperator, ResourceLimits,
} from "npm:@imagemagick/magick-wasm@0.0.43";
import { COMPANION_HABITATS, getCompanionHabitatPath } from "../../../src/shared/companionHabitat.ts";

/** Deployment smoke check: bundled assets/WASM only; no user data, writes or paid calls. */
export async function verifyWellbeingSceneRuntime() {
  const paths = new Set<string>();
  for (const element of Object.keys(COMPANION_HABITATS)) {
    for (const stage of [1, 5, 13, 21, 36, 56, 81]) {
      paths.add(getCompanionHabitatPath(element, stage)!);
    }
  }
  let sample: Uint8Array | undefined;
  for (const path of paths) {
    const bytes = await Deno.readFile(new URL(`../companion-wellbeing-video/habitats/${path.split("/").pop()}`, import.meta.url));
    if (!isRaster(bytes)) throw new Error("Invalid bundled habitat");
    sample = bytes;
  }
  if (!sample) throw new Error("No bundled habitats");
  const composed = await composeWellbeingScene(sample, sample);
  return { habitats: paths.size, composedBytes: composed.length };
}
import { registerUserStorageAsset } from "./storageAssetLedger.ts";

let initialization: Promise<void> | undefined;
export function initializeSceneCompositor() {
  return initialization ??= (async () => {
    const wasm = await Deno.readFile(new URL("x86/magick.wasm", import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.43")));
    await initializeImageMagick(wasm);
    ResourceLimits.width = 4096n;
    ResourceLimits.height = 4096n;
    ResourceLimits.memory = 96n * 1024n * 1024n;
    ResourceLimits.disk = 0n;
    // ImageMagick counts working images/clones as well as decoded frames.
    ResourceLimits.listLength = 16n;
  })().catch((error) => { initialization = undefined; throw error; });
}

const isRaster = (bytes: Uint8Array) =>
  (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) ||
  (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
  (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP");

/** Flatten the SAME artwork used by the UI. No image model or character redraw. */
export async function composeWellbeingScene(portrait: Uint8Array, habitat: Uint8Array): Promise<Uint8Array> {
  if (!isRaster(portrait) || !isRaster(habitat)) throw new Error("A PNG, JPEG or WebP scene is required");
  await initializeSceneCompositor();
  return ImageMagick.read(portrait, (animal) => {
    if (animal.width * animal.height > 8_000_000) throw new Error("Portrait is too large");
    const scale = Math.min(1, 1024 / Math.max(animal.width, animal.height));
    const width = Math.max(1, Math.round(animal.width * scale));
    const height = Math.max(1, Math.round(animal.height * scale));
    animal.resize(width, height);
    return ImageMagick.read(habitat, (scene) => {
      const cover = Math.max(width / scene.width, height / scene.height);
      scene.resize(Math.ceil(scene.width * cover), Math.ceil(scene.height * cover));
      scene.crop(width, height, Gravity.Center);
      scene.resetPage();
      scene.composite(animal, CompositeOperator.Over);
      scene.quality = 94;
      return scene.write(MagickFormat.Jpeg, (bytes) => new Uint8Array(bytes));
    });
  });
}

export async function downloadScenePortrait(url: string, fetchFn: typeof fetch): Promise<Uint8Array> {
  const response = await fetchFn(url, { redirect: "error" });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("Portrait unavailable");
  const limit = 5 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit || !response.body) throw new Error("Portrait too large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Portrait too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function prepareWellbeingScene(input: {
  db: any; job: { id: string; user_id: string; source_image_url: string; stage: number }; element: string | null; fetchFn: typeof fetch;
}): Promise<string> {
  const habitatPath = getCompanionHabitatPath(input.element, input.job.stage);
  if (!habitatPath) throw new Error("Companion habitat unavailable");
  // Bundled, versioned art: the public website may return its SPA HTML for these paths.
  const habitat = await Deno.readFile(new URL(`../companion-wellbeing-video/habitats/${habitatPath.split("/").pop()}`, import.meta.url));
  const portrait = await downloadScenePortrait(input.job.source_image_url, input.fetchFn);
  const bytes = await composeWellbeingScene(portrait, habitat);
  const bucket = "companion-images";
  const path = `${input.job.user_id}/wellbeing-scenes/${input.job.id}.jpg`;
  const { error } = await input.db.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  await registerUserStorageAsset({ supabase: input.db, userId: input.job.user_id, bucketId: bucket,
    storagePath: path, sourceKind: "cosmiq_wellbeing_scene", sourceRecordTable: "cosmiq_wellbeing_videos", sourceRecordId: input.job.id });
  return input.db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
