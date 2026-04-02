import path from "node:path";
import {
  MANIFEST_DIR,
  buildStage2Manifest,
  buildStage2PromptMarkdown,
  writeJson,
  writeText,
} from "./companion-stage2-preview-utils";

async function main() {
  const manifest = buildStage2Manifest();

  const manifestPath = path.join(MANIFEST_DIR, "companions.stage2.manifest.json");
  const promptPath = path.join(MANIFEST_DIR, "companions.stage2.prompts.md");

  writeJson(manifestPath, manifest);
  writeText(promptPath, buildStage2PromptMarkdown(manifest));

  console.log(`Wrote ${manifest.length} stage-2 companion preview rows -> ${manifestPath}`);
  console.log(`Wrote prompt pack -> ${promptPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

