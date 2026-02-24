#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const iosAppDirectory = path.join(projectRoot, "ios", "App");
const xcodeProjectPath = path.join(iosAppDirectory, "App.xcodeproj");

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

const parseBuildSettings = (stdout) => {
  const settings = {};
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (!match) {
      continue;
    }
    settings[match[1]] = match[2].trim();
  }
  return settings;
};

const loadBuildSettings = async (target) => {
  try {
    const { stdout } = await execFileAsync(
      "xcodebuild",
      [
        "-project",
        xcodeProjectPath,
        "-target",
        target,
        "-configuration",
        "Debug",
        "-showBuildSettings",
      ],
      {
        cwd: projectRoot,
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    return parseBuildSettings(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load build settings for target "${target}": ${message}`);
  }
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

const requireBuildSetting = (settings, key, target, errors) => {
  const value = settings[key];
  if (!value) {
    errors.push(`Missing ${key} for target ${target}`);
    return null;
  }
  return value;
};

const run = async () => {
  const errors = [];

  log(`Reading build settings from ${xcodeProjectPath}`);
  const [appSettings, widgetSettings] = await Promise.all([
    loadBuildSettings(APP_TARGET),
    loadBuildSettings(WIDGET_TARGET),
  ]);

  const appBundleId = requireBuildSetting(appSettings, "PRODUCT_BUNDLE_IDENTIFIER", APP_TARGET, errors);
  const widgetBundleId = requireBuildSetting(
    widgetSettings,
    "PRODUCT_BUNDLE_IDENTIFIER",
    WIDGET_TARGET,
    errors,
  );
  const appTeam = requireBuildSetting(appSettings, "DEVELOPMENT_TEAM", APP_TARGET, errors);
  const widgetTeam = requireBuildSetting(widgetSettings, "DEVELOPMENT_TEAM", WIDGET_TARGET, errors);
  const appEntitlementsRel = requireBuildSetting(
    appSettings,
    "CODE_SIGN_ENTITLEMENTS",
    APP_TARGET,
    errors,
  );
  const widgetEntitlementsRel = requireBuildSetting(
    widgetSettings,
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
    errors.push(
      `Widget bundle identifier ${widgetBundleId} does not share app prefix ${appBundleId}.`,
    );
  }

  if (appTeam && widgetTeam && appTeam !== widgetTeam) {
    errors.push(`DEVELOPMENT_TEAM mismatch: app=${appTeam}, widget=${widgetTeam}`);
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
    errors.push(
      `App entitlements file is missing or unreadable: ${appEntitlementsPath}`,
    );
  }

  if (entitlementChecks[1].status === "rejected") {
    errors.push(
      `Widget entitlements file is missing or unreadable: ${widgetEntitlementsPath}`,
    );
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
  log(`Shared DEVELOPMENT_TEAM: ${appTeam}`);
  log(`App entitlements: ${appEntitlementsRel}`);
  log(`Widget entitlements: ${widgetEntitlementsRel}`);
  log(`Shared app groups: ${sharedGroups.join(", ")}`);
  log("Widget signing/capability checks passed.");
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail([message]);
});
