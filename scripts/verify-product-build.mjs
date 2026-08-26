#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(projectRoot, "dist");
const prefix = "[verify-product-build]";

const PRODUCTS = {
  graceward: {
    name: "Graceward",
    scheme: "graceward",
    bundleId: "com.darrylgraham.graceward",
    supabaseProjectRef: "uzyhnksdntctltwfnetd",
    forbiddenSupabaseProjectRefs: ["opbfpbbqvuksuvmtmssd"],
    iconPath: "/icon-192.svg",
    forbidden: ["Cosmiq", "cosmiq://", "com.darrylgraham.revolution"],
    forbiddenArtifacts: [
      "COSMIQ_PRIVACY_POLICY.md",
      "COSMIQ_TERMS_OF_SERVICE.md",
      "cosmiq-icon.png",
      "cosmiq-icon.svg",
      "companion-eggs",
      "companion-hatch-videos",
      "companion-launcher-away",
      "companion-presets",
      "landing-backdrops",
      "onboarding",
    ],
    oppositeCacheName: "cosmiq-image-cache",
    forbiddenAssetFragments: [
      "cosmic-galaxy-portal",
      "cosmic-path-",
      "cosmic-signin",
      "cosmic-welcome",
      "wallpaper-campaigns-seed",
      "wallpaper-quests-seed",
    ],
  },
  cosmiq: {
    name: "Cosmiq",
    scheme: "cosmiq",
    bundleId: "com.darrylgraham.revolution",
    supabaseProjectRef: "opbfpbbqvuksuvmtmssd",
    forbiddenSupabaseProjectRefs: ["uzyhnksdntctltwfnetd"],
    iconPath: "/cosmiq-icon.png",
    forbidden: ["Graceward", "graceward://", "com.darrylgraham.graceward"],
    forbiddenArtifacts: [
      "PRIVACY_POLICY.md",
      "TERMS_OF_SERVICE.md",
      "favicon.ico",
      "favicon.png",
      "icon-192.png",
      "icon-192.svg",
      "icon-512.svg",
      "graceward-motion",
    ],
    oppositeCacheName: "graceward-image-cache",
    forbiddenAssetFragments: ["graceward-"],
  },
};

const fail = (message) => {
  console.error(`${prefix} ${message}`);
  process.exit(1);
};

const getRequestedProduct = () => {
  const productFlagIndex = process.argv.indexOf("--product");
  if (productFlagIndex === -1) return null;
  const value = process.argv[productFlagIndex + 1];
  if (!(value in PRODUCTS)) {
    fail(`Expected --product graceward or --product cosmiq; got ${String(value)}.`);
  }
  return value;
};

