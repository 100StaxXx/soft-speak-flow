
# Automated Widget Fix Script

## Overview
Create a post-sync script that automatically restores the CosmiqWidgetExtension configuration after running `npx cap sync ios`. This prevents the recurring build failures you've been experiencing with Info.plist settings.

## What the Script Will Do
1. Run after every `cap sync ios` command
2. Scan the Xcode project file for widget build settings
3. Ensure `GENERATE_INFOPLIST_FILE = NO` is set
4. Ensure `INFOPLIST_FILE = ../CosmiqWidget/Info.plist` is correctly set
5. Print a confirmation message showing what was fixed

## Implementation Steps

### Step 1: Create the fix-widget script
Create a new file `scripts/fix-widget-config.js` that:
- Reads the `ios/App/App.xcodeproj/project.pbxproj` file
- Uses regex to find and fix the CosmiqWidgetExtension build configurations
- Writes the corrected file back
- Logs what was changed

### Step 2: Update npm scripts
Modify `package.json` to chain the fix script after sync:

```text
Current:
  "ios:sync": "cd ios/App && npx cap sync ios"
  "ios:testflight": "npm run build && npm run ios:sync && node scripts/open-xcode.js"

Updated:
  "ios:sync": "npx cap sync ios && node scripts/fix-widget-config.js"
  "ios:testflight": "npm run build && npm run ios:sync && node scripts/open-xcode.js"
```

### Step 3: Enhance open-xcode.js (optional)
Add a verification step that checks widget config before opening Xcode.

## Technical Details

The script will target these specific patterns in project.pbxproj:

```text
For CosmiqWidgetExtension Debug and Release configurations:
  - Find: GENERATE_INFOPLIST_FILE = YES (or missing)
  - Replace: GENERATE_INFOPLIST_FILE = NO

  - Find: INFOPLIST_FILE = "" (or incorrect path)
  - Replace: INFOPLIST_FILE = ../CosmiqWidget/Info.plist
```

The script will identify widget configurations by looking for blocks containing `PRODUCT_BUNDLE_IDENTIFIER = com.darrylgraham.revolution.CosmiqWidget`.

## Usage After Implementation
After this is set up, your workflow becomes:
1. Pull latest code: `git pull`
2. Run sync (automatically fixes widget): `npm run ios:sync`
3. Build in Xcode - no manual fixes needed!

## Files to Create/Modify
| File | Action |
|------|--------|
| `scripts/fix-widget-config.js` | Create new script |
| `package.json` | Update ios:sync command |
