

# Fix iOS Widget Extension Project Configuration

## Problem Summary

The `project.pbxproj` file is missing the entire **CosmiqWidgetExtension** target configuration. This is causing:
- Duplicate file references (CosmiqWidget 2, 3, 4...)
- Broken file references (yellow "?" icons)
- Widget extension not building properly

The widget source files exist in `ios/CosmiqWidget/` but they're not properly linked in the Xcode project file.

## Solution

I'll generate a complete, clean `project.pbxproj` file that includes:

1. **Widget Extension Target** - Full `PBXNativeTarget` for CosmiqWidgetExtension
2. **File References** - Properly linked references to all 4 widget files:
   - `CosmiqWidget.swift`
   - `WidgetData.swift`  
   - `WidgetViews.swift`
   - `CosmiqWidget.entitlements`
3. **Build Phases** - Sources and Resources phases for the widget
4. **Build Settings** - Correct bundle ID, entitlements path, deployment target
5. **App Groups** - Properly configured for data sharing
6. **Target Dependency** - Widget embedded in main app

## Changes

### File: `ios/App/App.xcodeproj/project.pbxproj`

Complete replacement with properly configured widget extension:

**New sections to add:**
- `PBXBuildFile` entries for widget Swift files
- `PBXFileReference` entries for widget files and `.appex` product
- `PBXGroup` for CosmiqWidget folder
- `PBXNativeTarget` for CosmiqWidgetExtension
- `PBXContainerItemProxy` for target dependency
- `PBXTargetDependency` to embed widget in app
- `PBXCopyFilesBuildPhase` to embed extension
- `XCBuildConfiguration` for widget Debug/Release
- `XCConfigurationList` for widget target

**Key build settings:**
```text
PRODUCT_BUNDLE_IDENTIFIER = com.darrylgraham.revolution.CosmiqWidget
CODE_SIGN_ENTITLEMENTS = ../CosmiqWidget/CosmiqWidget.entitlements
INFOPLIST_GENERATION = YES (auto-generate Info.plist)
SWIFT_EMIT_LOC_STRINGS = YES
GENERATE_INFOPLIST_FILE = YES
```

## After Implementation

1. Close Xcode completely
2. I'll update the `project.pbxproj` file
3. Clear derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData/*`
4. Reopen Xcode - you should see a clean structure with CosmiqWidgetExtension properly configured
5. Build and run

---

## Technical Details

The fix involves adding approximately 200 lines to the pbxproj file to properly define:

```text
CosmiqWidgetExtension (target)
├── CosmiqWidget.swift (source)
├── WidgetData.swift (source)  
├── WidgetViews.swift (source)
└── CosmiqWidget.entitlements (entitlements)
```

The main App target will include a "Copy Files" build phase to embed the `.appex` bundle, and a target dependency to ensure the widget builds before the app.

