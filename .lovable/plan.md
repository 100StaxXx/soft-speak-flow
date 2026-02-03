

# Automated Widget Fix Script

## Overview
Creating a post-sync script that automatically restores the CosmiqWidgetExtension configuration after running `npx cap sync ios`. This will prevent the recurring Info.plist build failures.

## Files to Create/Modify

### 1. Create `scripts/fix-widget-config.js` (New File)
A Node.js script that:
- Reads `ios/App/App.xcodeproj/project.pbxproj`
- Finds CosmiqWidgetExtension build configurations (identified by `PRODUCT_BUNDLE_IDENTIFIER = com.darrylgraham.revolution.CosmiqWidget`)
- Sets `GENERATE_INFOPLIST_FILE = NO` 
- Sets `INFOPLIST_FILE = ../CosmiqWidget/Info.plist`
- Logs what was fixed

### 2. Update `package.json`
Change the ios:sync script from:
```text
"ios:sync": "cd ios/App && npx cap sync ios"
```
To:
```text
"ios:sync": "npx cap sync ios && node scripts/fix-widget-config.js"
```

## How It Works
The script runs automatically after every `cap sync ios` and ensures the widget settings are correct, regardless of what Capacitor does during sync.

## Your New Workflow
1. `git pull` - Get latest code
2. `npm run ios:sync` - Sync AND auto-fix widget config
3. Open Xcode and build - No manual fixes needed!

## Safety
- The script only ensures correct values are set
- If settings are already correct, it simply confirms they're good
- Your current successful upload is not affected - this prevents future issues

