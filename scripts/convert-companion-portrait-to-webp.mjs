import sharp from "sharp";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: convert-companion-portrait-to-webp.mjs <input> <output>");
}

await sharp(inputPath)
  .resize(1536, 1536, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .webp({ quality: 92 })
  .toFile(outputPath);
