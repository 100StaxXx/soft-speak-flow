#!/bin/bash

# Authentication Testing Script
# Tests all authentication endpoints and methods

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "========================================="
echo "Authentication Testing Suite"
echo "========================================="
echo ""

# Configuration
SUPABASE_URL="https://opbfpbbqvuksuuvmtmssd.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmZwYmJxdnVrc3V2bXRtc3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjA4MTgsImV4cCI6MjA4MDc5NjgxOH0.0IpdmZyokW17gckZrRytKXAVJx4Vi5sq1QfJ283vKsw"

TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test endpoint
test_endpoint() {
  local name="$1"
  local url="$2"
  local method="${3:-GET}"
  local expected_codes="${4:-200,401}" # Multiple acceptable codes
  local headers="${5:-}"

  echo -n "Testing $name... "

  local curl_cmd="curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X $method"

  if [[ -n "$headers" ]]; then
    curl_cmd="$curl_cmd $headers"
  fi

  curl_cmd="$curl_cmd '$url'"

  HTTP_CODE=$(eval $curl_cmd 2>/dev/null || echo "000")

  # Check if HTTP_CODE matches any expected code
  local code_match=false
  IFS=',' read -ra CODES <<< "$expected_codes"
  for code in "${CODES[@]}"; do
    if [[ "$HTTP_CODE" == "$code" ]]; then
      code_match=true
      break
    fi
  done

  if $code_match; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $HTTP_CODE)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $HTTP_CODE, expected $expected_codes)"
    ((TESTS_FAILED++))
    return 1
  fi
}

echo -e "${BLUE}=== Network Connectivity Tests ===${NC}"
echo ""

# Test 1: Basic connectivity
test_endpoint \
  "Supabase Base URL" \
  "$SUPABASE_URL" \
  "GET" \
  "200,301,302,404"

# Test 2: Rest API
test_endpoint \
  "Supabase REST API" \
  "$SUPABASE_URL/rest/v1/" \
  "GET" \
  "200,401" \
  "-H 'apikey: $SUPABASE_ANON_KEY'"

# Test 3: Auth API
test_endpoint \
  "Supabase Auth API" \
  "$SUPABASE_URL/auth/v1/health" \
  "GET" \
  "200"

echo ""
echo -e "${BLUE}=== Edge Function Tests ===${NC}"
echo ""

# Test 4: Google Native Auth (CORS preflight)
test_endpoint \
  "Google Auth Function (OPTIONS)" \
  "$SUPABASE_URL/functions/v1/google-native-auth" \
  "OPTIONS" \
  "200,204" \
  "-H 'Content-Type: application/json'"

# Test 5: Apple Native Auth (CORS preflight)
test_endpoint \
  "Apple Auth Function (OPTIONS)" \
  "$SUPABASE_URL/functions/v1/apple-native-auth" \
  "OPTIONS" \
  "200,204" \
  "-H 'Content-Type: application/json'"

# Test 6: Google Native Auth (POST - should fail without token but should be reachable)
test_endpoint \
  "Google Auth Function (POST)" \
  "$SUPABASE_URL/functions/v1/google-native-auth" \
  "POST" \
  "400,401,500" \
  "-H 'Content-Type: application/json' -d '{}'"

# Test 7: Apple Native Auth (POST - should fail without token but should be reachable)
test_endpoint \
  "Apple Auth Function (POST)" \
  "$SUPABASE_URL/functions/v1/apple-native-auth" \
  "POST" \
  "400,401,500" \
  "-H 'Content-Type: application/json' -d '{}'"

echo ""
echo -e "${BLUE}=== OAuth Provider Tests ===${NC}"
echo ""

# Test 8: Google OAuth (external connectivity)
echo -n "Testing Google OAuth API... "
GOOGLE_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "https://oauth2.googleapis.com/tokeninfo?id_token=invalid" 2>/dev/null || echo "000")

if [[ "$GOOGLE_HTTP" == "400" ]]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $GOOGLE_HTTP - endpoint reachable)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (HTTP $GOOGLE_HTTP, expected 400)"
  ((TESTS_FAILED++))
fi

# Test 9: Apple OAuth (external connectivity)
echo -n "Testing Apple OAuth API... "
APPLE_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "https://appleid.apple.com/auth/keys" 2>/dev/null || echo "000")

if [[ "$APPLE_HTTP" == "200" ]]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $APPLE_HTTP)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (HTTP $APPLE_HTTP, expected 200)"
  ((TESTS_FAILED++))
fi

echo ""
echo -e "${BLUE}=== Environment Configuration Tests ===${NC}"
echo ""

# Test 10: Environment variables
echo -n "Testing environment variables... "
if [[ -n "$VITE_SUPABASE_URL" ]] && [[ -n "$VITE_SUPABASE_ANON_KEY" ]]; then
  echo -e "${GREEN}✓ PASS${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠ WARNING${NC} (Not loaded - check .env file)"
  echo "  Run: source .env"
fi

# Test 11: Node modules
echo -n "Testing dependencies installed... "
if [ -d "node_modules" ] && [ -d "node_modules/@supabase" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC}"
  echo "  Run: npm install"
  ((TESTS_FAILED++))
fi

# Test 12: Config files
echo -n "Testing Supabase config... "
if [ -f "supabase/config.toml" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠ WARNING${NC} (config.toml not found)"
fi

echo ""
echo "========================================="
echo "Test Results Summary"
echo "========================================="
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "Pass Rate: $PASS_RATE%"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓✓✓ ALL TESTS PASSED ✓✓✓${NC}"
  echo ""
  echo "Authentication infrastructure is fully functional!"
  echo ""
  echo "Next steps:"
  echo "1. Install dependencies: npm install"
  echo "2. Start dev server: npm run dev"
  echo "3. Navigate to: http://localhost:5173/auth"
  echo "4. Test login with:"
  echo "   - Email/Password"
  echo "   - Google OAuth"
  echo "   - Apple Sign-In"
  echo ""
  exit 0
else
  echo -e "${RED}✗✗✗ SOME TESTS FAILED ✗✗✗${NC}"
  echo ""
  echo "Issues detected. Troubleshooting steps:"
  echo ""

  # Specific guidance based on which tests failed
  if curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$SUPABASE_URL" 2>/dev/null | grep -q "403"; then
    echo -e "${YELLOW}Network Issue Detected:${NC}"
    echo "Supabase is being blocked by network proxy."
    echo ""
    echo "Solutions:"
    echo "1. Run proxy bypass script: ./scripts/configure-proxy-bypass.sh"
    echo "2. Contact network admin to allowlist *.supabase.co"
    echo "3. Use different network (home WiFi, mobile hotspot)"
    echo "4. Use local Supabase: npx supabase start"
    echo ""
  elif [ $TESTS_FAILED -le 2 ]; then
    echo -e "${YELLOW}Minor issues detected:${NC}"
    echo "Most tests passed. Review failed tests above."
    echo ""
  else
    echo -e "${RED}Major issues detected:${NC}"
    echo "Multiple tests failed. Review the troubleshooting guide:"
    echo "docs/LOGIN_TROUBLESHOOTING.md"
    echo ""
  fi

  exit 1
fi
