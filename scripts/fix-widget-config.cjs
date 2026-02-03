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

function fixWidgetConfig() {
  console.log('\n🔧 Fixing CosmiqWidgetExtension configuration...\n');

  // Check if project file exists
  if (!fs.existsSync(PROJECT_FILE)) {
    console.log('⚠️  project.pbxproj not found. Run this after `npx cap add ios`.');
    return;
  }

  let content = fs.readFileSync(PROJECT_FILE, 'utf8');
  let changes = [];

  // Find all build configuration blocks for the widget
  // These are identified by containing the widget bundle identifier
  const buildConfigRegex = /(\w+)\s*\/\*\s*(Debug|Release)\s*\*\/\s*=\s*\{[^}]*PRODUCT_BUNDLE_IDENTIFIER\s*=\s*["']?com\.darrylgraham\.revolution\.CosmiqWidget["']?[^}]*\}/g;
  
  // Alternative approach: Find build settings blocks and fix them
  // Split content into sections and process each
  
  let modified = content;
  
  // Pattern to match build configuration blocks containing our widget bundle ID
  // We need to find blocks that have PRODUCT_BUNDLE_IDENTIFIER = com.darrylgraham.revolution.CosmiqWidget
  // and ensure they have the correct GENERATE_INFOPLIST_FILE and INFOPLIST_FILE settings
  
  const lines = content.split('\n');
  let inWidgetConfig = false;
  let braceCount = 0;
  let configStartIndex = -1;
  let configBlocks = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line contains the widget bundle identifier
    if (line.includes(WIDGET_BUNDLE_ID)) {
      // Walk backwards to find the start of this build settings block
      let startIdx = i;
      let depth = 0;
      for (let j = i; j >= 0; j--) {
        if (lines[j].includes('{')) depth++;
        if (lines[j].includes('}')) depth--;
        if (lines[j].includes('buildSettings') && lines[j].includes('=')) {
          startIdx = j;
          break;
        }
        // Also check for config block start pattern like "ABC123 /* Debug */ = {"
        if (/^\s*\w+\s*\/\*\s*(Debug|Release)\s*\*\/\s*=\s*\{/.test(lines[j])) {
          startIdx = j;
          break;
        }
      }
      
      // Walk forward to find the end of this build settings block
      let endIdx = i;
      depth = 0;
      let foundStart = false;
      for (let j = startIdx; j < lines.length; j++) {
        for (const char of lines[j]) {
          if (char === '{') {
            foundStart = true;
            depth++;
          }
          if (char === '}') depth--;
        }
        if (foundStart && depth === 0) {
          endIdx = j;
          break;
        }
      }
      
      configBlocks.push({ start: startIdx, end: endIdx });
    }
  }
  
  // Remove duplicates
  const uniqueBlocks = configBlocks.filter((block, index, self) =>
    index === self.findIndex(b => b.start === block.start && b.end === block.end)
  );
  
  // Process each block
  for (const block of uniqueBlocks) {
    let blockContent = lines.slice(block.start, block.end + 1).join('\n');
    let originalBlock = blockContent;
    
    // Check and fix GENERATE_INFOPLIST_FILE
    if (blockContent.includes('GENERATE_INFOPLIST_FILE = YES')) {
      blockContent = blockContent.replace(
        /GENERATE_INFOPLIST_FILE\s*=\s*YES/g,
        'GENERATE_INFOPLIST_FILE = NO'
      );
      changes.push('  ✓ Set GENERATE_INFOPLIST_FILE = NO');
    } else if (!blockContent.includes('GENERATE_INFOPLIST_FILE')) {
      // Add the setting if it doesn't exist (add before the closing brace of buildSettings)
      blockContent = blockContent.replace(
        /(buildSettings\s*=\s*\{)/,
        '$1\n\t\t\t\tGENERATE_INFOPLIST_FILE = NO;'
      );
      changes.push('  ✓ Added GENERATE_INFOPLIST_FILE = NO');
    }
    
    // Check and fix INFOPLIST_FILE
    const correctInfoPlist = '../CosmiqWidget/Info.plist';
    const infoPlistRegex = /INFOPLIST_FILE\s*=\s*["']?([^;"'\n]+)["']?/;
    const match = blockContent.match(infoPlistRegex);
    
    if (match) {
      const currentValue = match[1].trim();
      if (currentValue !== correctInfoPlist) {
        blockContent = blockContent.replace(
          infoPlistRegex,
          `INFOPLIST_FILE = "${correctInfoPlist}"`
        );
        changes.push(`  ✓ Fixed INFOPLIST_FILE: "${currentValue}" → "${correctInfoPlist}"`);
      }
    } else {
      // Add the setting if it doesn't exist
      blockContent = blockContent.replace(
        /(buildSettings\s*=\s*\{)/,
        `$1\n\t\t\t\tINFOPLIST_FILE = "${correctInfoPlist}";`
      );
      changes.push(`  ✓ Added INFOPLIST_FILE = "${correctInfoPlist}"`);
    }
    
    // Replace the block in the full content if changed
    if (blockContent !== originalBlock) {
      modified = modified.replace(originalBlock, blockContent);
    }
  }
  
  // Write changes if any were made
  if (modified !== content) {
    fs.writeFileSync(PROJECT_FILE, modified, 'utf8');
    console.log('📝 Changes made to project.pbxproj:');
    // Remove duplicate messages
    const uniqueChanges = [...new Set(changes)];
    uniqueChanges.forEach(change => console.log(change));
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
