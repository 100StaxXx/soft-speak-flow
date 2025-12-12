# Cleanup script for orphaned authentication edge functions (PowerShell)
# This script undeploys the apple-native-auth and google-native-auth functions
# and optionally removes unused secrets

$ErrorActionPreference = "Stop"

Write-Host "🔍 Checking for orphaned authentication functions..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
try {
    $null = Get-Command supabase -ErrorAction Stop
} catch {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Check if project is linked
try {
    $null = supabase status 2>&1
} catch {
    Write-Host "⚠️  Supabase project not linked. Please link it first:" -ForegroundColor Yellow
    Write-Host "   supabase link --project-ref <your-project-ref>" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Listing deployed functions..." -ForegroundColor Cyan
$functions = supabase functions list 2>&1

# Check if functions exist
if ($functions -match "apple-native-auth") {
    Write-Host "🔴 Found apple-native-auth function" -ForegroundColor Red
    Write-Host "   Deleting apple-native-auth..." -ForegroundColor Yellow
    supabase functions delete apple-native-auth
    Write-Host "   ✅ Deleted apple-native-auth" -ForegroundColor Green
} else {
    Write-Host "✅ apple-native-auth not found (already deleted or never deployed)" -ForegroundColor Green
}

if ($functions -match "google-native-auth") {
    Write-Host "🔴 Found google-native-auth function" -ForegroundColor Red
    Write-Host "   Deleting google-native-auth..." -ForegroundColor Yellow
    supabase functions delete google-native-auth
    Write-Host "   ✅ Deleted google-native-auth" -ForegroundColor Green
} else {
    Write-Host "✅ google-native-auth not found (already deleted or never deployed)" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔍 Checking secrets..." -ForegroundColor Cyan
Write-Host ""

# List secrets
$secrets = supabase secrets list 2>&1

# Check for secrets that might be safe to remove
if ($secrets -match "GOOGLE_WEB_CLIENT_ID") {
    Write-Host "⚠️  Found GOOGLE_WEB_CLIENT_ID secret" -ForegroundColor Yellow
    Write-Host "   This was only used by the deleted google-native-auth function" -ForegroundColor Gray
    Write-Host "   Frontend uses VITE_GOOGLE_WEB_CLIENT_ID (different variable)" -ForegroundColor Gray
    $response = Read-Host "   Remove GOOGLE_WEB_CLIENT_ID? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        supabase secrets unset GOOGLE_WEB_CLIENT_ID
        Write-Host "   ✅ Removed GOOGLE_WEB_CLIENT_ID" -ForegroundColor Green
    } else {
        Write-Host "   ⏭️  Skipped removing GOOGLE_WEB_CLIENT_ID" -ForegroundColor Gray
    }
} else {
    Write-Host "✅ GOOGLE_WEB_CLIENT_ID not found in secrets" -ForegroundColor Green
}

if ($secrets -match "GOOGLE_IOS_CLIENT_ID") {
    Write-Host "⚠️  Found GOOGLE_IOS_CLIENT_ID secret" -ForegroundColor Yellow
    Write-Host "   This was only used by the deleted google-native-auth function" -ForegroundColor Gray
    Write-Host "   Frontend uses VITE_GOOGLE_IOS_CLIENT_ID (different variable)" -ForegroundColor Gray
    $response = Read-Host "   Remove GOOGLE_IOS_CLIENT_ID? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        supabase secrets unset GOOGLE_IOS_CLIENT_ID
        Write-Host "   ✅ Removed GOOGLE_IOS_CLIENT_ID" -ForegroundColor Green
    } else {
        Write-Host "   ⏭️  Skipped removing GOOGLE_IOS_CLIENT_ID" -ForegroundColor Gray
    }
} else {
    Write-Host "✅ GOOGLE_IOS_CLIENT_ID not found in secrets" -ForegroundColor Green
}

# Note about APPLE_SERVICE_ID
if ($secrets -match "APPLE_SERVICE_ID") {
    Write-Host "ℹ️  Found APPLE_SERVICE_ID secret" -ForegroundColor Cyan
    Write-Host "   ✅ KEEPING - Still used in apple-webhook function" -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Summary:" -ForegroundColor Cyan
Write-Host "   - Orphaned functions: Deleted (if they existed)" -ForegroundColor Gray
Write-Host "   - Secrets: Checked and optionally removed" -ForegroundColor Gray
Write-Host "   - APPLE_SERVICE_ID: Kept (still in use)" -ForegroundColor Gray

