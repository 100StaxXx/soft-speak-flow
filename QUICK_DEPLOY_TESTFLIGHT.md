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
# Switch to main branch and pull latest code
git checkout main
git pull origin main

# Install dependencies
npm install
npm run validate:env
```

### 2. iOS Setup
```bash
# Build and sync (must happen before pod install)
npm run build
npx cap sync ios

# Install pods (after config is generated)
cd ios/App
pod install
cd ../..
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

## 🔧 Troubleshooting

### Merge Conflict in `capacitor.config.json`

If you see this error:
```
✖ Error parsing config: Unexpected token '<', ..."thApple", <<<<<<< HE"... is not valid JSON
```

**Fix:** The deployment script now handles this automatically by running `cap sync ios` before `pod install`. If you still see this error:
1. Delete the file: `rm ios/App/App/capacitor.config.json`
2. Regenerate it: `npm run build && npx cap sync ios`
3. Then run: `cd ios/App && pod install`

### Patch-Package Warning

If you see:
```
**ERROR** Failed to apply patch for package @capgo/capacitor-social-login
```

This is usually a non-blocking warning. The deployment should still work. To fix it properly:
```bash
# Remove node_modules and reinstall
rm -rf node_modules
npm install

# If patch still fails, regenerate it:
# 1. Manually edit the file in node_modules/@capgo/capacitor-social-login
# 2. Run: npx patch-package @capgo/capacitor-social-login
```

### Missing Pods Configuration Files

If you see this error in Xcode:
```
Unable to open base configuration reference file '/Volumes/workspace/repository/ios/App/Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig'
```

**Cause:** CocoaPods dependencies haven't been installed yet, or the Pods directory is missing.

**Fix:**

First, check if CocoaPods is already installed:
```bash
pod --version
```

If CocoaPods is NOT installed, try one of these methods:

**Option 1: User-level gem install (No sudo required)**
```bash
# Install to user directory (no sudo needed)
gem install --user-install cocoapods

# Add to PATH (add this to your ~/.zshrc or ~/.bash_profile)
export PATH="$HOME/.gem/ruby/$(ruby -e 'puts RUBY_VERSION')/bin:$PATH"

# Reload shell or run:
source ~/.zshrc  # or source ~/.bash_profile
```

**Option 2: Using Homebrew (if available)**
```bash
brew install cocoapods
```

**Option 3: If you have sudo access**
```bash
sudo gem install cocoapods
```

**After CocoaPods is installed:**
```bash
# Navigate to iOS App directory (if not already there)
cd ios/App

# Install pods (this creates the Pods/ directory and .xcconfig files)
pod install

# Go back to project root
cd ../..

# Close Xcode if it's open, then reopen the workspace
open ios/App/App.xcworkspace
```

**Important:** Always open `App.xcworkspace` (NOT `App.xcodeproj`) after running `pod install`.

### Node.js/npm Not Found

If you see `npm: command not found`, install Node.js:
```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js LTS
nvm install --lts
nvm use --lts
```

---

**See `TESTFLIGHT_DEPLOYMENT_GUIDE.md` for detailed instructions.**




