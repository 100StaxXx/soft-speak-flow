#!/bin/bash

# iOS Build Requirements Checker
# Run this before building for iOS to ensure everything is set up correctly

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Checking iOS Build Requirements...${NC}\n"

ERRORS=0
WARNINGS=0

# Function to check and report
check_item() {
    local name=$1
    local check_cmd=$2
    local error_msg=$3
    
    if eval "$check_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} $name"
        return 0
    else
        echo -e "${RED}❌${NC} $name"
        if [ -n "$error_msg" ]; then
            echo -e "   ${RED}→${NC} $error_msg"
        fi
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

warn_item() {
    local name=$1
    local check_cmd=$2
    local warn_msg=$3
    
    if eval "$check_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} $name"
        return 0
    else
        echo -e "${YELLOW}⚠️${NC}  $name"
        if [ -n "$warn_msg" ]; then
            echo -e "   ${YELLOW}→${NC} $warn_msg"
        fi
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

# 1. Check Node.js
echo -e "${BLUE}📦 Node.js & npm${NC}"
check_item "Node.js installed" "command -v node" "Install Node.js: brew install node or use nvm"
if command -v node > /dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "   Version: $NODE_VERSION"
fi

check_item "npm installed" "command -v npm" "npm should come with Node.js"
if command -v npm > /dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo -e "   Version: $NPM_VERSION"
fi
echo ""

# 2. Check project directory
echo -e "${BLUE}📁 Project Setup${NC}"
check_item "In project root" "[ -f package.json ]" "Run this script from the project root directory"
check_item "package.json exists" "[ -f package.json ]" "package.json not found"
check_item "node_modules exists" "[ -d node_modules ]" "Run: npm install"
echo ""

# 3. Check environment variables
echo -e "${BLUE}🔐 Environment Variables${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✅${NC} .env file exists"
    
    # Check required Firebase vars
    REQUIRED_VARS=(
        "VITE_FIREBASE_API_KEY"
        "VITE_FIREBASE_AUTH_DOMAIN"
        "VITE_FIREBASE_PROJECT_ID"
        "VITE_FIREBASE_APP_ID"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env 2>/dev/null && ! grep -q "^${var}=$" .env 2>/dev/null && ! grep -q "^${var}=undefined" .env 2>/dev/null; then
            echo -e "${GREEN}✅${NC} $var is set"
        else
            echo -e "${RED}❌${NC} $var is missing or empty"
            ERRORS=$((ERRORS + 1))
        fi
    done
    
    # Check recommended vars
    RECOMMENDED_VARS=(
        "VITE_SUPABASE_URL"
        "VITE_SUPABASE_PUBLISHABLE_KEY"
        "VITE_NATIVE_REDIRECT_BASE"
    )
    
    for var in "${RECOMMENDED_VARS[@]}"; do
        if grep -q "^${var}=" .env 2>/dev/null && ! grep -q "^${var}=$" .env 2>/dev/null && ! grep -q "^${var}=undefined" .env 2>/dev/null; then
            echo -e "${GREEN}✅${NC} $var is set"
        else
            echo -e "${YELLOW}⚠️${NC}  $var is missing (recommended)"
            WARNINGS=$((WARNINGS + 1))
        fi
    done
    
    # Run validation script if it exists
    if [ -f scripts/validate-env.js ]; then
        echo ""
        echo -e "${BLUE}   Running env validation...${NC}"
        npm run validate:env 2>&1 | grep -v "^$" || true
    fi
else
    echo -e "${RED}❌${NC} .env file not found"
    echo -e "   ${RED}→${NC} Create .env file from .env.example and add your values"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Check iOS-specific files
echo -e "${BLUE}🍎 iOS Configuration${NC}"
check_item "ios/App directory exists" "[ -d ios/App ]" "iOS project directory not found"
check_item "GoogleService-Info.plist exists" "[ -f ios/App/App/GoogleService-Info.plist ]" "Firebase config file missing. Download from Firebase Console"
check_item "App.xcworkspace exists" "[ -d ios/App/App.xcworkspace ]" "Xcode workspace not found. Run: pod install in ios/App"
check_item "Podfile exists" "[ -f ios/App/Podfile ]" "Podfile not found"
echo ""

# 5. Check CocoaPods
echo -e "${BLUE}☕ CocoaPods${NC}"
if check_item "CocoaPods installed" "command -v pod" "Install: sudo gem install cocoapods"; then
    POD_VERSION=$(pod --version 2>/dev/null || echo "unknown")
    echo -e "   Version: $POD_VERSION"
    
    # Check if pods are installed
    if [ -d ios/App/Pods ]; then
        echo -e "${GREEN}✅${NC} Pods directory exists"
    else
        echo -e "${YELLOW}⚠️${NC}  Pods not installed. Run: cd ios/App && pod install"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# 6. Check Xcode
echo -e "${BLUE}🛠️  Xcode${NC}"
if check_item "Xcode installed" "command -v xcodebuild" "Install Xcode from App Store"; then
    XCODE_VERSION=$(xcodebuild -version 2>/dev/null | head -n 1 || echo "unknown")
    echo -e "   $XCODE_VERSION"
    
    # Check command line tools
    if xcode-select -p > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} Xcode Command Line Tools configured"
    else
        echo -e "${YELLOW}⚠️${NC}  Xcode Command Line Tools not configured"
        echo -e "   ${YELLOW}→${NC} Run: xcode-select --install"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# 7. Check Capacitor
echo -e "${BLUE}⚡ Capacitor${NC}"
check_item "Capacitor CLI installed" "command -v npx" "npm should provide npx"
if [ -f capacitor.config.ts ] || [ -f capacitor.config.js ]; then
    echo -e "${GREEN}✅${NC} Capacitor config file exists"
else
    echo -e "${RED}❌${NC} Capacitor config file not found"
    ERRORS=$((ERRORS + 1))
fi

if [ -d ios/App/App/capacitor.config.json ]; then
    echo -e "${GREEN}✅${NC} iOS Capacitor config synced"
else
    echo -e "${YELLOW}⚠️${NC}  iOS Capacitor config may need sync. Run: npx cap sync ios"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 8. Check Git
echo -e "${BLUE}📝 Git${NC}"
if check_item "Git installed" "command -v git" "Install Git: xcode-select --install"; then
    if [ -d .git ]; then
        echo -e "${GREEN}✅${NC} Git repository initialized"
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
        echo -e "   Current branch: $CURRENT_BRANCH"
    else
        echo -e "${YELLOW}⚠️${NC}  Not a git repository"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# 9. Check build output directory
echo -e "${BLUE}🏗️  Build Artifacts${NC}"
if [ -d dist ]; then
    echo -e "${GREEN}✅${NC} dist directory exists (previous build found)"
else
    echo -e "${YELLOW}⚠️${NC}  dist directory not found (will be created on build)"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready to build.${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "  1. npm run build"
    echo -e "  2. npx cap sync ios"
    echo -e "  3. open ios/App/App.xcworkspace"
    echo -e "  4. Archive in Xcode"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found, but no critical errors.${NC}"
    echo -e "${GREEN}You can proceed, but consider fixing warnings.${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo -e "${RED}Please fix the errors before building.${NC}"
    exit 1
fi


