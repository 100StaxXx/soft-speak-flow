# ⚡ Quick TestFlight Deploy (MacInCloud)

**Fast reference** - Copy and paste these commands on your MacInCloud session.

---

## 🚀 One-Command Setup (Recommended)

```bash
# Make script executable and run
chmod +x scripts/deploy-testflight.sh
./scripts/deploy-testflight.sh
```

This script will:
1. ✅ Pull latest code
2. ✅ Install npm dependencies
3. ✅ Validate environment
4. ✅ Install CocoaPods
5. ✅ Build web assets
6. ✅ Sync to iOS
7. ✅ Open Xcode

---

## 📋 Manual Steps (If Script Fails)

### 1. Handle Git Changes (If you have unstaged changes)
```bash
# Stash your changes before pulling
git stash push -m "Before TestFlight deployment"

# Or commit them if they're important
# git add -A && git commit -m "WIP: Local changes"
```

### 2. Pull & Setup
```bash
# Pull latest code (use your current branch name)
git pull origin codex/list-database-read/write-operations

# Install dependencies
npm install
npm run validate:env
```

### 2. iOS Setup
```bash
# Install pods
cd ios/App
pod install
cd ../..

# Build and sync
npm run build
npx cap sync ios
```

### 4. Open Xcode
```bash
open ios/App/App.xcworkspace
```

---

## 📱 In Xcode

1. **Select target:** "Any iOS Device (arm64)"
2. **Archive:** Product → Archive
3. **Distribute:** Click "Distribute App" → "App Store Connect" → "Upload"
4. **Wait:** Processing takes 15-30 minutes

---

## ✅ Verify Before Archiving

- [ ] Team selected in Signing & Capabilities
- [ ] Bundle ID: `com.darrylgraham.revolution`
- [ ] Target: "Any iOS Device (arm64)" (NOT simulator)
- [ ] Pods project visible in Project Navigator

---

**See `TESTFLIGHT_DEPLOYMENT_GUIDE.md` for detailed instructions.**