const readText = async (relativePath) => {
  try {
    return await fs.readFile(path.join(distRoot, relativePath), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Could not read dist/${relativePath}: ${message}`);
  }
};

const pathExists = async (relativePath) => {
  try {
    await fs.access(path.join(distRoot, relativePath));
    return true;
  } catch {
    return false;
  }
};

const run = async () => {
  const manifestText = await readText("manifest.webmanifest");
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    fail(`manifest.webmanifest is not valid JSON: ${String(error)}`);
  }

  const inferredProduct = Object.entries(PRODUCTS).find(
    ([, product]) => product.name === manifest.short_name,
  )?.[0];
  if (!inferredProduct) {
    fail(`Cannot infer product from manifest short_name ${String(manifest.short_name)}.`);
  }

  const requestedProduct = getRequestedProduct();
  if (requestedProduct && requestedProduct !== inferredProduct) {
    fail(`Expected a ${PRODUCTS[requestedProduct].name} build, but the manifest is ${manifest.short_name}.`);
  }

  const product = PRODUCTS[inferredProduct];
  const serviceWorker = await readText("sw.js");
  const identityFiles = {
    "index.html": await readText("index.html"),
    "manifest.webmanifest": manifestText,
    "calendar/oauth/callback.html": await readText("calendar/oauth/callback.html"),
    "apple-app-site-association": await readText("apple-app-site-association"),
    ".well-known/apple-app-site-association": await readText(
      ".well-known/apple-app-site-association",
    ),
  };

  for (const [relativePath, contents] of Object.entries(identityFiles)) {
    for (const forbidden of product.forbidden) {
      if (contents.includes(forbidden)) {
        fail(`dist/${relativePath} contains cross-product identifier ${forbidden}.`);
      }
    }
  }

  for (const relativePath of product.forbiddenArtifacts) {
    if (await pathExists(relativePath)) {
      fail(`dist/${relativePath} is an opposite-product artifact and must not be shipped.`);
    }
    const serviceWorkerNeedle = relativePath.includes(".")
      ? relativePath
      : `\"url\":\"${relativePath}/`;
    if (serviceWorker.includes(serviceWorkerNeedle)) {
      fail(`Service worker precaches opposite-product artifact ${relativePath}.`);
    }
  }

  const emittedFiles = await fs.readdir(distRoot, { recursive: true });
  for (const relativePath of emittedFiles) {
    for (const fragment of product.forbiddenAssetFragments) {
      if (relativePath.includes(fragment)) {
        fail(`dist/${relativePath} contains opposite-product background asset ${fragment}.`);
      }
    }
  }

  const runtimeArtifactFiles = emittedFiles.filter((relativePath) =>
    /\.(?:css|html|js|json|webmanifest)$/i.test(relativePath),
  );
  const runtimeArtifactText = (
    await Promise.all(
      runtimeArtifactFiles.map((relativePath) => readText(relativePath)),
    )
  ).join("\n");

  if (!runtimeArtifactText.includes(product.supabaseProjectRef)) {
    fail(
      `${product.name} build does not contain its required Supabase project ${product.supabaseProjectRef}.`,
    );
  }

  for (const forbiddenRef of product.forbiddenSupabaseProjectRefs) {
    if (runtimeArtifactText.includes(forbiddenRef)) {
      fail(
        `${product.name} build contains the opposite product's Supabase project ${forbiddenRef}.`,
      );
    }
  }

  const expectedCacheName = `${product.scheme}-image-cache`;
  if (!serviceWorker.includes(expectedCacheName)) {
    fail(`Service worker does not use the product-scoped cache ${expectedCacheName}.`);
  }
  if (serviceWorker.includes(product.oppositeCacheName)) {
    fail(`Service worker contains opposite-product cache ${product.oppositeCacheName}.`);
  }
  if (!serviceWorker.includes("NetworkOnly")) {
    fail("Service worker must keep authenticated Supabase responses network-only.");
  }

  if (!identityFiles["index.html"].includes(`Loading ${product.name}…`)) {
    fail(`index.html does not contain the ${product.name} loading identity.`);
  }
  if (!identityFiles["index.html"].includes(product.iconPath)) {
    fail(`index.html does not use the ${product.name} icon ${product.iconPath}.`);
  }
  if (!identityFiles["index.html"].includes(`class="product-${product.scheme}"`)) {
    fail(`index.html does not apply the product-${product.scheme} root presentation class.`);
  }
  if (!identityFiles["calendar/oauth/callback.html"].includes(`${product.scheme}://`)) {
    fail(`Calendar callback does not return to the ${product.scheme} URL scheme.`);
  }

  if (
    manifest.short_name !== product.name
    || manifest.icons?.length !== 1
    || manifest.icons[0]?.src !== product.iconPath
  ) {
    fail(`${product.name} manifest identity or icon is inconsistent.`);
  }

  let rootAssociation;
  let wellKnownAssociation;
  try {
    rootAssociation = JSON.parse(identityFiles["apple-app-site-association"]);
    wellKnownAssociation = JSON.parse(identityFiles[".well-known/apple-app-site-association"]);
  } catch (error) {
    fail(`Apple app-site association is not valid JSON: ${String(error)}`);
  }

  const expectedAppId = `B6VW78ABTR.${product.bundleId}`;
  for (const [label, association] of [
    ["root", rootAssociation],
    ["well-known", wellKnownAssociation],
  ]) {
    const appIds = association?.applinks?.details?.map((detail) => detail.appID) ?? [];
    if (appIds.length !== 1 || appIds[0] !== expectedAppId) {
      fail(`${label} association must authorize only ${expectedAppId}; got ${appIds.join(", ") || "none"}.`);
    }
  }

  console.log(`${prefix} Verified isolated ${product.name} web artifact.`);
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
