# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/1b75b247-809a-454c-82ea-ceca9d5f620c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/1b75b247-809a-454c-82ea-ceca9d5f620c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

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

## iOS Build Troubleshooting

If you encounter XCFramework copy errors during iOS builds (e.g., `[CP] Copy XCFrameworks` failing with rsync errors for `IONFilesystemLib` or `FBSDKCoreKit_Basics`), follow these steps:

### Clean Pod Installation

```sh
# Navigate to iOS App directory
cd ios/App

# Remove existing Pods and lock file
rm -rf Pods
rm -f Podfile.lock

# Clear CocoaPods cache (optional but recommended)
pod cache clean --all

# Reinstall pods
pod install
```

### Clear Xcode Derived Data

If issues persist, clear the Xcode derived data:

```sh
# Remove derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Or from Xcode: Product > Clean Build Folder (Cmd+Shift+K)
```

### Common Issues

- **FBSDKCoreKit_Basics errors**: This usually indicates stale pods from a previous configuration. The clean installation above should resolve this.
- **IONFilesystemLib XCFramework errors**: The Podfile includes a post-install fix that handles architecture slice mismatches gracefully.
- **"Internal inconsistency error"**: This Xcode error often resolves after cleaning derived data and rebuilding.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/1b75b247-809a-454c-82ea-ceca9d5f620c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
