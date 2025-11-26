# ⚡ Quick Action Checklist - Guild/Discord + TestFlight

**Last Updated:** November 26, 2025  
**Status:** All items ready for execution

---

## 🎯 STEP 1: Configure Discord (15 minutes)

### A. Get Discord Bot Token
1. Go to https://discord.com/developers/applications
2. Create new application (or use existing)
3. Go to "Bot" section
4. Click "Reset Token" → Copy token
5. Keep this token secret!

### B. Invite Bot to Server
1. In Discord Developer Portal → OAuth2 → URL Generator
2. Select scopes: `bot`
3. Select permissions:
   - ✅ Manage Channels
   - ✅ Send Messages
   - ✅ Create Instant Invite
   - ✅ View Channels
4. Copy generated URL → Open in browser
5. Select your server → Authorize

### C. Add Secrets to Supabase
**Option 1: Via Dashboard (Easier)**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → Edge Functions → Secrets
4. Click "Add Secret"
5. Add these secrets:
   ```
   Name: DISCORD_BOT_TOKEN
   Value: <paste your bot token>
   
   Name: DISCORD_GUILD_ID
   Value: 1442580219285471364
   
   Name: DISCORD_WEBHOOK_URL (optional)
   Value: <your webhook URL if you have one>
   ```

**Option 2: Via CLI**
```bash
supabase secrets set DISCORD_BOT_TOKEN=<your-token>
supabase secrets set DISCORD_GUILD_ID=1442580219285471364
supabase secrets set DISCORD_WEBHOOK_URL=<your-webhook-url>
```

---

## 🗄️ STEP 2: Apply Database Migrations (5 minutes)

### Option 1: Using Supabase CLI
```bash
cd /workspace
supabase db push
```

### Option 2: Manual SQL (if CLI doesn't work)
1. Go to Supabase Dashboard → SQL Editor
2. Run these files in order:

**File 1:** `supabase/migrations/20251124183456_586c5fa7-091b-41de-908c-0ab003759a64.sql`
- Creates `epic_members` table
- Creates `epic_discord_events` table

**File 2:** `supabase/migrations/20251125_add_discord_guild_channels.sql`
- Adds Discord columns to `epics` table:
  - `discord_channel_id`
  - `discord_invite_url`
  - `discord_ready`

### Verify Migrations
Run this query in SQL Editor:
```sql
-- Should return 3 columns
SELECT discord_channel_id, discord_invite_url, discord_ready 
FROM epics 
LIMIT 1;

-- Should return table info
SELECT * FROM epic_discord_events LIMIT 1;
```

---

## 🔗 STEP 3: Configure Supabase OAuth (5 minutes)

### Add Redirect URLs
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add these to **Redirect URLs**:
   ```
   com.revolution.app://
   capacitor://localhost
   https://your-production-domain.com/
   https://your-production-domain.com/auth/callback
   http://localhost:5173/
   ```
3. Set **Site URL** to:
   ```
   https://your-production-domain.com
   ```
4. Click "Save"

---

## 🧪 STEP 4: Test Guild/Discord Feature (20 minutes)

### Test Flow:
1. **Create a public epic** in the app
   - Go to Epics → Create Epic
   - Make it public
   - Note the invite code

2. **Join with 2nd user** (use incognito or another device)
   - Sign in with different account
   - Go to Epics → Join Epic
   - Enter invite code
   - ✅ Should show "2/3" progress for Discord unlock

3. **Join with 3rd user**
   - Sign in with third account
   - Join the same epic
   - ✅ Owner should see "Create Channel" button

4. **Create Discord channel** (as owner)
   - Click "Create Channel" button
   - ✅ Check Discord server for new channel
   - ✅ Channel name should be `guild-<code>`
   - ✅ Welcome message should appear

5. **Open Discord chat** (as any member)
   - Click "Open Chat" button
   - ✅ Should open Discord invite in new tab
   - ✅ Should be able to join channel

### If anything fails, check:
- [ ] Discord bot is in the server
- [ ] Discord bot has correct permissions
- [ ] Bot token is correct in Supabase secrets
- [ ] Guild ID is correct
- [ ] Check Supabase Edge Function logs for errors

---

## 📱 STEP 5: Prepare for iOS Build (45 minutes)

### A. Create App Icon (20 minutes)
1. **Design 1024x1024 icon** (no transparency, no rounded corners)
   - Use Figma, Canva, or Photoshop
   - Make it recognizable at small sizes
   - Use app branding colors
   - Save as PNG

2. **Save icon:**
   ```bash
   # Create resources folder
   mkdir -p /workspace/resources
   
   # Save your icon as:
   # /workspace/resources/icon.png
   ```

3. **Generate all icon sizes:**
   ```bash
   npm install @capacitor/assets --save-dev
   npx @capacitor/assets generate --iconBackgroundColor '#1a1a1a'
   ```

