#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const iosAppDirectory = path.join(projectRoot, "ios", "App");
const xcodeProjectPath = path.join(iosAppDirectory, "App.xcodeproj", "project.pbxproj");

const APP_TARGET = "App";
const WIDGET_TARGET = "CosmiqWidgetExtension";
const EXPECTED_APP_GROUP = "group.com.darrylgraham.revolution";
const EXPECTED_APP_BUNDLE_ID = "com.darrylgraham.revolution";
const EXPECTED_WIDGET_BUNDLE_ID = "com.darrylgraham.revolution.CosmiqWidget";
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
      if (/^\s*\w+\s*\/\*\s*(Debug|Release)\s*\*\/\s*=\s*\{/.test(lines[j])) {
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

const parseEntitlementAppGroups = async (entitlementsPath) => {
  let xml;
  try {
    xml = await fs.readFile(entitlementsPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read entitlements file ${entitlementsPath}: ${message}`);
  }

  const keyMatch = xml.match(
    /<key>\s*com\.apple\.security\.application-groups\s*<\/key>\s*<array>([\s\S]*?)<\/array>/,
  );
  if (!keyMatch) {
    return [];
  }

  return Array.from(keyMatch[1].matchAll(/<string>\s*([^<\s][^<]*)\s*<\/string>/g)).map((match) =>
    match[1].trim(),
  );
};

const run = async () => {
  const errors = [];
  const pbxprojContent = await fs.readFile(xcodeProjectPath, "utf8");
  const lines = pbxprojContent.split(/\r?\n/);

  const appSettingsByConfig = collectTargetSettings(lines, EXPECTED_APP_BUNDLE_ID, APP_TARGET, errors);
  const widgetSettingsByConfig = collectTargetSettings(
    lines,
    EXPECTED_WIDGET_BUNDLE_ID,
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

  if (appBundleId && appBundleId !== EXPECTED_APP_BUNDLE_ID) {
    errors.push(
      `Unexpected app bundle identifier: expected ${EXPECTED_APP_BUNDLE_ID}, got ${appBundleId}`,
    );
  }

  if (widgetBundleId && widgetBundleId !== EXPECTED_WIDGET_BUNDLE_ID) {
    errors.push(
      `Unexpected widget bundle identifier: expected ${EXPECTED_WIDGET_BUNDLE_ID}, got ${widgetBundleId}`,
    );
  }

  if (appBundleId && widgetBundleId && !widgetBundleId.startsWith(`${appBundleId}.`)) {
    errors.push(`Widget bundle identifier ${widgetBundleId} does not share app prefix ${appBundleId}.`);
  }

  if (appBuildVersion && widgetBuildVersion && appBuildVersion !== widgetBuildVersion) {
    errors.push(`CURRENT_PROJECT_VERSION mismatch: app=${appBuildVersion}, widget=${widgetBuildVersion}`);
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

  const [appGroups, widgetGroups] = await Promise.all([
    parseEntitlementAppGroups(appEntitlementsPath),
    parseEntitlementAppGroups(widgetEntitlementsPath),
  ]);

  if (!appGroups.includes(EXPECTED_APP_GROUP)) {
    errors.push(
      `Expected app group ${EXPECTED_APP_GROUP} missing in app entitlements (${appEntitlementsPath})`,
    );
  }

  if (!widgetGroups.includes(EXPECTED_APP_GROUP)) {
    errors.push(
      `Expected app group ${EXPECTED_APP_GROUP} missing in widget entitlements (${widgetEntitlementsPath})`,
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

  if (errors.length > 0) {
    fail(errors);
  }

  log(`App bundle ID: ${appBundleId}`);
  log(`Widget bundle ID: ${widgetBundleId}`);
  log(`Shared CURRENT_PROJECT_VERSION: ${appBuildVersion}`);
  log(`App entitlements: ${appEntitlementsRel}`);
  log(`Widget entitlements: ${widgetEntitlementsRel}`);
  log(`Shared app groups: ${sharedGroups.join(", ")}`);
  log("Widget signing/capability checks passed.");
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail([message]);
});
