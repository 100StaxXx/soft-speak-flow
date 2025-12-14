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

# Function to check and setup Node.js/npm
setup_node() {
  # Check if npm is already available
  if command -v npm &> /dev/null; then
    echo -e "${GREEN}✅ Node.js/npm found: $(node --version) / $(npm --version)${NC}"
    return 0
  fi

  echo -e "${YELLOW}⚠️  npm not found in PATH. Attempting to locate Node.js...${NC}"
  
  # Try to load nvm if it exists
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo -e "${YELLOW}📦 Found nvm, loading it...${NC}"
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Try to activate LTS version (this adds node/npm to PATH)
    if nvm use --lts >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Node.js/npm loaded via nvm (LTS): $(node --version) / $(npm --version)${NC}"
      return 0
    fi
    
    # If LTS not available, try default
    if nvm use default >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Node.js/npm loaded via nvm (default): $(node --version) / $(npm --version)${NC}"
      return 0
    fi
    
    # If no version is active, install LTS
    echo -e "${YELLOW}⚠️  No active Node.js version. Installing LTS...${NC}"
    if nvm install --lts >/dev/null 2>&1 && nvm use --lts >/dev/null 2>&1; then
      if command -v npm &> /dev/null; then
        echo -e "${GREEN}✅ Node.js/npm installed via nvm: $(node --version) / $(npm --version)${NC}"
        return 0
      fi
    fi
  fi

  # Try common Node.js installation paths
  NODE_PATHS=(
    "/usr/local/bin/node"
    "/opt/homebrew/bin/node"
    "$HOME/.local/bin/node"
  )
  
  for NODE_PATH in "${NODE_PATHS[@]}"; do
    if [ -f "$NODE_PATH" ]; then
      echo -e "${YELLOW}📦 Found Node.js at $NODE_PATH, adding to PATH...${NC}"
      export PATH="$(dirname "$NODE_PATH"):$PATH"
      if command -v npm &> /dev/null; then
        echo -e "${GREEN}✅ Node.js/npm found: $(node --version) / $(npm --version)${NC}"
        return 0
      fi
    fi
  done

  # If we get here, Node.js is not found
  echo -e "${RED}❌ Node.js/npm not found${NC}"
  echo ""
  echo -e "${YELLOW}💡 To install Node.js, run:${NC}"
  echo ""
  echo "  # Install nvm (Node Version Manager)"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
  echo ""
  echo "  # Reload shell"
  echo "  export NVM_DIR=\"\$HOME/.nvm\""
  echo "  [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\""
  echo ""
  echo "  # Install Node.js LTS"
  echo "  nvm install --lts"
  echo "  nvm use --lts"
  echo ""
  echo -e "${YELLOW}Or install Node.js directly from: https://nodejs.org/${NC}"
  echo ""
  exit 1
}

# Step 0: Check and setup Node.js/npm
echo -e "${YELLOW}🔍 Checking for Node.js/npm...${NC}"
setup_node
echo ""

# Step 1: Check for unstaged changes
echo -e "${YELLOW}🔍 Step 1: Checking git status...${NC}"
if ! git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}⚠️  You have unstaged changes. Stashing them...${NC}"
  git stash push -m "Auto-stash before TestFlight deployment $(date +%Y-%m-%d_%H:%M:%S)" || {
    echo -e "${RED}❌ Failed to stash changes. Please commit or stash manually.${NC}"
    exit 1
  }
  echo -e "${GREEN}✅ Changes stashed${NC}"
fi
echo ""

# Step 2: Pull latest code
echo -e "${YELLOW}📥 Step 2: Pulling latest code...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH}${NC}"
git pull origin "$CURRENT_BRANCH" || {
  echo -e "${RED}❌ Failed to pull code. Check your git status.${NC}"
  echo -e "${YELLOW}💡 Tip: Run 'git stash' first if you have uncommitted changes${NC}"
  exit 1
}
echo -e "${GREEN}✅ Code pulled successfully${NC}"
echo ""

# Step 3: Install npm dependencies
echo -e "${YELLOW}📦 Step 3: Installing npm dependencies...${NC}"
npm install || {
  echo -e "${RED}❌ Failed to install npm dependencies${NC}"
  exit 1
}

# Note: Patch-package errors in postinstall are non-fatal and won't block the install
# If you see patch errors, you may need to regenerate them with: npx patch-package <package-name>
echo -e "${GREEN}✅ npm dependencies installed${NC}"
echo ""

# Step 4: Validate environment
echo -e "${YELLOW}🔍 Step 4: Validating environment variables...${NC}"
npm run validate:env || {
  echo -e "${RED}❌ Environment validation failed. Check your .env file.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Environment variables validated${NC}"
echo ""

# Step 5: Build web assets (needed for cap sync)
echo -e "${YELLOW}🏗️  Step 5: Building web assets...${NC}"
npm run build || {
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
}
echo -e "${GREEN}✅ Web assets built${NC}"
echo ""

# Step 6: Sync to iOS (generates clean capacitor.config.json before pod install)
echo -e "${YELLOW}🔄 Step 6: Syncing to iOS (preparing config)...${NC}"
npx cap sync ios || {
  echo -e "${RED}❌ Failed to sync iOS${NC}"
  exit 1
}
echo -e "${GREEN}✅ iOS sync complete${NC}"
echo ""

# Step 7: Install CocoaPods (after config is generated to avoid merge conflicts)
echo -e "${YELLOW}🍎 Step 7: Installing CocoaPods dependencies...${NC}"
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

# Step 8: Open Xcode
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




