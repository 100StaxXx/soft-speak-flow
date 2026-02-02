

# Fix npm Install Failure: React 19 Peer Dependency Conflicts

## Problem

When running `npm install` after a clean reinstall, npm fails with:

```
npm error ERESOLVE unable to resolve dependency tree
npm error peer react@"^16.8 || ^17 || ^18" from next-themes@0.3.0
```

This happens because:
- Your project uses **React 19** (`^19.2.2`)
- `next-themes@0.3.0` declares a peer dependency on **React 16/17/18 only**
- npm's strict dependency resolution blocks the install

The failed install leaves `node_modules` incomplete, causing secondary errors like missing `@sentry/react`, `@capacitor/camera`, etc.

## Solution

Add `legacy-peer-deps=true` to `.npmrc` to bypass peer dependency checks. This is safe because:
- React 19 is backward-compatible with React 18 APIs
- Many packages haven't updated their peer deps yet but work fine
- This was previously working (your Lovable builds succeed)

## Changes Required

### 1. Update .npmrc

```text
engine-strict=true
legacy-peer-deps=true
```

### 2. After Syncing Changes

Run these commands locally:

```bash
# Pull the changes
git pull

# Clean reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build

# Sync to iOS
npx cap sync ios
```

## Technical Details

| Setting | Purpose |
|---------|---------|
| `legacy-peer-deps=true` | Ignores peer dependency conflicts during install |
| Why needed | React 19 isn't in peer deps of older packages like `next-themes`, `react-day-picker`, etc. |
| Safety | These packages work with React 19 despite outdated peer deps |

## Alternative Approaches (Not Recommended)

1. **Downgrade to React 18** - Would require significant testing and lose React 19 features
2. **Upgrade next-themes to v0.4.x** - May introduce breaking changes requiring code updates
3. **Use `--force` flag** - Only works per-command, not persistent

## Result

After this fix:
- `npm install` will complete successfully
- All dependencies will be properly installed
- `npm run build` will work
- Camera and other Capacitor features will function on iOS

