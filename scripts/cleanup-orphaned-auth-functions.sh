#!/bin/bash

# Cleanup script for orphaned authentication edge functions
# This script undeploys the apple-native-auth and google-native-auth functions
# and optionally removes unused secrets

set -e

echo "🔍 Checking for orphaned authentication functions..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if project is linked
if ! supabase status &> /dev/null; then
    echo "⚠️  Supabase project not linked. Linking now..."
    echo "   Please run: supabase link --project-ref <your-project-ref>"
    exit 1
fi

echo "📋 Listing deployed functions..."
FUNCTIONS=$(supabase functions list 2>&1)

# Check if functions exist
if echo "$FUNCTIONS" | grep -q "apple-native-auth"; then
    echo "🔴 Found apple-native-auth function"
    echo "   Deleting apple-native-auth..."
    supabase functions delete apple-native-auth
    echo "   ✅ Deleted apple-native-auth"
else
    echo "✅ apple-native-auth not found (already deleted or never deployed)"
fi

if echo "$FUNCTIONS" | grep -q "google-native-auth"; then
    echo "🔴 Found google-native-auth function"
    echo "   Deleting google-native-auth..."
    supabase functions delete google-native-auth
    echo "   ✅ Deleted google-native-auth"
else
    echo "✅ google-native-auth not found (already deleted or never deployed)"
fi

echo ""
echo "🔍 Checking secrets..."
echo ""

# List secrets
SECRETS=$(supabase secrets list 2>&1)

# Check for secrets that might be safe to remove
if echo "$SECRETS" | grep -q "GOOGLE_WEB_CLIENT_ID"; then
    echo "⚠️  Found GOOGLE_WEB_CLIENT_ID secret"
    echo "   This was only used by the deleted google-native-auth function"
    echo "   Frontend uses VITE_GOOGLE_WEB_CLIENT_ID (different variable)"
    read -p "   Remove GOOGLE_WEB_CLIENT_ID? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        supabase secrets unset GOOGLE_WEB_CLIENT_ID
        echo "   ✅ Removed GOOGLE_WEB_CLIENT_ID"
    else
        echo "   ⏭️  Skipped removing GOOGLE_WEB_CLIENT_ID"
    fi
else
    echo "✅ GOOGLE_WEB_CLIENT_ID not found in secrets"
fi

if echo "$SECRETS" | grep -q "GOOGLE_IOS_CLIENT_ID"; then
    echo "⚠️  Found GOOGLE_IOS_CLIENT_ID secret"
    echo "   This was only used by the deleted google-native-auth function"
    echo "   Frontend uses VITE_GOOGLE_IOS_CLIENT_ID (different variable)"
    read -p "   Remove GOOGLE_IOS_CLIENT_ID? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        supabase secrets unset GOOGLE_IOS_CLIENT_ID
        echo "   ✅ Removed GOOGLE_IOS_CLIENT_ID"
    else
        echo "   ⏭️  Skipped removing GOOGLE_IOS_CLIENT_ID"
    fi
else
    echo "✅ GOOGLE_IOS_CLIENT_ID not found in secrets"
fi

# Note about APPLE_SERVICE_ID
if echo "$SECRETS" | grep -q "APPLE_SERVICE_ID"; then
    echo "ℹ️  Found APPLE_SERVICE_ID secret"
    echo "   ✅ KEEPING - Still used in apple-webhook function"
fi

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "📝 Summary:"
echo "   - Orphaned functions: Deleted (if they existed)"
echo "   - Secrets: Checked and optionally removed"
echo "   - APPLE_SERVICE_ID: Kept (still in use)"

