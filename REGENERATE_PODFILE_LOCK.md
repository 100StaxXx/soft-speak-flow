# Regenerate Podfile.lock

## Why Podfile.lock Should Be Committed

`Podfile.lock` should be committed to git because it:
- Locks dependency versions for consistency
- Ensures all team members use the same pod versions
- Makes builds reproducible

## How to Regenerate It

Run these commands on **MacInCloud** (CocoaPods requires macOS):

```bash
# Navigate to iOS directory
cd ios/App

# Install pods (this regenerates Podfile.lock)
pod install

# Go back to project root
cd ../..

# Add the regenerated Podfile.lock
git add ios/App/Podfile.lock

# Commit it
git commit -m "Regenerate Podfile.lock after dependency updates"

# Push
git push
```

## What This Does

1. `pod install` reads your `Podfile` and installs all dependencies
2. It creates/updates `Podfile.lock` with the exact versions installed
3. Committing it ensures everyone uses the same versions

## Note

If you're on Windows, you'll need to run this on MacInCloud since CocoaPods requires macOS.

