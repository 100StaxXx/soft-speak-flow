import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const product = JSON.parse(fs.readFileSync(path.join(projectRoot, "product.config.json"), "utf8"));

const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const failures = [];
const requireText = (relativePath, expected) => {
  if (!read(relativePath).includes(expected)) {
    failures.push(`${relativePath} must contain ${JSON.stringify(expected)}`);
  }
};
const rejectText = (relativePath, forbidden) => {
  if (read(relativePath).toLowerCase().includes(forbidden.toLowerCase())) {
    failures.push(`${relativePath} must not contain ${JSON.stringify(forbidden)}`);
  }
};

requireText("capacitor.config.ts", `appId: '${product.bundleId}'`);
requireText("capacitor.config.ts", `appName: '${product.displayName}'`);
requireText("index.html", `<title>${product.displayName}`);
requireText("ios/App/App/Info.plist", `<string>${product.displayName}</string>`);
requireText("ios/App/App/Info.plist", `<string>${product.urlScheme}</string>`);
requireText("ios/App/App.xcodeproj/project.pbxproj", `PRODUCT_BUNDLE_IDENTIFIER = ${product.bundleId};`);

for (const productId of product.storeKitProducts) {
  requireText("ios/App/App/CosmiqProducts.storekit", `\"productID\" : \"${productId}\"`);
  requireText("src/utils/appleIAP.ts", `\"${productId}\"`);
}

for (const identityFile of [
  "capacitor.config.ts",
  "index.html",
  "ios/App/App/Info.plist",
  "ios/App/App/CosmiqProducts.storekit",
  "public/TERMS_OF_SERVICE.md",
  "public/PRIVACY_POLICY.md",
  "src/pages/TermsOfService.tsx",
  "src/pages/PrivacyPolicy.tsx",
]) {
  rejectText(identityFile, "Graceward");
  rejectText(identityFile, "Soft Speak Flow");
}

if (failures.length > 0) {
  console.error("Cosmiq product-boundary verification failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Cosmiq product boundary verified.");
