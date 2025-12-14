#!/bin/bash

# Script to merge current branch to main for TestFlight deployment
# Usage: ./scripts/merge-to-main.sh

set -e  # Exit on error

echo "🔄 Merging to main branch for TestFlight deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH}${NC}"

# Check if we're already on main
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo -e "${YELLOW}⚠️  Already on main branch. Nothing to merge.${NC}"
  exit 0
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}⚠️  You have uncommitted changes.${NC}"
  echo -e "${YELLOW}Please commit or stash them before merging to main.${NC}"
  exit 1
fi

# Make sure current branch is pushed
echo -e "${YELLOW}📤 Pushing current branch to remote...${NC}"
git push origin "$CURRENT_BRANCH" || {
  echo -e "${RED}❌ Failed to push current branch${NC}"
  exit 1
}
echo -e "${GREEN}✅ Branch pushed${NC}"
echo ""

# Switch to main
echo -e "${YELLOW}🔄 Switching to main branch...${NC}"
git checkout main || {
  echo -e "${RED}❌ Failed to switch to main branch${NC}"
  exit 1
}

# Pull latest main
echo -e "${YELLOW}📥 Pulling latest main...${NC}"
git pull origin main || {
  echo -e "${RED}❌ Failed to pull main${NC}"
  exit 1
}
echo -e "${GREEN}✅ Main is up to date${NC}"
echo ""

# Merge the feature branch
echo -e "${YELLOW}🔀 Merging ${CURRENT_BRANCH} into main...${NC}"
git merge "$CURRENT_BRANCH" --no-edit || {
  echo -e "${RED}❌ Merge failed. Resolve conflicts and try again.${NC}"
  exit 1
}
echo -e "${GREEN}✅ Merge successful${NC}"
echo ""

# Push to main
echo -e "${YELLOW}📤 Pushing main to remote...${NC}"
git push origin main || {
  echo -e "${RED}❌ Failed to push main${NC}"
  exit 1
}
echo -e "${GREEN}✅ Main pushed successfully${NC}"
echo ""

echo -e "${GREEN}🎉 Successfully merged ${CURRENT_BRANCH} to main!${NC}"
echo -e "${YELLOW}You can now run the TestFlight deployment script.${NC}"
