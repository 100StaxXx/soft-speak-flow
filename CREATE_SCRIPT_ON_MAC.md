# Create Deployment Script on MacInCloud

## Quick Fix: Create the Script

Copy and paste this entire command on MacInCloud Terminal:

```bash
cat > scripts/deploy-testflight.sh << 'SCRIPT_END'
#!/bin/bash

# TestFlight Deployment Script
# Run this on macOS to prepare and deploy to TestFlight
# Usage: ./scripts/deploy-testflight.sh

set -e  # Exit on error

echo "🚀 Starting TestFlight Deployment Process..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 0: Check for unstaged changes
echo -e "${YELLOW}🔍 Checking git status...${NC}"
if ! git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}⚠️  You have unstaged changes. Stashing them...${NC}"
  git stash push -m "Auto-stash before TestFlight deployment $(date +%Y-%m-%d_%H:%M:%S)" || {
    echo -e "${RED}❌ Failed to stash changes. Please commit or stash manually.${NC}"
    exit 1
  }
  echo -e "${GREEN}✅ Changes stashed${NC}"
fi
echo ""

# Step 1: Pull latest code
echo -e "${YELLOW}📥 Step 1: Pulling latest code...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH}${NC}"
git pull origin "$CURRENT_BRANCH" || {
  echo -e "${RED}❌ Failed to pull code. Check your git status.${NC}"
  echo -e "${YELLOW}💡 Tip: Run 'git stash' first if you have uncommitted changes${NC}"
  exit 1
}
echo -e "${GREEN}✅ Code pulled successfully${NC}"
echo ""

# Step 2: Install npm dependencies
echo -e "${YELLOW}📦 Step 2: Installing npm dependencies...${NC}"
npm install || {
  echo -e "${RED}❌ Failed to install npm dependencies${NC}"
  exit 1
}
echo -e "${GREEN}✅ npm dependencies installed${NC}"
echo ""

# Step 3: Validate environment
echo -e "${YELLOW}🔍 Step 3: Validating environment variables...${NC}"
npm run validate:env || {
  echo -e "${RED}❌ Environment validation failed. Check your .env file.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Environment variables validated${NC}"
echo ""

# Step 4: Install CocoaPods
echo -e "${YELLOW}🍎 Step 4: Installing CocoaPods dependencies...${NC}"
cd ios/App

# Check if CocoaPods is installed
if ! command -v pod &> /dev/null; then
  echo -e "${YELLOW}⚠️  CocoaPods not found. Installing...${NC}"
  sudo gem install cocoapods || {
    echo -e "${RED}❌ Failed to install CocoaPods. Install manually: sudo gem install cocoapods${NC}"
    exit 1
  }
fi

# Install pods
pod install || {
  echo -e "${RED}❌ Failed to install pods${NC}"
  exit 1
}
echo -e "${GREEN}✅ CocoaPods installed${NC}"
cd ../..
echo ""

# Step 5: Build web assets
echo -e "${YELLOW}🏗️  Step 5: Building web assets...${NC}"
npm run build || {
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
}
echo -e "${GREEN}✅ Web assets built${NC}"
echo ""

# Step 6: Sync to iOS
echo -e "${YELLOW}🔄 Step 6: Syncing to iOS...${NC}"
npx cap sync ios || {
  echo -e "${RED}❌ Failed to sync iOS${NC}"
  exit 1
}
echo -e "${GREEN}✅ iOS sync complete${NC}"
echo ""

# Step 7: Open Xcode
echo -e "${GREEN}✅ All setup complete!${NC}"
echo ""
echo -e "${YELLOW}📱 Next steps:${NC}"
echo "1. Xcode should open automatically"
echo "2. Select 'Any iOS Device (arm64)' as target"
echo "3. Product → Archive"
echo "4. Distribute to App Store Connect"
echo "5. Upload to TestFlight"
echo ""
echo -e "${GREEN}Opening Xcode workspace...${NC}"
open ios/App/App.xcworkspace

echo ""
echo -e "${GREEN}🎉 Setup complete! Continue in Xcode.${NC}"
SCRIPT_END

chmod +x scripts/deploy-testflight.sh
echo "✅ Script created! Now run: ./scripts/deploy-testflight.sh"
```

---

## Or Just Run Manual Steps

Since you've already pulled, you can skip the script and run manually:

```bash
# 1. Install npm dependencies
npm install
npm run validate:env

# 2. Install iOS pods
cd ios/App
pod install
cd ../..

# 3. Build and sync
npm run build
npx cap sync ios

# 4. Open Xcode
open ios/App/App.xcworkspace
```

