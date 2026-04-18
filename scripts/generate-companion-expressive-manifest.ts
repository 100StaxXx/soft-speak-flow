import path from "node:path";
import {
  MANIFEST_DIR,
  buildCompanionExpressiveManifest,
  buildCompanionExpressivePromptMarkdown,
  writeJson,
  writeText,
} from "./companion-expressive-preview-utils";

async function main() {
  const manifest = buildCompanionExpressiveManifest();

  const manifestPath = path.join(MANIFEST_DIR, "companions.expressive.manifest.json");
  const promptPath = path.join(MANIFEST_DIR, "companions.expressive.prompts.md");

  writeJson(manifestPath, manifest);
  writeText(promptPath, buildCompanionExpressivePromptMarkdown(manifest));

  console.log(`Wrote ${manifest.length} expressive companion rows -> ${manifestPath}`);
  console.log(`Wrote expressive prompt pack -> ${promptPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
