# Cosmiq - Your Personal AI Mentor

A gamified self-improvement companion with AI mentor, evolving digital companion, and quest-based habit tracking.

## How can I edit this code?

**Use your preferred IDE**

Clone this repo and work locally using your own IDE.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

This project uses Firebase for hosting and backend services. Deploy using:

```sh
npm run build
firebase deploy
```

## iOS build troubleshooting

### Add the iOS platform

If `npx cap sync ios` reports that the iOS platform has not been added, add it once with:

```sh
npx cap add ios
```

After the platform is created, you can rerun `npx cap sync ios` to copy the latest web assets and update native dependencies.

The Capacitor iOS project includes a custom CocoaPods `post_install` hook (see `ios/App/Podfile`) that scans every downloaded `.xcframework`. If a framework ships without the plain `ios-arm64` slice that the `[CP] Copy XCFrameworks` script expects, the hook clones the closest non-simulator `ios-arm64_*` variant into place. This prevents `rsync` errors like the ones seen for `IONFilesystemLib` or `FBSDKCoreKit_Basics`.

If you still hit `[CP] Copy XCFrameworks` failures:

1. Ensure JavaScript deps are installed: `npm install`
2. On macOS, clean and reinstall Pods:
   ```sh
   cd ios/App
   rm -rf Pods Podfile.lock
   pod install
   ```
   If CocoaPods reports that the sandbox is out of sync with `Podfile.lock`, run the root-level helper to regenerate the iOS pods:
   ```sh
   npm run ios:sync
   ```
3. In Xcode, delete Derived Data for the app target, then rebuild.

After a fresh `pod install`, the hook will repopulate missing `ios-arm64` slices automatically, so the build completes even when upstream vendors omit that directory.
