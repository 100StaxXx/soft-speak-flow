#!/usr/bin/env node

import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const workspacePath = path.join(projectRoot, "ios", "App", "App.xcworkspace");
const scheme = process.env.IOS_SCHEME ?? "App";
const configuration = process.env.IOS_CONFIGURATION ?? "Debug";
const bundleId = process.env.IOS_BUNDLE_ID ?? "com.darrylgraham.revolution";
const derivedDataPath = path.join(projectRoot, "ios", "App", "build-cli-device-smoke");
const appPath = path.join(derivedDataPath, "Build", "Products", "Debug-iphoneos", "App.app");
const coreDeviceTimeoutPattern = /Timed out waiting for CoreDeviceService/i;
const xcodeTransientErrorPatterns = [
  /CoreSimulatorService connection became invalid/i,
  /not a workspace file/i,
  /simdiskimaged/i,
];
const prefix = "[ios:smoke:device]";

const log = (message) => {
  console.log(`${prefix} ${message}`);
};

const fail = (message) => {
  console.error(`${prefix} ${message}`);
  process.exit(1);
};

const shellEscape = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

const runCommand = async (command, args, options = {}) => {
  const shellCommand = [command, ...args].map(shellEscape).join(" ");
  try {
    return await execFileAsync("/bin/zsh", ["-lc", shellCommand], {
      cwd: projectRoot,
      maxBuffer: 50 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout.trim() : "";
    const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
    const parts = [];
    if (stdout) {
      parts.push(`stdout:\n${stdout}`);
    }
    if (stderr) {
      parts.push(`stderr:\n${stderr}`);
    }
    const context = parts.length > 0 ? `\n${parts.join("\n\n")}` : "";
    throw new Error(`${command} ${args.join(" ")} failed.${context}`);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runCommandWithRetry = async (command, args, patterns, retries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runCommand(command, args);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isTransient = patterns.some((pattern) => pattern.test(message));
      if (isTransient && attempt < retries) {
        log(`${command} transient failure (attempt ${attempt}/${retries}). Retrying...`);
        await sleep(2000);
        continue;
      }
      break;
    }
  }
  throw lastError;
};

const runCoreDeviceCommand = async (args, retries = 2) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runCommand("xcrun", args);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (coreDeviceTimeoutPattern.test(message) && attempt < retries) {
        log(`CoreDevice timed out (attempt ${attempt}/${retries}). Retrying...`);
        await sleep(2000);
        continue;
      }
      break;
    }
  }
  throw lastError;
};

const parseIosDestinations = (stdout) => {
  const destinations = [];
  const destinationPattern = /\{\s*platform:iOS(?:,\s*arch:[^,]+)?\s*,\s*id:([^,]+),\s*name:([^}]+)\}/g;
  let match;
  while ((match = destinationPattern.exec(stdout)) !== null) {
    const id = match[1].trim();
    const name = match[2].trim();
    if (name === "Any iOS Device" || id.startsWith("dvtdevice-")) {
      continue;
    }
    destinations.push({ id, name });
  }
  return destinations;
};

const resolveDeviceId = async () => {
  const explicitId = process.env.IOS_DEVICE_ID;
  if (explicitId) {
    log(`Using IOS_DEVICE_ID=${explicitId}`);
    return explicitId;
  }

  const { stdout } = await runCommandWithRetry(
    "xcodebuild",
    [
      "-workspace",
      workspacePath,
      "-scheme",
      scheme,
      "-derivedDataPath",
      derivedDataPath,
      "-showdestinations",
    ],
    xcodeTransientErrorPatterns,
  );

  const destinations = parseIosDestinations(stdout);
  if (destinations.length === 0) {
    throw new Error(
      "No connected physical iOS destination found. Connect and unlock your phone, then retry.",
    );
  }

  const selected = destinations[0];
  log(`Detected device: ${selected.name} (${selected.id})`);
  return selected.id;
};

const run = async () => {
  const deviceId = await resolveDeviceId();

  log("Building app for generic iOS destination...");
  await runCommandWithRetry(
    "xcodebuild",
    [
      "-workspace",
      workspacePath,
      "-scheme",
      scheme,
      "-configuration",
      configuration,
      "-destination",
      "generic/platform=iOS",
      "-derivedDataPath",
      derivedDataPath,
      "build",
    ],
    xcodeTransientErrorPatterns,
  );

  log(`Installing app on device ${deviceId}...`);
  await runCoreDeviceCommand([
    "devicectl",
    "device",
    "install",
    "app",
    "--device",
    deviceId,
    appPath,
  ]);

  log(`Launching ${bundleId} on device ${deviceId}...`);
  await runCoreDeviceCommand([
    "devicectl",
    "device",
    "process",
    "launch",
    "--device",
    deviceId,
    bundleId,
    "--terminate-existing",
  ]);

  log("Device smoke test passed.");
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
