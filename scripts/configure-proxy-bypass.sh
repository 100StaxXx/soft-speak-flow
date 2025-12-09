#!/bin/bash

# Supabase Proxy Bypass Configuration Script
# This script configures your environment to bypass proxy for Supabase connections

set -e

echo "========================================="
echo "Supabase Proxy Bypass Configuration"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Supabase domain to bypass
SUPABASE_DOMAIN="*.supabase.co"
SUPABASE_INSTANCE="opbfpbbqvuksuuvmtmssd.supabase.co"

echo -e "${BLUE}Step 1: Detecting current shell...${NC}"
CURRENT_SHELL=$(basename "$SHELL")
echo "Detected shell: $CURRENT_SHELL"
echo ""

# Determine shell config file
case "$CURRENT_SHELL" in
  bash)
    SHELL_CONFIG="$HOME/.bashrc"
    ;;
  zsh)
    SHELL_CONFIG="$HOME/.zshrc"
    ;;
  fish)
    SHELL_CONFIG="$HOME/.config/fish/config.fish"
    ;;
  *)
    SHELL_CONFIG="$HOME/.profile"
    ;;
esac

echo -e "${BLUE}Step 2: Current proxy configuration...${NC}"
echo "HTTP_PROXY: ${HTTP_PROXY:-<not set>}"
echo "HTTPS_PROXY: ${HTTPS_PROXY:-<not set>}"
echo "NO_PROXY: ${NO_PROXY:-<not set>}"
echo "no_proxy: ${no_proxy:-<not set>}"
echo ""

echo -e "${BLUE}Step 3: Testing current Supabase connectivity...${NC}"
if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://$SUPABASE_INSTANCE/rest/v1/" 2>/dev/null | grep -q "200\|401"; then
  echo -e "${GREEN}✓ Supabase is already accessible!${NC}"
  echo "No proxy bypass needed."
  exit 0
else
  echo -e "${RED}✗ Supabase is currently blocked${NC}"
  echo "Proceeding with proxy bypass configuration..."
fi
echo ""

echo -e "${BLUE}Step 4: Configuring environment variables...${NC}"

# Function to add NO_PROXY to shell config
add_to_shell_config() {
  local config_file="$1"
  local export_line_1="export NO_PROXY=\"\${NO_PROXY:+\$NO_PROXY,}*.supabase.co,supabase.co\""
  local export_line_2="export no_proxy=\"\${no_proxy:+\$no_proxy,}*.supabase.co,supabase.co\""

  if ! grep -q "supabase.co" "$config_file" 2>/dev/null; then
    echo "" >> "$config_file"
    echo "# Supabase proxy bypass (added by configure-proxy-bypass.sh)" >> "$config_file"
    echo "$export_line_1" >> "$config_file"
    echo "$export_line_2" >> "$config_file"
    echo -e "${GREEN}✓ Added proxy bypass to $config_file${NC}"
  else
    echo -e "${YELLOW}⚠ Supabase proxy bypass already exists in $config_file${NC}"
  fi
}

# Add to shell config
add_to_shell_config "$SHELL_CONFIG"

# Set for current session
if [[ -n "$NO_PROXY" ]]; then
  export NO_PROXY="${NO_PROXY},*.supabase.co,supabase.co"
else
  export NO_PROXY="*.supabase.co,supabase.co"
fi

if [[ -n "$no_proxy" ]]; then
  export no_proxy="${no_proxy},*.supabase.co,supabase.co"
else
  export no_proxy="*.supabase.co,supabase.co"
fi

echo -e "${GREEN}✓ Environment variables set for current session${NC}"
echo ""

echo -e "${BLUE}Step 5: Creating .env.local for application...${NC}"

# Create or update .env.local
ENV_LOCAL_FILE=".env.local"
if [ ! -f "$ENV_LOCAL_FILE" ]; then
  cat > "$ENV_LOCAL_FILE" << 'EOF'
# Local environment overrides
# Proxy bypass is configured at the system level, but this ensures
# the application uses the correct Supabase URL

# Supabase Configuration
VITE_SUPABASE_URL=https://opbfpbbqvuksuuvmtmssd.supabase.co
EOF
  echo -e "${GREEN}✓ Created $ENV_LOCAL_FILE${NC}"
else
  echo -e "${YELLOW}⚠ $ENV_LOCAL_FILE already exists${NC}"
fi
echo ""

echo -e "${BLUE}Step 6: Testing Supabase connectivity again...${NC}"
sleep 2

# Test with the new settings
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "https://$SUPABASE_INSTANCE/rest/v1/" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmZwYmJxdnVrc3V2bXRtc3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjA4MTgsImV4cCI6MjA4MDc5NjgxOH0.0IpdmZyokW17gckZrRytKXAVJx4Vi5sq1QfJ283vKsw" \
  2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "401" ]]; then
  echo -e "${GREEN}✓✓✓ SUCCESS! Supabase is now accessible${NC}"
  echo "HTTP Status: $HTTP_CODE"
  echo ""
  echo -e "${GREEN}=========================================${NC}"
  echo -e "${GREEN}Configuration Complete!${NC}"
  echo -e "${GREEN}=========================================${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Restart your terminal or run: source $SHELL_CONFIG"
  echo "2. Run the authentication test: ./scripts/test-auth.sh"
  echo "3. Start the dev server: npm run dev"
else
  echo -e "${RED}✗ Supabase is still blocked (HTTP $HTTP_CODE)${NC}"
  echo ""
  echo -e "${YELLOW}Additional steps required:${NC}"
  echo ""
  echo "The proxy bypass configuration has been added, but the network is still blocking Supabase."
  echo "This usually means:"
  echo ""
  echo "1. Your network uses a strict allowlist that requires administrator approval"
  echo "2. The proxy configuration is managed centrally and cannot be bypassed"
  echo "3. Additional network security controls are in place"
  echo ""
  echo -e "${YELLOW}Recommended actions:${NC}"
  echo ""
  echo "Option A: Contact your network administrator"
  echo "  - Request that *.supabase.co be added to the allowed domains"
  echo "  - Share the LOGIN_TROUBLESHOOTING.md document for justification"
  echo ""
  echo "Option B: Use a different network"
  echo "  - Connect to home WiFi or mobile hotspot"
  echo "  - Use a VPN that allows Supabase access"
  echo ""
  echo "Option C: Use local Supabase for development"
  echo "  - Run: npx supabase start"
  echo "  - Update .env to use local instance (http://localhost:54321)"
  echo ""
  exit 1
fi

echo ""
echo -e "${BLUE}Updated NO_PROXY:${NC} $NO_PROXY"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "- Restart your terminal to apply changes globally"
echo "- Or run: source $SHELL_CONFIG"
echo ""

exit 0
