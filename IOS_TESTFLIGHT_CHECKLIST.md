# iOS TestFlight Checklist for Admin Companion Image Testing

## ✅ Changes Made for iOS Compatibility

### 1. Native Image Download/Share
- Added `@capacitor/filesystem` and `@capacitor/share` packages
- Created `src/utils/imageDownload.ts` utility for native image handling
- On iOS: Uses native Share Sheet instead of download
- On Web: Uses standard browser download

### 2. Mobile-Friendly UI
- Increased touch targets to 44-48px (Apple's minimum recommended size)
- Larger text inputs (min-h-[44px]) for better mobile usability
- Larger color pickers (h-12) for easier touch interaction
- Added `touch-manipulation` CSS for better touch response
- Responsive padding adjustments (p-4 md:p-6)

### 3. TestFlight Deployment Steps

#### Before Building for TestFlight:
1. **Comment out server config** in `capacitor.config.ts`:
   ```typescript
   // server: {
   //   url: 'https://...',
   //   cleartext: true
   // },
   ```

2. **Sync Capacitor**:
   ```bash
   npm run build
   npx cap sync ios
   ```

3. **Open in Xcode**:
   ```bash
   npx cap open ios
   ```

#### In Xcode:
1. **Sign the app** with your Apple Developer account
2. **Check Info.plist** includes:
   - `NSPhotoLibraryUsageDescription` (if saving to photos)
   - `NSPhotoLibraryAddUsageDescription` (for adding photos)
3. **Archive and Upload** to TestFlight

### 4. Testing on TestFlight

When testing the Admin Companion Image Tester:
- ✅ Spirit animal dropdown should work
- ✅ Element dropdown should work  
- ✅ Stage slider should be easy to drag
- ✅ Color pickers should open iOS native color picker
- ✅ Generate button should call edge function successfully
- ✅ Generated image should display
- ✅ "Share Image" button should open iOS Share Sheet
- ✅ User can save to Photos or share via Messages/Mail

### 5. Known iOS Behaviors

**Native Share Sheet:**
- Button text changes from "Download Image" to "Share Image" on iOS
- Uses iOS native Share Sheet with options to:
  - Save to Photos
  - Share via Messages, Mail, AirDrop, etc.
  - Copy image

**Color Pickers:**
- iOS uses native color picker interface
- May look different than web color picker
- Hex input still works for precise color entry

### 6. Troubleshooting

**If sharing fails:**
- Check that edge function returns valid image URL
- Verify network connectivity for image fetch
- Check Xcode console for Capacitor errors

**If UI looks wrong:**
- Verify `npx cap sync` was run after code changes
- Clear derived data in Xcode
- Clean build folder (Cmd+Shift+K)

## 📝 Post-TestFlight Notes

After successful TestFlight deployment, consider:
- Testing on multiple iOS devices (iPhone, iPad)
- Testing on different iOS versions
- Gathering feedback on touch target sizes
- Monitoring edge function performance on mobile networks
