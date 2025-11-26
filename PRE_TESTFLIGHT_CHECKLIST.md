# ✈️ Pre-TestFlight Launch Checklist

**Use this checklist to track your progress from code to TestFlight.**

---

## 📋 Phase 1: Code & Configuration (30 mins)

### Critical Config Changes
- [ ] **REQUIRED:** Edit `capacitor.config.ts` (line 7-10)
  - Comment out or remove the `server:` block
  - This prevents app from loading remote URL
  - Should look like:
    ```typescript
    webDir: 'dist',
    // server: { ... }, // REMOVE THIS for production
    plugins: { ... }
    ```

### Icons & Assets
- [ ] Create 1024x1024 app icon
  - Save to: `resources/icon.png`
  - No transparency, no rounded corners
  - Tool: Figma, Canva, or Photoshop

- [ ] Generate icon sizes
  ```bash
  npm install @capacitor/assets --save-dev
  npx @capacitor/assets generate --iconBackgroundColor '#1a1a1a'
  ```

- [ ] (Optional) Optimize splash screen
  - Current: `public/splash.png` (2.5MB)
  - Recommended: <500KB for faster launch
  - Use ImageOptim or similar

### Build & Sync
- [ ] Build web app
  ```bash
  npm run build
  ```

- [ ] Verify dist/ folder created
  ```bash
  ls -la dist/
  ```

---

## 📋 Phase 2: iOS Platform Setup (15 mins)

### Platform Initialization
- [ ] Add iOS platform
  ```bash
  npx cap add ios
  ```

- [ ] Verify ios/ folder created
  ```bash
  ls -la ios/App/
  ```

- [ ] Sync web assets to iOS
  ```bash
  npx cap sync ios
  ```

- [ ] Open in Xcode
  ```bash
  npx cap open ios
  ```

---

## 📋 Phase 3: Xcode Configuration (60 mins)

### Project Settings
- [ ] Open correct file: `ios/App/App.xcworkspace` (NOT .xcodeproj)
- [ ] Select "App" project in left sidebar
- [ ] Select "App" target under TARGETS

### General Tab
- [ ] Set Display Name: `R-Evolution`
- [ ] Set Version: `1.0.0`
- [ ] Set Build: `1`
- [ ] Verify Bundle Identifier: `com.revolution.app`

### Signing & Capabilities
- [ ] Check "Automatically manage signing"
- [ ] Select Team: (your Apple Developer account)
- [ ] Wait for "Successfully created provisioning profile"
- [ ] Green checkmark visible

### Info.plist Permissions
Open `ios/App/App/Info.plist`, add these keys if your app uses these features:

