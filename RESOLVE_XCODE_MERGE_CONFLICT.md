# Resolve Xcode Project Merge Conflict

## Problem

The Xcode project file (`project.pbxproj`) has a merge conflict that's preventing `pod install` from running.

## Solution

### Option 1: Accept Incoming Version (Recommended)

```bash
# Accept the version from the remote (main branch)
git checkout --theirs ios/App/App.xcodeproj/project.pbxproj

# Add the resolved file
git add ios/App/App.xcodeproj/project.pbxproj

# Commit the resolution
git commit -m "Resolve merge conflict in Xcode project file"

# Now try pod install again
cd ios/App
pod install
cd ../..
```

### Option 2: Accept Your Local Version

If you want to keep your local changes:

```bash
git checkout --ours ios/App/App.xcodeproj/project.pbxproj
git add ios/App/App.xcodeproj/project.pbxproj
git commit -m "Resolve merge conflict - keep local Xcode project"
cd ios/App
pod install
cd ../..
```

### Option 3: Manual Resolution

If you need to manually resolve:

```bash
# Open the file and look for conflict markers
# <<<<<<< HEAD
# (your changes)
# =======
# (incoming changes)
# >>>>>>> branch-name

# Edit the file to resolve conflicts, then:
git add ios/App/App.xcodeproj/project.pbxproj
git commit -m "Resolve merge conflict manually"
cd ios/App
pod install
cd ../..
```

## Recommendation

Since you just merged from main, **Option 1** (accept incoming) is usually safest. The project file from main should have the correct configuration.

## After Resolving

Once the conflict is resolved and `pod install` completes:

1. Continue with adding GoogleService-Info.plist to Xcode
2. Enable Apple Sign-In in Firebase Console
3. Build and archive

