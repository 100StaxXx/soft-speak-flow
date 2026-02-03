
# Fix Widget Extension Info.plist for App Store Submission

## Problem Summary

The App Store upload is failing with:
> "Missing Info.plist value. The Info.plist at 'App.app/Plugins/CosmiqWidgetExtension.appex' is missing a required value... must contain a value for the NSExtensionPointIdentifier key within the NSExtension dictionary."

**Root cause**: The widget extension uses `GENERATE_INFOPLIST_FILE = YES` which auto-generates a basic Info.plist, but WidgetKit extensions require a specific `NSExtension` dictionary that Xcode's auto-generation doesn't include properly.

## Solution

I'll create an explicit `Info.plist` file for the widget extension and update the project configuration to use it.

## Changes

### 1. Create: `ios/CosmiqWidget/Info.plist`

A proper WidgetKit Info.plist containing:

- **NSExtension dictionary** with:
  - `NSExtensionPointIdentifier` = `com.apple.widgetkit-extension` (required for WidgetKit)
- Standard bundle keys (display name, version, etc.)

### 2. Update: `ios/App/App.xcodeproj/project.pbxproj`

Modify the widget build settings:

- Change `GENERATE_INFOPLIST_FILE` from `YES` to `NO`
- Set `INFOPLIST_FILE` to point to `../CosmiqWidget/Info.plist`
- Add the Info.plist file reference to the project

## After Implementation

1. Pull the changes: `git pull`
2. Clear Derived Data: `rm -rf ~/Library/Developer/Xcode/DerivedData/*`
3. Reopen Xcode and Archive the **App** scheme
4. Upload to App Store Connect - the validation error should be resolved

---

## Technical Details

The Info.plist will contain the critical `NSExtension` dictionary:

```text
NSExtension
├── NSExtensionPointIdentifier: com.apple.widgetkit-extension
```

This tells iOS that this extension is a WidgetKit widget and should be processed accordingly. Without this key, App Store validation rejects the binary.

The file reference will be added to the CosmiqWidget group in the project navigator, making it visible alongside the Swift files.
