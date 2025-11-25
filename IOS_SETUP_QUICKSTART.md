# 🚀 iOS Setup Quickstart Guide

**Goal:** Get your R-Evolution app ready for TestFlight in 3-4 hours.

---

## ⚡ Quick Prerequisites Check

Before starting, verify you have:
- ✅ Mac computer with macOS (required for Xcode)
- ✅ Apple Developer account ($99/year) - [Sign up here](https://developer.apple.com/programs/)
- ✅ Xcode installed (from Mac App Store) - Latest version recommended
- ✅ Command Line Tools: `xcode-select --install`

---

## 📋 Step-by-Step Setup (Copy & Paste Ready)

### Step 1: Fix Capacitor Config for Production (2 minutes)

Open `capacitor.config.ts` and update it:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.revolution.app',
  appName: 'R-Evolution',
  webDir: 'dist',
  // IMPORTANT: Comment out or remove the server block for production
  // The app should load from local files, not remote URL
  // server: {
  //   url: 'https://...',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
```

---

### Step 2: Create App Icons (15 minutes)

**Option A: Use Capacitor Assets (Recommended)**

```bash
# Install Capacitor assets generator
npm install @capacitor/assets --save-dev

# Create a directory for resources
mkdir -p resources

# Create or place your 1024x1024 icon at:
# resources/icon.png (must be exactly 1024x1024)

# Generate all icon sizes automatically
npx @capacitor/assets generate --iconBackgroundColor '#1a1a1a'
```

**Option B: Manual (if Option A fails)**

1. Go to [appicon.co](https://www.appicon.co/)
2. Upload your 1024x1024 icon
3. Select "iOS" only
4. Download and extract
5. Copy contents to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

**Don't have an icon yet?**
- Use a placeholder temporarily
- Recommended tools: [Figma](https://figma.com), [Canva](https://canva.com), or [IconKitchen](https://icon.kitchen)
- Icon guidelines: 1024x1024, no transparency, no rounded corners (iOS adds them)

---

### Step 3: Build Web App (1 minute)

```bash
# Build production-ready web assets
npm run build

# Verify dist/ folder was created
ls -la dist/
```

---

### Step 4: Initialize iOS Platform (2 minutes)

```bash
# Add iOS platform to your Capacitor project
npx cap add ios

# This creates:
# - ios/App/ directory
# - ios/App/App.xcworkspace
# - ios/App/App.xcodeproj
```

**Troubleshooting:**
- If you see "iOS platform already exists", run: `npx cap sync ios` instead
- If you get errors, ensure Xcode is installed: `xcodebuild -version`

---

### Step 5: Sync Web Assets to iOS (1 minute)

```bash
# Copy web assets and plugins to iOS project
npx cap sync ios

# This syncs:
# - dist/ folder to iOS
# - Capacitor plugins
# - splash screens and icons
```

---

### Step 6: Open in Xcode (1 minute)

```bash
# Open the iOS project in Xcode
npx cap open ios

# OR manually open:
# open ios/App/App.xcworkspace
```

**⚠️ IMPORTANT:** Always open the `.xcworkspace` file, NOT the `.xcodeproj` file!

---

### Step 7: Configure Xcode Signing (10 minutes)

Once Xcode opens:

**7.1: Select Project**
- Click on "App" in the left sidebar (top item with blue icon)

**7.2: Select Target**
- In the main area, under TARGETS, select "App"

**7.3: Go to Signing & Capabilities Tab**
- Click "Signing & Capabilities" at the top

**7.4: Configure Signing**
- Check ✅ "Automatically manage signing"
- Team: Select your Apple Developer team from dropdown
  - If not showing, add account: Xcode → Settings → Accounts → +
- Bundle Identifier: Verify it shows `com.revolution.app`

**7.5: Verify Status**
- Should show: ✅ "Signing certificate and provisioning profile are managed by Xcode"
- If you see errors, click "Try Again" or check your Apple Developer account

---

### Step 8: Set App Version & Build Number (2 minutes)

Still in Xcode:

**8.1: Stay on General Tab**
- Should still be on "App" target

**8.2: Find Identity Section**
- Scroll to top of General tab
- Look for "Identity" section

**8.3: Set Version Numbers**
- Display Name: `R-Evolution`
- Version: `1.0.0`
- Build: `1`

**Note:** For each new TestFlight upload, increment Build number (1, 2, 3, etc.)

---

### Step 9: Configure iOS Permissions (5 minutes)

Your app likely needs permissions. Add them to Info.plist:

**9.1: Find Info.plist**
- In Xcode left sidebar: ios/App/App/Info.plist
- Right-click → Open As → Source Code

**9.2: Add Permission Descriptions**

Add these keys inside the `<dict>` tag (before `</dict>`):

```xml
<!-- Camera Permission (if your app uses camera) -->
<key>NSCameraUsageDescription</key>
<string>R-Evolution needs camera access to capture moments for your journey.</string>

<!-- Photo Library Permission -->
<key>NSPhotoLibraryUsageDescription</key>
<string>R-Evolution needs access to save your achievement cards and quotes.</string>

<!-- Microphone Permission (if using audio) -->
<key>NSMicrophoneUsageDescription</key>
<string>R-Evolution needs microphone access for voice reflections.</string>

<!-- Push Notifications (if enabled) -->
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
  <string>audio</string>
</array>

<!-- Face ID / Touch ID (if using biometric auth) -->
<key>NSFaceIDUsageDescription</key>
<string>R-Evolution uses Face ID for secure, convenient sign-in.</string>
```

**Remove any permissions your app doesn't use!** Apple rejects apps with unnecessary permissions.

---

### Step 10: Test Build on Simulator (5 minutes)

**10.1: Select Simulator**
- At top of Xcode: Click scheme dropdown (next to App)
- Select: "App" > "iPhone 15" (or any iPhone simulator)

**10.2: Run Build**
- Click ▶️ Play button (top left)
- OR: Product → Run (Cmd+R)

**10.3: Wait for Build**
- First build takes 2-5 minutes
- Simulator should launch and show your app

**10.4: Test Core Features**
- Sign in / sign up
- Navigate through main features
- Check for crashes
- Verify companion loads
- Test mission/task completion

**Troubleshooting Common Build Errors:**

**Error: "No profiles for com.revolution.app"**
- Solution: Go to Signing & Capabilities, try different Team, or run: `npx cap sync ios`

**Error: "Command PhaseScriptExecution failed"**
- Solution: Open Xcode → Settings → Locations → Command Line Tools → Select Xcode version

**Error: "Library not found"**
- Solution: Run: `cd ios/App && pod install && cd ../..`

**Error: "Bundle identifier has already been used"**
- Solution: Change `appId` in `capacitor.config.ts` to something unique like `com.yourname.revolution`

---

### Step 11: Test on Physical Device (Optional but Recommended, 10 minutes)

**11.1: Connect iPhone**
- Plug iPhone into Mac via USB
- Unlock iPhone
- If prompted "Trust This Computer?", tap Trust

**11.2: Enable Developer Mode on iPhone**
- Settings → Privacy & Security → Developer Mode → Toggle ON
- iPhone will restart

**11.3: Select Device in Xcode**
- Top of Xcode: Click scheme dropdown
- Select your physical iPhone (shows device name)

**11.4: Run on Device**
- Click ▶️ Play button
- First time: "Developer Disk Image" will install (2-3 mins)
- App launches on your iPhone

**11.5: Trust App on Device**
- If app doesn't open: Settings → General → VPN & Device Management
- Tap your developer account → Trust

---

### Step 12: Archive for TestFlight (15 minutes)

**12.1: Select "Any iOS Device" Target**
- Top of Xcode: Click scheme dropdown
- Select "Any iOS Device (arm64)"
- DO NOT select simulator!

**12.2: Archive Build**
- Menu: Product → Archive
- OR: Cmd+B to build first, then Product → Archive
- Wait 5-10 minutes for archive to complete

**12.3: Xcode Organizer Opens**
- Window shows your archived build
- Build info: Version 1.0.0 (1), Date, Size

**12.4: Validate Archive**
- Click "Validate App" button
- Select your distribution certificate
- Click "Validate"
- Wait 2-3 minutes
- Should show: ✅ "Validation Successful"

**Common Validation Errors:**

**"Missing Compliance"**
- Click "Next", answer export compliance questions
- Usually "No" for encryption (unless you added custom crypto)

**"Invalid Icon"**
- Go back to Step 2, regenerate icons
- Run: `npx cap sync ios` and rebuild

**"Missing Push Notification Entitlement"**
- If not using push: Remove UIBackgroundModes from Info.plist
- If using push: Add Push Notifications capability in Xcode

---

### Step 13: Upload to App Store Connect (15 minutes)

**13.1: Distribute App**
- In Organizer, click "Distribute App"
- Select: "App Store Connect"
- Click "Next"

**13.2: Upload Options**
- Select: "Upload"
- Include bitcode: YES (if available)
- Include app symbols: YES (for crash reports)
- Click "Next"

**13.3: Re-sign (if needed)**
- Select distribution certificate
- Select provisioning profile
- Click "Next"

**13.4: Review & Upload**
- Review summary
- Click "Upload"
- Wait 5-15 minutes for upload

**13.5: Upload Complete**
- Should show: ✅ "Upload Successful"
- Click "Done"

---

### Step 14: App Store Connect Setup (20 minutes)

**14.1: Go to App Store Connect**
- Visit: [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- Sign in with your Apple Developer account

**14.2: Create New App (if first time)**
- Click "My Apps" → + → New App
- Platform: iOS
- Name: R-Evolution
- Primary Language: English
- Bundle ID: com.revolution.app
- SKU: revolution-app (or any unique ID)
- User Access: Full Access

**14.3: Wait for Build to Process**
- Go to: TestFlight tab
- Status shows: "Processing" (10-30 minutes)
- Apple is:
  - Scanning for malware
  - Generating app preview
  - Checking binary

**14.4: Once Processing Complete**
- Status changes to: "Missing Compliance"
- Click on build → Export Compliance
- Answer questions:
  - Uses encryption? Usually "No"
  - Save

---

### Step 15: Submit for Beta Review (10 minutes)

**15.1: Add Test Information**
- TestFlight tab → Click your build
- Click "Provide Export Compliance"
- Answer encryption questions (usually "No")
- Save

**15.2: Add Beta App Information**
- Scroll down to "Beta App Information"
- Beta App Description: 
  ```
  R-Evolution is your AI-powered personal development companion. 
  Test the gamified habit tracker, AI mentor conversations, 
  and evolving digital companion features.
  ```
- Feedback Email: your-email@example.com
- Marketing URL: (optional)
- Privacy Policy URL: https://your-domain.com/privacy

**15.3: Create Test Group**

**For Internal Testing (No Review, Immediate):**
- TestFlight → Internal Testing → + → Create Group
- Name: "Internal Beta"
- Add testers (up to 100)
- Testers get invite immediately

**For External Testing (Requires Review, 24-48 hrs):**
- TestFlight → External Testing → + → Create Group
- Name: "Beta Testers"
- Add build
- Add testers
- Click "Submit for Review"
- Wait 24-48 hours for approval

**15.4: Provide Test Details (External only)**
- What to test: "Test all core features including companion evolution, missions, and AI chat"
- Test account (if required):
  - Username: test@example.com
  - Password: TestPassword123
  - Notes: Feel free to explore all features

---

## ✅ You're Done! What Happens Next?

### Timeline:

**Immediate (5 minutes):**
- Build appears in App Store Connect
- Status: "Processing"

**10-30 minutes:**
- Build finishes processing
- Status: "Ready to Submit"

**Internal Testing (Immediate):**
- Invite internal testers
- They receive email/notification
- Can install via TestFlight app instantly

**External Testing (24-48 hours):**
- Submit for beta review
- Apple reviews build
- Once approved, external testers can install

---

## 📱 How Beta Testers Install Your App

**For Testers:**

1. **Receive Invite**
   - Email: "You're invited to test R-Evolution"
   - Or: Public link (if you choose public link option)

2. **Install TestFlight App**
   - Download from App Store (free)

3. **Accept Invite**
   - Tap link in email or enter code
   - TestFlight app opens

4. **Install Your App**
   - Tap "Install"
   - App downloads like normal App Store app

5. **Provide Feedback**
   - In TestFlight app: Tap "Send Beta Feedback"
   - Can attach screenshots
   - You receive feedback in App Store Connect

---

## 🔄 Updating Your Beta (For Next Builds)

When you make changes and want to release a new beta:

```bash
# 1. Update version or build number
# In Xcode: General tab → Build: increment (2, 3, 4...)

# 2. Make your code changes

# 3. Rebuild web assets
npm run build

# 4. Sync to iOS
npx cap sync ios

# 5. Open Xcode
npx cap open ios

# 6. Archive again
# Product → Archive

# 7. Upload to App Store Connect
# Same process as Step 13

# 8. Wait for processing
# Testers automatically see "Update Available" in TestFlight
```

**Version vs Build:**
- **Version (1.0.0):** User-facing, increment for significant changes
- **Build (1, 2, 3...):** Internal, increment for EVERY upload
- TestFlight shows: "Version 1.0.0 (3)" for example

---

## 🐛 Troubleshooting Common Issues

### "App crashes on launch"
- Check console logs in Xcode
- Verify environment variables are set correctly
- Test on simulator first
- Remove `server` config from capacitor.config.ts

### "Icons not showing"
- Regenerate icons: `npx @capacitor/assets generate`
- Run: `npx cap sync ios`
- Clean build: Xcode → Product → Clean Build Folder

### "Build stuck on 'Processing'"
- Usually takes 10-30 minutes, be patient
- If >1 hour, check App Store Connect "Activity" tab for errors
- Common issue: Missing export compliance info

### "TestFlight install fails"
- Check device is iOS 13+ (your app's minimum)
- Tester's device must be added to provisioning (for internal)
- External testing: Must wait for beta review approval

### "Can't find my device in Xcode"
- Unplug and replug iPhone
- Restart Xcode
- Check cable (data cable, not charge-only)
- Enable Developer Mode on iPhone (Settings → Privacy & Security)

### "Upload fails with entitlement error"
- Check Signing & Capabilities in Xcode
- Remove capabilities you're not using
- Regenerate provisioning profile in developer.apple.com

---

## 📚 Helpful Resources

**Official Docs:**
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)
- [TestFlight Beta Testing](https://developer.apple.com/testflight/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

**Community:**
- [Capacitor Discord](https://discord.gg/UPYqBWTF) - Very active, helpful community
- [Capacitor Forums](https://forum.ionicframework.com/c/capacitor/)
- [Stack Overflow - Capacitor Tag](https://stackoverflow.com/questions/tagged/capacitor)

**Tools:**
- [Capacitor Assets Generator](https://github.com/ionic-team/capacitor-assets)
- [App Icon Generator](https://www.appicon.co/)
- [iOS Icon Size Reference](https://developer.apple.com/design/human-interface-guidelines/app-icons)

---

## 🎉 Congratulations!

If you've made it this far, your app is now in TestFlight! 🚀

**What's Next:**
1. Invite friends/colleagues to beta test
2. Gather feedback
3. Fix bugs and iterate
4. When ready: Submit for full App Store review
5. Launch to the world! 🌍

---

## 💡 Pro Tips

**For Smooth Beta Testing:**
- Start with 5-10 close friends first (internal testing)
- Create a feedback form/channel (Google Forms, Slack, Discord)
- Set clear expectations: "This is beta, bugs are expected"
- Iterate quickly - aim for 1 build per week during beta
- Track feedback in a spreadsheet or tool like Linear/Trello

**For Production Launch:**
- Keep beta testing for 2-4 weeks minimum
- Fix all critical bugs before App Store submission
- Prepare screenshots (required): 6.5" and 5.5" iPhone sizes
- Write compelling App Store description
- Set up keywords for App Store search optimization
- Consider soft launch in one country first

**Cost Optimization:**
- Use TestFlight for beta (free, unlimited testing)
- Don't pay for third-party beta services (TestFlight is better)
- Apple Developer account: $99/year (required)

---

**Need help?** Check the [main assessment doc](./TESTFLIGHT_READINESS_ASSESSMENT.md) for detailed troubleshooting.

Good luck! 🍀