### B. Build Web App (5 minutes)
```bash
cd /workspace
npm run build
```

**Verify build:**
```bash
ls -la dist/
# Should see index.html, assets folder, etc.
```

### C. Initialize iOS Platform (10 minutes)
```bash
# Add iOS platform
npx cap add ios

# Sync web assets to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios
```

**This will:**
- Create `ios/` directory
- Generate Xcode project
- Copy web assets
- Open Xcode automatically

---

## 🔧 STEP 6: Configure Xcode (45 minutes)

### A. Basic Configuration (15 minutes)
1. **Open correct file:** `ios/App/App.xcworkspace` (NOT .xcodeproj)
2. **Select target:**
   - Click "App" in project navigator (left sidebar)
   - Select "App" under TARGETS

3. **General tab:**
   - Display Name: `R-Evolution`
   - Version: `1.0.0`
   - Build: `1`
   - Bundle Identifier: `com.revolution.app`

### B. Signing (15 minutes)
1. **Signing & Capabilities tab:**
   - Check ✅ "Automatically manage signing"
   - Team: Select your Apple Developer account
   - Wait for provisioning profile to generate
   - Look for ✅ green checkmark

2. **If you don't have Apple Developer account:**
   - Go to https://developer.apple.com/account/
   - Enroll ($99/year for Individual)
   - Wait for approval (usually immediate)

### C. Capabilities (10 minutes)
Add these capabilities if needed:
- [ ] Push Notifications (if using)
- [ ] Sign in with Apple (if using Apple OAuth)
- [ ] Background Modes → Audio (for pep talk audio)

### D. Info.plist (5 minutes)
Open `ios/App/App/Info.plist` and add:

```xml
<!-- Required: Photo library for saving achievements -->
<key>NSPhotoLibraryUsageDescription</key>
<string>R-Evolution needs access to save your achievements.</string>

<!-- If using microphone -->
<key>NSMicrophoneUsageDescription</key>
<string>R-Evolution uses microphone for audio features.</string>

<!-- If using notifications -->
<key>NSUserNotificationsUsageDescription</key>
<string>R-Evolution sends motivational reminders to help you stay on track.</string>
```

---

## 🧪 STEP 7: Test on Device (30 minutes)

### A. Test on Simulator (10 minutes)
1. In Xcode toolbar, select: **iPhone 15** (or any iPhone simulator)
2. Click ▶️ **Run** button
3. Wait for build (first build: 5-10 mins)
4. App should launch in simulator

**Test these features:**
- [ ] App launches successfully
- [ ] Sign up works
- [ ] Sign in works
- [ ] Companion appears
- [ ] Missions load
- [ ] Navigation works
- [ ] No crashes

### B. Test on Physical iPhone (20 minutes)
1. **Prepare iPhone:**
   - Connect iPhone via USB
   - Unlock iPhone
   - Trust computer (popup on iPhone)
   - Enable Developer Mode:
     - Settings → Privacy & Security → Developer Mode → ON
     - iPhone will restart

2. **Build on device:**
   - In Xcode, select your iPhone from device list
   - Click ▶️ Run
   - Wait for installation
   - If "Untrusted Developer" error:
     - iPhone → Settings → General → VPN & Device Management
     - Trust your developer certificate

3. **Critical tests on physical device:**
   - [ ] App launches
   - [ ] Works offline (turn on airplane mode)
   - [ ] Sign up/sign in works
   - [ ] OAuth works (Google, Apple)
   - [ ] Guild creation works
   - [ ] Discord channel creation works
   - [ ] All features functional

---

## 🚀 STEP 8: Upload to TestFlight (60 minutes)

### A. Create Archive (15 minutes)
1. In Xcode toolbar, select: **Any iOS Device (arm64)**
2. Menu: **Product → Archive**
3. Wait for build (5-10 minutes)
4. Xcode Organizer opens automatically
5. Archive appears in list

### B. Validate Archive (10 minutes)
1. Select your archive
2. Click **"Validate App"**
3. Select distribution certificate
4. Answer export compliance:
   - "Does your app use encryption?" → Usually **No**
   - (Unless you added custom encryption beyond HTTPS)
5. Wait for validation
6. Should see ✅ "Validation Successful"

**If validation fails:**
- Check signing certificate is valid
- Check bundle ID matches App Store Connect
- Check all required icons are present
- Read error message carefully

### C. Distribute to TestFlight (15 minutes)
1. Click **"Distribute App"**
2. Select **"App Store Connect"**
3. Select **"Upload"**
4. Include bitcode: **YES** (if available)
5. Include symbols: **YES** (for crash reports)
6. Review summary
7. Click **"Upload"**
8. Wait for upload (5-15 minutes)
9. Should see ✅ "Upload Successful"

### D. App Store Connect Setup (20 minutes)

