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
const WIDGET_BUNDLE_ID = 'com.darrylgraham.revolution.CosmiqWidget';
const INFO_PLIST_PATH = '../CosmiqWidget/Info.plist';

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
  const configBlocks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*["']?com\.darrylgraham\.revolution\.CosmiqWidget["']?;/.test(line)) {
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

  const uniqueBlocks = configBlocks
    .filter((block, index, self) => index === self.findIndex((b) => b.start === block.start && b.end === block.end))
    .sort((a, b) => b.start - a.start);

  for (const block of uniqueBlocks) {
    const blockLines = lines.slice(block.start, block.end + 1);
    const buildSettingsIndex = blockLines.findIndex((line) => line.includes('buildSettings = {'));
    if (buildSettingsIndex < 0) {
      continue;
    }

    const defaultIndent = '\t\t\t\t';
    const existingIndentLine =
      blockLines.find((line) => /^\s*INFOPLIST_FILE\s*=/.test(line)) ??
      blockLines.find((line) => /^\s*GENERATE_INFOPLIST_FILE\s*=/.test(line));
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

    lines.splice(block.start, block.end - block.start + 1, ...blockLines);
  }

  const modified = lines.join('\n');
  if (modified !== content) {
    fs.writeFileSync(PROJECT_FILE, modified, 'utf8');
    console.log('📝 Changes made to project.pbxproj:');
    [...new Set(changes)].forEach((change) => console.log(change));
    console.log('\n✅ Widget configuration fixed successfully!\n');
  } else if (uniqueBlocks.length > 0) {
    console.log('✅ Widget configuration already correct. No changes needed.\n');
  } else {
    console.log('⚠️  Could not find CosmiqWidgetExtension configuration blocks.');
    console.log('   Make sure the widget extension exists in your Xcode project.\n');
  }
}

// Run the fix
fixWidgetConfig();
