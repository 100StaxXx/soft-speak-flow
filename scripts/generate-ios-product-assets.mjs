#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.join(projectRoot, "ios", "App", "App", "Assets.xcassets");

const renderSvg = async (sourcePath, destinationPath, size) => {
  const source = await fs.readFile(sourcePath);
  await sharp(source).resize(size, size).png().toFile(destinationPath);
};

const renderOpaqueAppIcon = async (sourcePath, destinationPath, background) => {
  const source = await fs.readFile(sourcePath);
  await sharp(source)
    .resize(1024, 1024)
    .flatten({ background })
    .png()
    .toFile(destinationPath);
};

const run = async () => {
  const gracewardIconSource = path.join(projectRoot, "public", "icon-512.svg");
  const cosmiqIconSource = path.join(projectRoot, "public", "cosmiq-icon.png");
  const gracewardSplashSource = path.join(projectRoot, "public", "daily-way-splash.svg");
  const cosmiqSplashSource = Buffer.from(`
    <svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="space" cx="50%" cy="40%" r="72%">
          <stop offset="0%" stop-color="#172554"/>
          <stop offset="55%" stop-color="#11102b"/>
          <stop offset="100%" stop-color="#05050b"/>
        </radialGradient>
        <linearGradient id="mark" x1="10%" y1="5%" x2="90%" y2="95%">
          <stop offset="0%" stop-color="#9ff7f2"/>
          <stop offset="50%" stop-color="#63b7ff"/>
          <stop offset="100%" stop-color="#a855f7"/>
        </linearGradient>
      </defs>
      <rect width="2732" height="2732" fill="url(#space)"/>
      <circle cx="1366" cy="1200" r="610" fill="none" stroke="#8b5cf6" stroke-width="10" opacity="0.20"/>
      <circle cx="1366" cy="1200" r="440" fill="none" stroke="#67e8f9" stroke-width="8" opacity="0.16"/>
      <circle cx="1366" cy="1160" r="120" fill="url(#mark)"/>
      <circle cx="1165" cy="1000" r="70" fill="#9ff7f2"/>
      <circle cx="1567" cy="1000" r="70" fill="#9ff7f2"/>
      <circle cx="1276" cy="865" r="66" fill="#9ff7f2"/>
      <circle cx="1456" cy="865" r="66" fill="#9ff7f2"/>
      <path d="M1090 1465c140-155 254-225 361-225 100 0 175 48 227 143-71 155-191 246-360 271-91-20-167-83-228-189Z" fill="url(#mark)" opacity="0.96"/>
      <text x="1366" y="1870" text-anchor="middle" fill="#f8fafc" font-family="Georgia, 'Times New Roman', serif" font-size="180" font-weight="600">Cosmiq</text>
      <text x="1366" y="1985" text-anchor="middle" fill="#a5b4fc" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="48" letter-spacing="10">MEANINGFUL MOMENTUM</text>
    </svg>
  `);

  const cosmiqSplashPath = path.join(assetRoot, "SplashCosmiq.imageset", "SplashCosmiq-2732.png");
  const gracewardSplashPath = path.join(assetRoot, "SplashGraceward.imageset", "SplashGraceward-2732.png");

  await Promise.all([
    fs.copyFile(
      cosmiqIconSource,
      path.join(assetRoot, "AppIconCosmiq.appiconset", "Cosmiq-1024.png"),
    ),
    renderOpaqueAppIcon(
      gracewardIconSource,
      path.join(assetRoot, "AppIconGraceward.appiconset", "Graceward-1024.png"),
      "#2f5938",
    ),
    renderSvg(gracewardSplashSource, gracewardSplashPath, 2732),
    sharp(cosmiqSplashSource).png().toFile(cosmiqSplashPath),
  ]);

  await Promise.all([
    fs.copyFile(cosmiqSplashPath, path.join(assetRoot, "SplashCosmiq.imageset", "SplashCosmiq-2732-1.png")),
    fs.copyFile(cosmiqSplashPath, path.join(assetRoot, "SplashCosmiq.imageset", "SplashCosmiq-2732-2.png")),
    fs.copyFile(gracewardSplashPath, path.join(assetRoot, "SplashGraceward.imageset", "SplashGraceward-2732-1.png")),
    fs.copyFile(gracewardSplashPath, path.join(assetRoot, "SplashGraceward.imageset", "SplashGraceward-2732-2.png")),
  ]);

  console.log("[ios:assets] Generated isolated Cosmiq and Graceward icons and launch screens.");
};

run().catch((error) => {
  console.error(`[ios:assets] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
