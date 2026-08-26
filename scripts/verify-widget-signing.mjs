#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const iosAppDirectory = path.join(projectRoot, "ios", "App");
const xcodeProjectPath = path.join(iosAppDirectory, "App.xcodeproj", "project.pbxproj");

const APP_TARGET = "App";
const WIDGET_TARGET = "CosmiqWidgetExtension";
const PRODUCTS = {
  graceward: {
    buildVersion: "38",
    appGroup: "group.com.darrylgraham.graceward",
    appBundleId: "com.darrylgraham.graceward",
    widgetBundleId: "com.darrylgraham.graceward.GracewardWidget",
    appEntitlements: "App/App.entitlements",
    widgetEntitlements: "../CosmiqWidget/CosmiqWidget.entitlements",
    associatedDomains: ["applinks:graceward.app", "applinks:www.graceward.app"],
    appIcon: "AppIconGraceward",
    displayName: "Graceward",
    launchStoryboard: "LaunchScreenGraceward",
    marketingVersion: "1.0",
    urlScheme: "graceward",
    swiftCondition: "GRACEWARD_PRODUCT",
    debugConfiguration: "GracewardDebug",
    releaseConfiguration: "GracewardRelease",
    storeKitFile: "App/GracewardProducts.storekit",
  },
  cosmiq: {
    buildVersion: "349",
    appGroup: "group.com.darrylgraham.revolution",
    appBundleId: "com.darrylgraham.revolution",
    widgetBundleId: "com.darrylgraham.revolution.CosmiqWidget",
    appEntitlements: "App/Cosmiq.entitlements",
    widgetEntitlements: "../CosmiqWidget/CosmiqProduct.entitlements",
    associatedDomains: ["applinks:app.cosmiq.quest"],
    appIcon: "AppIconCosmiq",
    displayName: "Cosmiq",
    launchStoryboard: "LaunchScreenCosmiq",
    marketingVersion: "4.8",
    urlScheme: "cosmiq",
    swiftCondition: "COSMIQ_PRODUCT",
    debugConfiguration: "CosmiqDebug",
    releaseConfiguration: "CosmiqRelease",
    storeKitFile: "App/CosmiqProducts.storekit",
  },
};
const PREFIX = "[ios:verify-widget-signing]";

const log = (message) => {
  console.log(`${PREFIX} ${message}`);
};

const fail = (errors) => {
  console.error(`${PREFIX} Validation failed:`);
  for (const error of errors) {
    console.error(`${PREFIX} - ${error}`);
  }
  process.exit(1);
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findConfigBlocksByBundleId = (lines, bundleId) => {
  const bundleRegex = new RegExp(
    `PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*["']?${escapeRegex(bundleId)}["']?;`,
  );
  const configBlocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!bundleRegex.test(lines[i])) {
      continue;
    }

    let startIdx = i;
    for (let j = i; j >= 0; j -= 1) {
      if (/^\s*\w+\s*\/\*\s*[^*]+\s*\*\/\s*=\s*\{/.test(lines[j])) {
        startIdx = j;
        break;
      }
    }

    let endIdx = i;
    let depth = 0;
    let started = false;
    for (let j = startIdx; j < lines.length; j += 1) {
      for (const char of lines[j]) {
        if (char === "{") {
          started = true;
          depth += 1;
        } else if (char === "}") {
          depth -= 1;
        }
      }
      if (started && depth === 0) {
        endIdx = j;
        break;
      }
    }

    configBlocks.push({ start: startIdx, end: endIdx });
  }

  return configBlocks
    .filter(
      (block, index, self) =>
        index === self.findIndex((candidate) => candidate.start === block.start && candidate.end === block.end),
    )
    .sort((a, b) => a.start - b.start);
};

const parseBuildSettingsFromBlock = (blockLines) => {
  const settings = {};
  for (const line of blockLines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+);\s*$/);
    if (!match) {
      continue;
    }
    settings[match[1]] = match[2].trim();
  }
  return settings;
};

const collectTargetSettings = (lines, bundleId, targetName, errors) => {
  const blocks = findConfigBlocksByBundleId(lines, bundleId);
  if (blocks.length === 0) {
    errors.push(`Could not find ${targetName} build configuration blocks in ${xcodeProjectPath}`);
    return [];
  }
  return blocks.map((block) => parseBuildSettingsFromBlock(lines.slice(block.start, block.end + 1)));
};

