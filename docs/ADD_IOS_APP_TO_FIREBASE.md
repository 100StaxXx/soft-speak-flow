# Add iOS App to Firebase Console

## Why You Need This

For native iOS Google Sign-In to work, you need an **iOS app** registered in Firebase Console. This will:
- Generate the correct iOS OAuth client ID for your Firebase project
- Provide the `GoogleService-Info.plist` file needed for iOS
- Configure Google Sign-In for your iOS bundle ID

## Step-by-Step Instructions

### Step 1: Go to Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **cosmiq-prod** (or your project name)

### Step 2: Add iOS App

1. Click the gear icon ⚙️ → **Project Settings**
2. Scroll down to the **Your apps** section
3. Click **Add app** → Select **iOS** (🍎 icon)

### Step 3: Register Your iOS App

Fill in the registration form:

- **iOS bundle ID:** `com.darrylgraham.revolution`
  - ⚠️ **Must match exactly** - this is your app's bundle identifier
- **App nickname (optional):** `Cosmiq iOS` or leave blank
- **App Store ID (optional):** Leave blank for now (you can add it later)

Click **Register app**

### Step 4: Download GoogleService-Info.plist

1. After registering, Firebase will show you a download button
2. Click **Download GoogleService-Info.plist**
3. **Save this file** - you'll need it in the next steps

### Step 5: Add GoogleService-Info.plist to Xcode

1. Open your Xcode project:
   ```bash
   open ios/App/App.xcworkspace
   ```

2. In Xcode Project Navigator:
   - Right-click on the **App** folder (the blue folder, not the project)
   - Select **Add Files to "App"...**

3. Navigate to and select the `GoogleService-Info.plist` file you just downloaded

4. In the dialog, make sure:
   - ✅ **Copy items if needed** is checked
   - ✅ **Add to targets: App** is checked
   - ✅ **Create groups** is selected (not "Create folder references")

5. Click **Add**

6. Verify the file appears in your Project Navigator under the App folder

### Step 6: Get the iOS OAuth Client ID

1. Open the `GoogleService-Info.plist` file you just added (in Xcode or a text editor)
2. Find the `CLIENT_ID` key
3. Copy the value - it should look like:
   ```
   636156363416-xxxxxxxxxxxxx.apps.googleusercontent.com
   ```
   This is your **iOS OAuth Client ID**

### Step 7: Update Info.plist

1. In Xcode, open `ios/App/App/Info.plist`
2. Find the `CFBundleURLSchemes` array under `google-signin` (around line 28-31)
3. Update the URL scheme to match your iOS OAuth client ID:

   **Current (wrong):**
   ```xml
   <string>com.googleusercontent.apps.371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu</string>
   ```

   **New (from GoogleService-Info.plist):**
   ```xml
   <string>com.googleusercontent.apps.636156363416-xxxxxxxxxxxxx</string>
   ```
   
   ⚠️ **Important:** 
   - Remove `.apps.googleusercontent.com` from the end
   - Use the format: `com.googleusercontent.apps.{PROJECT_NUMBER}-{CLIENT_ID_SUFFIX}`
   - Replace `xxxxxxxxxxxxx` with the actual suffix from your `CLIENT_ID`

### Step 8: Update Environment Variable

1. Open your `.env.local` file (in the project root)
2. Add or update:
   ```env
   VITE_GOOGLE_IOS_CLIENT_ID=636156363416-xxxxxxxxxxxxx.apps.googleusercontent.com
   ```
   Use the **full** CLIENT_ID value from `GoogleService-Info.plist` (including `.apps.googleusercontent.com`)

3. Save the file

### Step 9: Verify Google Sign-In is Enabled

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google**
3. Make sure **Google** is **Enabled**
4. Under **Authorized domains**, verify your domains are listed
5. Under **OAuth 2.0 Client IDs**, you should now see:
   - ✅ **Web client** (for web sign-in)
   - ✅ **iOS client** with bundle ID: `com.darrylgraham.revolution`

### Step 10: Rebuild Your App

1. In Xcode:
   - **Product** → **Clean Build Folder** (Shift+Cmd+K)
   - **Product** → **Build** (Cmd+B)

2. Or from terminal:
   ```bash
   cd ios/App
   pod install
   cd ../..
   ```

3. Then rebuild in Xcode

## Verification Checklist

After completing these steps, verify:

- [ ] iOS app is registered in Firebase Console with bundle ID `com.darrylgraham.revolution`
- [ ] `GoogleService-Info.plist` is added to Xcode project (visible in Project Navigator)
- [ ] `GoogleService-Info.plist` is included in the App target
- [ ] `Info.plist` has the correct Google OAuth URL scheme (starts with `636156363416-`)
- [ ] `.env.local` has `VITE_GOOGLE_IOS_CLIENT_ID` set to the full client ID
- [ ] Firebase Console shows iOS OAuth client ID under Authentication → Sign-in method → Google
- [ ] App builds successfully in Xcode
- [ ] Google Sign-In works on iOS device/TestFlight

## Troubleshooting

### "GoogleService-Info.plist not found" error
- Make sure the file is in the Xcode project (visible in Project Navigator)
- Verify it's included in the App target (check Target Membership in File Inspector)

### Still getting "invalid-credential" error
- Double-check the URL scheme in `Info.plist` matches the CLIENT_ID from `GoogleService-Info.plist`
- Verify the bundle ID in Firebase Console matches `com.darrylgraham.revolution` exactly
- Make sure you're using the iOS OAuth client ID, not the web client ID

### Can't find CLIENT_ID in GoogleService-Info.plist
- Open the file in a text editor
- Look for a key named `CLIENT_ID` (all caps)
- The value should be a long string ending in `.apps.googleusercontent.com`

## Next Steps

After completing this setup:
1. Test Google Sign-In on a physical iOS device or TestFlight
2. If you also need Android support, you can add an Android app in Firebase Console later
3. See `docs/FIX_GOOGLE_OAUTH_IOS_ERROR.md` for more detailed troubleshooting