**If first time creating app:**
1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → + button
3. Create new app:
   - Platform: iOS
   - Name: R-Evolution
   - Language: English (US)
   - Bundle ID: com.revolution.app
   - SKU: revolution-app (or any unique ID)
4. Click "Create"

**Wait for processing:**
1. Go to **TestFlight** tab
2. Build shows "Processing"
3. Wait 10-30 minutes
4. Status changes to "Ready to Submit"

**Add export compliance:**
1. Click on build number
2. Click "Provide Export Compliance Information"
3. Answer: "Does your app use encryption?" → **No** (usually)
4. Save

**Add beta app information:**
1. Beta App Description:
   ```
   R-Evolution is your AI-powered personal development companion. 
   Test the gamified habit tracker, AI mentor conversations, 
   evolving digital companion, and guild features with Discord integration.
   ```
2. Feedback Email: `your-email@example.com`
3. Privacy Policy URL: `https://your-domain.com/privacy`
4. Save

---

## 👥 STEP 9: Invite Beta Testers (15 minutes)

### Option 1: Internal Testing (No Review, Immediate)
1. TestFlight → **Internal Testing** → + Create Group
2. Name: "Internal Beta"
3. Add build
4. Add testers (enter email addresses)
5. Testers receive invite **immediately**
6. Can have up to 100 internal testers

### Option 2: External Testing (Requires Review, 24-48 hours)
1. TestFlight → **External Testing** → + Create Group
2. Name: "Beta Testers"
3. Add build
4. Add "What to Test":
   ```
   Please focus on testing:
   - Account creation and login
   - Companion evolution system
   - Daily missions and habit tracking
   - AI mentor chat
   - Guild creation and joining
   - Discord channel integration
   - Premium subscription flow
   ```
5. Add test account (if required):
   - Email: test@yourdomain.com
   - Password: TestPass123!
6. Click **"Submit for Review"**
7. Wait 24-48 hours for Apple review

---

## 📊 SUCCESS CRITERIA

You're done when:
- ✅ Discord bot is in your server with correct permissions
- ✅ Discord secrets added to Supabase
- ✅ Database migrations applied
- ✅ Guild creation works (tested with 3 users)
- ✅ Discord channel creation works
- ✅ OAuth redirect URLs configured
- ✅ iOS platform initialized
- ✅ App icons generated
- ✅ Xcode project configured
- ✅ App tested on physical iPhone
- ✅ Build uploaded to TestFlight
- ✅ Build status: "Ready to Submit" or "Ready for Testing"
- ✅ Beta testers invited

---

## 🚨 TROUBLESHOOTING

### Discord Issues
**"Failed to create channel"**
- Check bot token is correct in Supabase secrets
- Verify bot is in the Discord server
- Check bot has "Manage Channels" permission
- Check Supabase Edge Function logs

**"Discord bot not responding"**
- Verify bot token hasn't expired
- Check bot is online in Discord
- Re-invite bot to server

### iOS Build Issues
**"Signing failed"**
- Check Apple Developer account is active
- Download manual profiles: Xcode → Preferences → Accounts → Download
- Try "Automatically manage signing" toggle off then on

**"Archive button greyed out"**
- Select "Any iOS Device (arm64)", not simulator
- Make sure scheme is set to "Release"

**"Build fails with module not found"**
- Clean build: Product → Clean Build Folder (⇧⌘K)
- Delete DerivedData: ~/Library/Developer/Xcode/DerivedData
- Rebuild

### TestFlight Issues
**"Build stuck on Processing"**
- Usually takes 10-30 minutes
- If > 1 hour, check Activity tab in App Store Connect
- Look for error messages

**"Missing/invalid icon"**
- Regenerate icons: `npx @capacitor/assets generate`
- Sync: `npx cap sync ios`
- Rebuild in Xcode

---

## 📞 HELP RESOURCES

- **Capacitor iOS:** https://capacitorjs.com/docs/ios
- **Discord Bot Setup:** https://discord.com/developers/docs/getting-started
- **TestFlight Guide:** https://developer.apple.com/testflight/
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **App Store Connect:** https://developer.apple.com/app-store-connect/

---

## ✅ FINAL CHECKLIST

Before you start:
- [ ] I have a Mac with Xcode installed
- [ ] I have an Apple Developer account ($99/year)
- [ ] I have a Discord server to test with
- [ ] I have access to Supabase dashboard

After completing all steps:
- [ ] Discord integration works
- [ ] iOS app builds successfully
- [ ] App tested on physical device
- [ ] App uploaded to TestFlight
- [ ] Beta testers can install app

**Estimated total time: 4-5 hours**

---

**Good luck with your launch!** 🚀

If you get stuck, check the troubleshooting section or refer to the comprehensive report: `GUILD_DISCORD_TESTFLIGHT_READINESS.md`