- [ ] Camera (if using camera):
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>R-Evolution needs camera access to capture moments.</string>
  ```

- [ ] Photo Library (if saving images):
  ```xml
  <key>NSPhotoLibraryUsageDescription</key>
  <string>R-Evolution needs access to save achievements.</string>
  ```

- [ ] Microphone (if recording audio):
  ```xml
  <key>NSMicrophoneUsageDescription</key>
  <string>R-Evolution needs microphone for voice reflections.</string>
  ```

- [ ] Face ID (if using biometrics):
  ```xml
  <key>NSFaceIDUsageDescription</key>
  <string>R-Evolution uses Face ID for secure sign-in.</string>
  ```

**Note:** Only add permissions you actually use! Remove unused ones.

---

## 📋 Phase 4: Testing (30 mins)

### Simulator Testing
- [ ] Select simulator: "iPhone 15" (or any iPhone)
- [ ] Click ▶️ Run button
- [ ] Wait for build (first build: 5-10 mins)
- [ ] App launches successfully
- [ ] Test core features:
  - [ ] Sign up / Sign in
  - [ ] Companion loads
  - [ ] Missions appear
  - [ ] XP awards work
  - [ ] Navigation works
  - [ ] No console errors

### Device Testing (Recommended)
- [ ] Connect iPhone via USB
- [ ] Trust computer on iPhone
- [ ] Enable Developer Mode on iPhone
  - Settings → Privacy & Security → Developer Mode → ON
  - iPhone will restart
- [ ] Select your iPhone in Xcode
- [ ] Click ▶️ Run button
- [ ] App installs on iPhone
- [ ] If needed: Trust developer in Settings → General → VPN & Device Management
- [ ] Test on physical device

---

## 📋 Phase 5: Archive & Upload (30 mins)

### Create Archive
- [ ] In Xcode: Select "Any iOS Device (arm64)" target
- [ ] Menu: Product → Archive
- [ ] Wait 5-10 minutes
- [ ] Xcode Organizer opens automatically
- [ ] Archive appears in list

### Validate Archive
- [ ] Click "Validate App" button
- [ ] Select distribution certificate
- [ ] Answer export compliance:
  - Uses encryption? Usually "No"
- [ ] Wait for validation
- [ ] Validation successful ✅

### Upload to App Store Connect
- [ ] Click "Distribute App"
- [ ] Select "App Store Connect"
- [ ] Select "Upload"
- [ ] Include bitcode: YES (if available)
- [ ] Include symbols: YES
- [ ] Click "Upload"
- [ ] Wait 5-15 minutes
- [ ] Upload successful ✅

---

## 📋 Phase 6: App Store Connect (30 mins)

### Initial Setup (If First Time)
- [ ] Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- [ ] Click "My Apps" → +
- [ ] Create new app:
  - Platform: iOS
  - Name: R-Evolution
  - Language: English
  - Bundle ID: com.revolution.app
  - SKU: revolution-app

### Wait for Processing
- [ ] Go to TestFlight tab
- [ ] Build shows "Processing"
- [ ] Wait 10-30 minutes
- [ ] Build status changes to "Ready to Submit"

### Add Build Information
- [ ] Click on build number
- [ ] Click "Provide Export Compliance Information"
- [ ] Answer questions:
  - Uses encryption? No (unless you added custom encryption)
- [ ] Save

### Beta App Information
- [ ] Add Beta App Description:
  ```
  R-Evolution is your AI-powered personal development companion. 
  Test the gamified habit tracker, AI mentor conversations, 
  and evolving digital companion features.
  ```
- [ ] Add Feedback Email: your-email@example.com
- [ ] Add Privacy Policy URL: (your website/privacy page)
- [ ] Save

---

## 📋 Phase 7: Beta Testing Setup (15 mins)

### Internal Testing (Immediate, No Review)
- [ ] TestFlight → Internal Testing → + Create Group
- [ ] Name: "Internal Beta"
- [ ] Add build
- [ ] Add testers (enter emails)
- [ ] Testers receive invite immediately
- [ ] They can install right away

### OR: External Testing (24-48 hr Review)
- [ ] TestFlight → External Testing → + Create Group
- [ ] Name: "Beta Testers"
- [ ] Add build
- [ ] Add what to test:
  ```
  Focus on testing:
  - Account creation and login
  - Companion evolution system
  - Daily missions and tasks
  - AI mentor chat
  - Premium subscription flow
  ```
- [ ] Add test account (if login required):
  - Username: test@example.com
  - Password: TestPassword123
- [ ] Click "Submit for Review"
- [ ] Wait 24-48 hours for approval

---

## 📋 Post-Upload: Invite Testers

### Prepare Tester Communication
- [ ] Draft invitation message
- [ ] Include what to test
- [ ] Include how to report bugs
- [ ] Set expectations (beta = bugs expected)

### Track Feedback
- [ ] Create feedback spreadsheet or board
- [ ] Set up communication channel (Slack, Discord, email)
- [ ] Monitor TestFlight feedback in App Store Connect

---

## 🚨 Common Issues & Solutions

### "iOS platform already exists"
```bash
# Solution: Sync instead
npx cap sync ios
```

### "Unable to find developer disk image"
- iPhone iOS version > Xcode's supported version
- Solution: Update Xcode from Mac App Store

### "Provisioning profile doesn't match"
- Solution: Xcode → Preferences → Accounts → Download Manual Profiles

### "Archive button is greyed out"
- Solution: Select "Any iOS Device (arm64)", not simulator

### "Build stuck on 'Processing'"
- Usually takes 10-30 minutes
- If >1 hour, check Activity tab for errors

### "Validation failed: Missing/invalid icon"
- Solution: Regenerate icons and sync
  ```bash
  npx @capacitor/assets generate
  npx cap sync ios
  ```

---

## ✅ Success Criteria

You're ready to invite testers when:
- ✅ Build appears in TestFlight tab
- ✅ Status: "Ready to Submit" or "Ready for Testing"
- ✅ Export compliance answered
- ✅ Beta information filled out
- ✅ Testing group created

---

## 📊 Progress Tracker

Track your overall progress:

- [ ] **Phase 1:** Code & Configuration (30 mins)
- [ ] **Phase 2:** iOS Platform Setup (15 mins)
- [ ] **Phase 3:** Xcode Configuration (60 mins)
- [ ] **Phase 4:** Testing (30 mins)
- [ ] **Phase 5:** Archive & Upload (30 mins)
- [ ] **Phase 6:** App Store Connect (30 mins)
- [ ] **Phase 7:** Beta Testing Setup (15 mins)

**Total Time:** ~3.5 hours

---

## 🎉 You Did It!

When all phases are complete:
- ✅ Build is in TestFlight
- ✅ Testers can install
- ✅ Feedback loop established
- ✅ Ready to iterate!

**Next:** Monitor feedback, fix bugs, release new builds weekly.

---

## 📚 Quick Reference

**Build & Sync:**
```bash
npm run build && npx cap sync ios
```

**Open Xcode:**
```bash
npx cap open ios
```

**Update Build Number:**
- Xcode → General Tab → Build: increment (2, 3, 4...)

**Upload New Build:**
- Product → Archive → Distribute → Upload

**Check Build Status:**
- [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → TestFlight tab

---

**Print this checklist and check items off as you go!** ✓
