

# Create Missing "App" Scheme for Xcode

## Problem Summary

The **App** scheme file doesn't exist in the project. Xcode schemes are stored in `ios/App/App.xcodeproj/xcshareddata/xcschemes/` and without them, Xcode auto-generates schemes based on what it detects. Currently, only the `CosmiqWidgetExtension` scheme is showing in the scheme selector.

## Solution

I'll create the proper **App.xcscheme** file that:

1. Configures the main **App** target as the buildable reference
2. Sets up Run, Test, Profile, Analyze, and Archive actions
3. Properly includes the widget extension as a dependency during Archive

## Changes

### New File: `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`

Create a scheme file that defines:

- **Build Action**: Build the App target (and CosmiqWidgetExtension as dependency)
- **Run Action**: Launch App.app
- **Archive Action**: Archive the App target with widget embedded

Key configuration:

```text
BuildableReference:
  BlueprintIdentifier = 504EC3031FED79650016851F (App target)
  BuildableName = App.app
  BlueprintName = App
```

## After Implementation

1. Pull the changes with `git pull`
2. Close and reopen Xcode
3. The **App** scheme will now appear in the scheme selector dropdown
4. Select **App** → **Archive** to build the app with the widget embedded

## Technical Details

The scheme file uses XML format and references the App target by its UUID (`504EC3031FED79650016851F`) from the project.pbxproj file. This is the standard Xcode scheme format and will be recognized automatically when Xcode opens the project.

