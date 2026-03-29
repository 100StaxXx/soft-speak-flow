#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rawArgs = process.argv.slice(2);
const scanStaged = rawArgs.includes("--staged");
const explicitFiles = rawArgs.filter((arg) => !arg.startsWith("--"));

const ignoredPathMatchers = [
  /(^|\/)\.git\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
  /(^|\/)tmp\//,
  /(^|\/)output\//,
  /(^|\/)ios\/App\/build[^/]*\//,
];

const trackedOutputPrefixes = [
  "docs/",
  "src/",
  "supabase/",
  "scripts/",
  ".github/",
  ".githooks/",
  "README",
  ".env",
  "package.json",
];

const secretEnvNames = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "INTERNAL_FUNCTION_SECRET",
  "OPENAI_API_KEY",
  "ELEVENLABS_API_KEY",
  "RESEND_API_KEY",
  "PAYPAL_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "OUTLOOK_CLIENT_SECRET",
  "APPLE_PRIVATE_KEY",
  "APNS_AUTH_KEY",
  "FIREBASE_SERVICE_ACCOUNT",
  "INFLUENCER_DASHBOARD_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "APPLE_SHARED_SECRET",
  "VAPID_PRIVATE_KEY",
]);

const placeholderSnippets = [
  "__set_in_supabase_secrets__",
  "your-",
  "your_",
  "example",
  "placeholder",
  "changeme",
  "replace-me",
  "replace_with",
  "dummy",
  "fake",
  "test",
  "sk-...",
  "sb_publishable_",
  "sb_secret_example",
  "-----begin private key-----\\n...keep in supabase secrets...\\n-----end private key-----",
];

const runtimeReferencePatterns = [
  /^\$\{\{\s*secrets\./i,
  /^\$\{?[A-Z0-9_]+\}?$/i,
  /^\$\{.+\}$/i,
  /^process\.env\./,
  /^Deno\.env\.get\(/,
  /^import\.meta\.env\./,
  /^os\.getenv\(/,
  /^requireEnv\(/,
];

const tokenPatterns = [
  {
    label: "Supabase secret key literal",
    regex: /(?<![A-Za-z0-9_])sb_secret_[A-Za-z0-9._-]{20,}(?![A-Za-z0-9._-])/g,
  },
  {
    label: "OpenAI API key literal",
    regex: /(?<![A-Za-z0-9_])sk-(?:proj-)?[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/g,
  },
  {
    label: "AWS access key literal",
    regex: /(?<![A-Za-z0-9_])AKIA[0-9A-Z]{16}(?![A-Za-z0-9_])/g,
  },
  {
    label: "GitHub token literal",
    regex: /(?<![A-Za-z0-9_])ghp_[A-Za-z0-9]{20,}(?![A-Za-z0-9])/g,
  },
  {
    label: "Google API key literal",
    regex: /(?<![A-Za-z0-9_])AIza[0-9A-Za-z\-_]{35}(?![A-Za-z0-9\-_])/g,
  },
  {
    label: "Slack token literal",
    regex: /(?<![A-Za-z0-9_])xox[baprs]-[A-Za-z0-9-]{10,}(?![A-Za-z0-9-])/g,
  },
  {
    label: "Slack webhook URL",
    regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g,
  },
  {
    label: "Discord webhook URL",
    regex: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[A-Za-z0-9/_-]+/g,
  },
];

function runGit(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function listCandidateFiles() {
  if (explicitFiles.length > 0) {
    return explicitFiles;
  }

  const output = scanStaged
    ? runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
    : runGit(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);

  return output
    .split("\0")
    .map((file) => file.trim())
    .filter(Boolean);
}

function isIgnoredPath(filePath) {
  if (!trackedOutputPrefixes.some((prefix) => filePath === prefix || filePath.startsWith(prefix))) {
    return true;
  }

  return ignoredPathMatchers.some((matcher) => matcher.test(filePath));
}

function readFileContent(filePath) {
  if (scanStaged) {
    try {
      return execFileSync("git", ["show", `:${filePath}`], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
    return null;
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function looksBinary(text) {
  return text.includes("\u0000");
}

function normalizeAssignedValue(rawValue) {
  return rawValue
    .trim()
    .replace(/^[("'`]+/, "")
    .replace(/[)"'`,;]+$/, "")
    .trim();
}

function isPlaceholderValue(value) {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return true;
  if (normalized === "null" || normalized === "undefined") return true;

  return placeholderSnippets.some((snippet) => normalized.includes(snippet));
}

function isRuntimeReference(value) {
  if (value.includes("${")) {
    return true;
  }

  return runtimeReferencePatterns.some((pattern) => pattern.test(value.trim()));
}

function scanAssignments(filePath, content, findings) {
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^\s*["']?([A-Z][A-Z0-9_]+)["']?\s*[:=]\s*(.+?)\s*$/);
    if (!match) continue;

    const [, name, rawValue] = match;
    if (!secretEnvNames.has(name)) continue;

    const value = normalizeAssignedValue(rawValue);
    if (isPlaceholderValue(value) || isRuntimeReference(value)) continue;

    findings.push({
      filePath,
      lineNumber: index + 1,
      label: `Hard-coded ${name}`,
      excerpt: line.trim().slice(0, 160),
    });
  }
}

function scanMultilineSecrets(filePath, content, findings) {
  const privateKeyMatch = content.match(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
  if (privateKeyMatch) {
    if (filePath === "scripts/scan-secrets.mjs") {
      return;
    }

    const contextWindow = content
      .slice(Math.max(0, privateKeyMatch.index - 120), Math.min(content.length, privateKeyMatch.index + 220))
      .toLowerCase();
    if (
      contextWindow.includes("keep in supabase secrets") ||
      contextWindow.includes("placeholder") ||
      contextWindow.includes("example")
    ) {
      return;
    }

    const preceding = content.slice(0, privateKeyMatch.index);
    const lineNumber = preceding.split(/\r?\n/).length;
    findings.push({
      filePath,
      lineNumber,
      label: "Private key block",
      excerpt: "-----BEGIN PRIVATE KEY-----",
    });
  }
}

function scanTokenPatterns(filePath, content, findings) {
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const { label, regex } of tokenPatterns) {
      regex.lastIndex = 0;
      const match = regex.exec(line);
      if (!match) continue;
      if (isPlaceholderValue(match[0])) continue;

      findings.push({
        filePath,
        lineNumber: index + 1,
        label,
        excerpt: line.trim().slice(0, 160),
      });
    }

    if (/\bWEBHOOK\b/.test(line) && /https?:\/\//.test(line) && !isPlaceholderValue(line)) {
      findings.push({
        filePath,
        lineNumber: index + 1,
        label: "Webhook URL literal",
        excerpt: line.trim().slice(0, 160),
      });
    }
  }
}

const files = listCandidateFiles()
  .filter((filePath) => !isIgnoredPath(filePath));

const findings = [];

for (const filePath of files) {
  const content = readFileContent(filePath);
  if (!content || looksBinary(content)) continue;

  scanAssignments(filePath, content, findings);
  scanMultilineSecrets(filePath, content, findings);
  scanTokenPatterns(filePath, content, findings);
}

if (findings.length === 0) {
  console.log(`Secret scan passed (${files.length} files checked).`);
  process.exit(0);
}

console.error("Secret scan failed. Remove or rotate the following findings:");
for (const finding of findings) {
  console.error(
    `- ${finding.filePath}:${finding.lineNumber} ${finding.label}\n  ${finding.excerpt}`,
  );
}

process.exit(1);
