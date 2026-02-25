#!/usr/bin/env node

/**
 * fix-widget-config.js
 * 
 * Automatically fixes CosmiqWidgetExtension build settings after `npx cap sync ios`.
 * This prevents the recurring Info.plist build failures by ensuring:
 * - GENERATE_INFOPLIST_FILE = NO
 * - INFOPLIST_FILE = ../CosmiqWidget/Info.plist
 */

const fs = require('fs');
const path = require('path');

const PROJECT_FILE = path.join(__dirname, '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const APP_BUNDLE_ID = 'com.darrylgraham.revolution';
const WIDGET_BUNDLE_ID = 'com.darrylgraham.revolution.CosmiqWidget';
const INFO_PLIST_PATH = '../CosmiqWidget/Info.plist';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findConfigBlocksByBundleId(lines, bundleId) {
  const bundleRegex = new RegExp(
    `PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*["']?${escapeRegex(bundleId)}["']?;`,
  );
  const configBlocks = [];

  for (let i = 0; i < lines.length; i++) {
    if (!bundleRegex.test(lines[i])) {
      continue;
    }

    let startIdx = i;
    for (let j = i; j >= 0; j--) {
      if (/^\s*\w+\s*\/\*\s*(Debug|Release)\s*\*\/\s*=\s*\{/.test(lines[j])) {
        startIdx = j;
        break;
      }
    }

    let endIdx = i;
    let depth = 0;
    let started = false;
    for (let j = startIdx; j < lines.length; j++) {
      for (const char of lines[j]) {
        if (char === '{') {
          started = true;
          depth++;
        } else if (char === '}') {
          depth--;
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
    .filter((block, index, self) => index === self.findIndex((b) => b.start === block.start && b.end === block.end))
    .sort((a, b) => b.start - a.start);
}

function findCurrentProjectVersion(lines, blocks) {
  for (const block of blocks) {
    const blockLines = lines.slice(block.start, block.end + 1);
    const versionLine = blockLines.find((line) => /^\s*CURRENT_PROJECT_VERSION\s*=/.test(line));
    if (!versionLine) {
      continue;
    }
    const match = versionLine.match(/CURRENT_PROJECT_VERSION\s*=\s*([^;]+);/);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

function fixWidgetConfig() {
  console.log('\n🔧 Fixing CosmiqWidgetExtension configuration...\n');

  // Check if project file exists
  if (!fs.existsSync(PROJECT_FILE)) {
    console.log('⚠️  project.pbxproj not found. Run this after `npx cap add ios`.');
    return;
  }

  const content = fs.readFileSync(PROJECT_FILE, 'utf8');
  const lines = content.split('\n');
  const changes = [];
  const appBlocks = findConfigBlocksByBundleId(lines, APP_BUNDLE_ID);
  const widgetBlocks = findConfigBlocksByBundleId(lines, WIDGET_BUNDLE_ID);
  const appProjectVersion = findCurrentProjectVersion(lines, appBlocks);

  for (const block of widgetBlocks) {
    const blockLines = lines.slice(block.start, block.end + 1);
    const buildSettingsIndex = blockLines.findIndex((line) => line.includes('buildSettings = {'));
    if (buildSettingsIndex < 0) {
      continue;
    }

    const defaultIndent = '\t\t\t\t';
    const existingIndentLine =
      blockLines.find((line) => /^\s*INFOPLIST_FILE\s*=/.test(line)) ??
      blockLines.find((line) => /^\s*GENERATE_INFOPLIST_FILE\s*=/.test(line)) ??
      blockLines.find((line) => /^\s*CURRENT_PROJECT_VERSION\s*=/.test(line));
    const indent = existingIndentLine ? existingIndentLine.match(/^\s*/)[0] : defaultIndent;

    const infoPlistLine = `${indent}INFOPLIST_FILE = ${INFO_PLIST_PATH};`;
    const generateInfoPlistLine = `${indent}GENERATE_INFOPLIST_FILE = NO;`;

    const infoIndex = blockLines.findIndex((line) => /^\s*INFOPLIST_FILE\s*=/.test(line));
    if (infoIndex >= 0) {
      if (blockLines[infoIndex] !== infoPlistLine) {
        blockLines[infoIndex] = infoPlistLine;
        changes.push('  ✓ Set INFOPLIST_FILE = ../CosmiqWidget/Info.plist');
      }
    } else {
      blockLines.splice(buildSettingsIndex + 1, 0, infoPlistLine);
      changes.push('  ✓ Added INFOPLIST_FILE = ../CosmiqWidget/Info.plist');
    }

    const generateIndex = blockLines.findIndex((line) => /^\s*GENERATE_INFOPLIST_FILE\s*=/.test(line));
    if (generateIndex >= 0) {
      if (blockLines[generateIndex] !== generateInfoPlistLine) {
        blockLines[generateIndex] = generateInfoPlistLine;
        changes.push('  ✓ Set GENERATE_INFOPLIST_FILE = NO');
      }
    } else {
      blockLines.splice(buildSettingsIndex + 1, 0, generateInfoPlistLine);
      changes.push('  ✓ Added GENERATE_INFOPLIST_FILE = NO');
    }

    if (appProjectVersion) {
      const currentProjectVersionLine = `${indent}CURRENT_PROJECT_VERSION = ${appProjectVersion};`;
      const versionIndex = blockLines.findIndex((line) => /^\s*CURRENT_PROJECT_VERSION\s*=/.test(line));
      if (versionIndex >= 0) {
        if (blockLines[versionIndex] !== currentProjectVersionLine) {
          blockLines[versionIndex] = currentProjectVersionLine;
          changes.push(`  ✓ Set CURRENT_PROJECT_VERSION = ${appProjectVersion}`);
        }
      } else {
        blockLines.splice(buildSettingsIndex + 1, 0, currentProjectVersionLine);
        changes.push(`  ✓ Added CURRENT_PROJECT_VERSION = ${appProjectVersion}`);
      }
    }

    lines.splice(block.start, block.end - block.start + 1, ...blockLines);
  }

  const modified = lines.join('\n');
  if (modified !== content) {
    fs.writeFileSync(PROJECT_FILE, modified, 'utf8');
    console.log('📝 Changes made to project.pbxproj:');
    [...new Set(changes)].forEach((change) => console.log(change));
    console.log('\n✅ Widget configuration fixed successfully!\n');
  } else if (widgetBlocks.length > 0) {
    console.log('✅ Widget configuration already correct. No changes needed.\n');
  } else {
    console.log('⚠️  Could not find CosmiqWidgetExtension configuration blocks.');
    console.log('   Make sure the widget extension exists in your Xcode project.\n');
  }

  if (!appProjectVersion) {
    console.log('⚠️  Could not infer app CURRENT_PROJECT_VERSION from App target blocks.');
  }
}

// Run the fix
fixWidgetConfig();