const resolveConsistentSetting = (settingsList, key, targetName, errors) => {
  const values = settingsList
    .map((settings) => settings[key])
    .filter((value) => typeof value === "string" && value.length > 0);

  if (values.length === 0) {
    errors.push(`Missing ${key} for target ${targetName}`);
    return null;
  }

  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length > 1) {
    errors.push(`${key} mismatch across ${targetName} configurations: ${uniqueValues.join(", ")}`);
    return uniqueValues[0];
  }

  return uniqueValues[0];
};

const parseEntitlementValues = async (entitlementsPath, key) => {
  let xml;
  try {
    xml = await fs.readFile(entitlementsPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read entitlements file ${entitlementsPath}: ${message}`);
  }

  const escapedKey = escapeRegex(key);
  const keyMatch = xml.match(new RegExp(
    `<key>\\s*${escapedKey}\\s*<\\/key>\\s*<array>([\\s\\S]*?)<\\/array>`,
  ));
  if (!keyMatch) {
    return [];
  }

  return Array.from(keyMatch[1].matchAll(/<string>\s*([^<\s][^<]*)\s*<\/string>/g)).map((match) =>
    match[1].trim(),
  );
};

const run = async () => {
  const productFlagIndex = process.argv.indexOf("--product");
  const requestedProduct = productFlagIndex >= 0
    ? process.argv[productFlagIndex + 1]?.toLowerCase()
    : process.env.IOS_PRODUCT?.trim().toLowerCase();
  if (!requestedProduct || !(requestedProduct in PRODUCTS)) {
    fail([`Choose a product with --product graceward or --product cosmiq.`]);
  }
  const product = PRODUCTS[requestedProduct];
  const errors = [];
  const pbxprojContent = await fs.readFile(xcodeProjectPath, "utf8");
  const lines = pbxprojContent.split(/\r?\n/);

  const appSettingsByConfig = collectTargetSettings(lines, product.appBundleId, APP_TARGET, errors);
  const widgetSettingsByConfig = collectTargetSettings(
    lines,
    product.widgetBundleId,
    WIDGET_TARGET,
    errors,
  );

  const appBundleId = resolveConsistentSetting(
    appSettingsByConfig,
    "PRODUCT_BUNDLE_IDENTIFIER",
    APP_TARGET,
    errors,
  );
  const widgetBundleId = resolveConsistentSetting(
    widgetSettingsByConfig,
    "PRODUCT_BUNDLE_IDENTIFIER",
    WIDGET_TARGET,
    errors,
  );
  const appBuildVersion = resolveConsistentSetting(
    appSettingsByConfig,
    "CURRENT_PROJECT_VERSION",
    APP_TARGET,
    errors,
  );
  const widgetBuildVersion = resolveConsistentSetting(
    widgetSettingsByConfig,
    "CURRENT_PROJECT_VERSION",
    WIDGET_TARGET,
    errors,
  );
  const appMarketingVersion = resolveConsistentSetting(
    appSettingsByConfig,
    "MARKETING_VERSION",
    APP_TARGET,
    errors,
  );
  const widgetMarketingVersion = resolveConsistentSetting(
    widgetSettingsByConfig,
    "MARKETING_VERSION",
    WIDGET_TARGET,
    errors,
  );
  const appEntitlementsRel = resolveConsistentSetting(
    appSettingsByConfig,
    "CODE_SIGN_ENTITLEMENTS",
    APP_TARGET,
    errors,
  );
  const widgetEntitlementsRel = resolveConsistentSetting(
    widgetSettingsByConfig,
    "CODE_SIGN_ENTITLEMENTS",
    WIDGET_TARGET,
    errors,
  );

  if (appBundleId && appBundleId !== product.appBundleId) {
    errors.push(
      `Unexpected app bundle identifier: expected ${product.appBundleId}, got ${appBundleId}`,
    );
  }

  if (widgetBundleId && widgetBundleId !== product.widgetBundleId) {
    errors.push(
      `Unexpected widget bundle identifier: expected ${product.widgetBundleId}, got ${widgetBundleId}`,
    );
  }

  if (appBundleId && widgetBundleId && !widgetBundleId.startsWith(`${appBundleId}.`)) {
    errors.push(`Widget bundle identifier ${widgetBundleId} does not share app prefix ${appBundleId}.`);
  }

  if (appBuildVersion && widgetBuildVersion && appBuildVersion !== widgetBuildVersion) {
    errors.push(`CURRENT_PROJECT_VERSION mismatch: app=${appBuildVersion}, widget=${widgetBuildVersion}`);
  }

  if (appBuildVersion && appBuildVersion !== product.buildVersion) {
    errors.push(
      `Unexpected app CURRENT_PROJECT_VERSION: expected ${product.buildVersion}, got ${appBuildVersion}`,
    );
  }

  if (appMarketingVersion && appMarketingVersion !== product.marketingVersion) {
    errors.push(
      `Unexpected app MARKETING_VERSION: expected ${product.marketingVersion}, got ${appMarketingVersion}`,
    );
  }

  if (
    appMarketingVersion &&
    widgetMarketingVersion &&
    appMarketingVersion !== widgetMarketingVersion
  ) {
    errors.push(
      `MARKETING_VERSION mismatch: app=${appMarketingVersion}, widget=${widgetMarketingVersion}`,
    );
  }

  if (errors.length > 0) {
    fail(errors);
  }

  const appEntitlementsPath = path.resolve(iosAppDirectory, appEntitlementsRel);
  const widgetEntitlementsPath = path.resolve(iosAppDirectory, widgetEntitlementsRel);

  const entitlementChecks = await Promise.allSettled([
    fs.access(appEntitlementsPath),
    fs.access(widgetEntitlementsPath),
  ]);

  if (entitlementChecks[0].status === "rejected") {
    errors.push(`App entitlements file is missing or unreadable: ${appEntitlementsPath}`);
  }

  if (entitlementChecks[1].status === "rejected") {
    errors.push(`Widget entitlements file is missing or unreadable: ${widgetEntitlementsPath}`);
  }

  if (errors.length > 0) {
    fail(errors);
  }

  const [appGroups, widgetGroups, associatedDomains] = await Promise.all([
    parseEntitlementValues(appEntitlementsPath, "com.apple.security.application-groups"),
    parseEntitlementValues(widgetEntitlementsPath, "com.apple.security.application-groups"),
    parseEntitlementValues(appEntitlementsPath, "com.apple.developer.associated-domains"),
  ]);

  if (!appGroups.includes(product.appGroup)) {
    errors.push(
      `Expected app group ${product.appGroup} missing in app entitlements (${appEntitlementsPath})`,
    );
  }

  if (!widgetGroups.includes(product.appGroup)) {
    errors.push(
      `Expected app group ${product.appGroup} missing in widget entitlements (${widgetEntitlementsPath})`,
    );
  }

  if (appGroups.length === 0) {
    errors.push(`No app groups found in app entitlements (${appEntitlementsPath})`);
  }

  if (widgetGroups.length === 0) {
    errors.push(`No app groups found in widget entitlements (${widgetEntitlementsPath})`);
  }

  const sharedGroups = appGroups.filter((group) => widgetGroups.includes(group));
  if (sharedGroups.length === 0) {
    errors.push(
      `App and widget entitlements do not share any app group value. app=${JSON.stringify(appGroups)} widget=${JSON.stringify(widgetGroups)}`,
    );
  }

  const missingDomains = product.associatedDomains.filter((domain) => !associatedDomains.includes(domain));
  const unexpectedDomains = associatedDomains.filter((domain) => !product.associatedDomains.includes(domain));
  if (missingDomains.length > 0 || unexpectedDomains.length > 0) {
    errors.push(
      `Associated domains mismatch. expected=${JSON.stringify(product.associatedDomains)} actual=${JSON.stringify(associatedDomains)}`,
    );
  }

  const appIcon = resolveConsistentSetting(appSettingsByConfig, "ASSETCATALOG_COMPILER_APPICON_NAME", APP_TARGET, errors);
  const displayName = resolveConsistentSetting(appSettingsByConfig, "PRODUCT_DISPLAY_NAME", APP_TARGET, errors);
  const launchStoryboard = resolveConsistentSetting(appSettingsByConfig, "PRODUCT_LAUNCH_STORYBOARD", APP_TARGET, errors);
  const urlScheme = resolveConsistentSetting(appSettingsByConfig, "PRODUCT_URL_SCHEME", APP_TARGET, errors);
  if (appIcon && appIcon !== product.appIcon) {
    errors.push(`Unexpected app icon: expected ${product.appIcon}, got ${appIcon}`);
  }
  if (displayName && displayName !== product.displayName) {
    errors.push(`Unexpected display name: expected ${product.displayName}, got ${displayName}`);
  }
  if (launchStoryboard && launchStoryboard !== product.launchStoryboard) {
    errors.push(`Unexpected launch storyboard: expected ${product.launchStoryboard}, got ${launchStoryboard}`);
  }
  if (urlScheme && urlScheme !== product.urlScheme) {
    errors.push(`Unexpected URL scheme: expected ${product.urlScheme}, got ${urlScheme}`);
  }

  const appSwiftConditions = appSettingsByConfig.map((settings) => settings.SWIFT_ACTIVE_COMPILATION_CONDITIONS ?? "");
  const widgetSwiftConditions = widgetSettingsByConfig.map((settings) => settings.SWIFT_ACTIVE_COMPILATION_CONDITIONS ?? "");
  if (!appSwiftConditions.every((conditions) => conditions.includes(product.swiftCondition))) {
    errors.push(`App configurations are missing ${product.swiftCondition}.`);
  }
  if (!widgetSwiftConditions.every((conditions) => conditions.includes(product.swiftCondition))) {
    errors.push(`Widget configurations are missing ${product.swiftCondition}.`);
  }

  if (appEntitlementsRel !== product.appEntitlements) {
    errors.push(`Unexpected app entitlements path: expected ${product.appEntitlements}, got ${appEntitlementsRel}`);
  }
  if (widgetEntitlementsRel !== product.widgetEntitlements) {
    errors.push(`Unexpected widget entitlements path: expected ${product.widgetEntitlements}, got ${widgetEntitlementsRel}`);
  }

  const schemePath = path.join(
    iosAppDirectory,
    "App.xcodeproj",
    "xcshareddata",
    "xcschemes",
    `${product.displayName}.xcscheme`,
  );
  const schemeContents = await fs.readFile(schemePath, "utf8");
  if (!new RegExp(`buildConfiguration\\s*=\\s*"${product.debugConfiguration}"`).test(schemeContents)) {
    errors.push(`${product.displayName} scheme does not use ${product.debugConfiguration} for development.`);
  }
  if (!new RegExp(`buildConfiguration\\s*=\\s*"${product.releaseConfiguration}"`).test(schemeContents)) {
    errors.push(`${product.displayName} scheme does not use ${product.releaseConfiguration} for release/archive.`);
  }
  if (!new RegExp(`storeKitConfigurationFile\\s*=\\s*"${escapeRegex(product.storeKitFile)}"`).test(schemeContents)) {
    errors.push(`${product.displayName} scheme does not use ${product.storeKitFile}.`);
  }

  const parameterizedInfoPlist = await fs.readFile(path.join(iosAppDirectory, "App", "Info.plist"), "utf8");
  for (const requiredVariable of [
    "$(PRODUCT_DISPLAY_NAME)",
    "$(PRODUCT_BUNDLE_IDENTIFIER)",
    "$(PRODUCT_URL_SCHEME)",
    "$(PRODUCT_LAUNCH_STORYBOARD)",
  ]) {
    if (!parameterizedInfoPlist.includes(requiredVariable)) {
      errors.push(`App Info.plist is missing ${requiredVariable}.`);
    }
  }

  const requiredNativeAssets = [
    path.join(iosAppDirectory, "App", "Assets.xcassets", `${product.appIcon}.appiconset`, "Contents.json"),
    path.join(iosAppDirectory, "App", `${product.launchStoryboard}.storyboard`),
    path.join(iosAppDirectory, product.storeKitFile),
  ];
  const nativeAssetChecks = await Promise.allSettled(requiredNativeAssets.map((assetPath) => fs.access(assetPath)));
  nativeAssetChecks.forEach((result, index) => {
    if (result.status === "rejected") {
      errors.push(`Missing native release asset: ${requiredNativeAssets[index]}`);
    }
  });

  const appIconDirectory = path.join(
    iosAppDirectory,
    "App",
    "Assets.xcassets",
    `${product.appIcon}.appiconset`,
  );
  const appIconContents = JSON.parse(
    await fs.readFile(path.join(appIconDirectory, "Contents.json"), "utf8"),
  );
  const appIconFilename = appIconContents.images?.find((image) => image.filename)?.filename;
  if (!appIconFilename) {
    errors.push(`${product.displayName} app icon catalog does not declare an icon file.`);
  } else {
    const appIconMetadata = await sharp(path.join(appIconDirectory, appIconFilename)).metadata();
    if (appIconMetadata.hasAlpha) {
      errors.push(`${product.displayName} App Store icon must be opaque and cannot contain an alpha channel.`);
    }
  }

  if (errors.length > 0) {
    fail(errors);
  }

  log(`App bundle ID: ${appBundleId}`);
  log(`Widget bundle ID: ${widgetBundleId}`);
  log(`Shared CURRENT_PROJECT_VERSION: ${appBuildVersion}`);
  log(`Shared MARKETING_VERSION: ${appMarketingVersion}`);
  log(`App entitlements: ${appEntitlementsRel}`);
  log(`Widget entitlements: ${widgetEntitlementsRel}`);
  log(`Shared app groups: ${sharedGroups.join(", ")}`);
  log(`${product.displayName} widget signing/capability checks passed.`);
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail([message]);
});
