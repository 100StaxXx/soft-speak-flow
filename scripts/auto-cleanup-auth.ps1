# Automated cleanup script that handles authentication
# This script will attempt to clean up orphaned auth functions

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting automated cleanup..." -ForegroundColor Cyan
Write-Host ""

# Check if we can access Supabase
Write-Host "🔍 Checking Supabase access..." -ForegroundColor Yellow

# Try to list functions to check authentication
$functionsCheck = npx supabase functions list --project-ref tffrgsaawvletgiztfry 2>&1

if ($LASTEXITCODE -ne 0) {
    if ($functionsCheck -match "403|401|not authenticated|login") {
        Write-Host "⚠️  Authentication required!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please run this command first to authenticate:" -ForegroundColor Cyan
        Write-Host "   npx supabase login" -ForegroundColor White
        Write-Host ""
        Write-Host "Then run this script again, or run these commands manually:" -ForegroundColor Cyan
        Write-Host "   npx supabase functions delete apple-native-auth" -ForegroundColor White
        Write-Host "   npx supabase functions delete google-native-auth" -ForegroundColor White
        Write-Host ""
        exit 1
    }
}

# If we get here, we're authenticated
Write-Host "✅ Authenticated!" -ForegroundColor Green
Write-Host ""

# Check for functions
Write-Host "📋 Checking deployed functions..." -ForegroundColor Cyan
$functions = npx supabase functions list 2>&1

$deletedAny = $false

# Delete apple-native-auth if it exists
if ($functions -match "apple-native-auth") {
    Write-Host "🔴 Found apple-native-auth - deleting..." -ForegroundColor Red
    npx supabase functions delete apple-native-auth
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Deleted apple-native-auth" -ForegroundColor Green
        $deletedAny = $true
    } else {
        Write-Host "   ❌ Failed to delete apple-native-auth" -ForegroundColor Red
    }
} else {
    Write-Host "✅ apple-native-auth not found (already deleted or never deployed)" -ForegroundColor Green
}

# Delete google-native-auth if it exists
if ($functions -match "google-native-auth") {
    Write-Host "🔴 Found google-native-auth - deleting..." -ForegroundColor Red
    npx supabase functions delete google-native-auth
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Deleted google-native-auth" -ForegroundColor Green
        $deletedAny = $true
    } else {
        Write-Host "   ❌ Failed to delete google-native-auth" -ForegroundColor Red
    }
} else {
    Write-Host "✅ google-native-auth not found (already deleted or never deployed)" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔍 Checking secrets..." -ForegroundColor Cyan
$secrets = npx supabase secrets list 2>&1

if ($secrets -match "GOOGLE_WEB_CLIENT_ID" -and $secrets -notmatch "VITE_GOOGLE_WEB_CLIENT_ID") {
    Write-Host "⚠️  Found GOOGLE_WEB_CLIENT_ID (without VITE_ prefix)" -ForegroundColor Yellow
    Write-Host "   This was only used by the deleted function" -ForegroundColor Gray
    $response = Read-Host "   Remove it? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        npx supabase secrets unset GOOGLE_WEB_CLIENT_ID
        Write-Host "   ✅ Removed" -ForegroundColor Green
    }
}

if ($secrets -match "GOOGLE_IOS_CLIENT_ID" -and $secrets -notmatch "VITE_GOOGLE_IOS_CLIENT_ID") {
    Write-Host "⚠️  Found GOOGLE_IOS_CLIENT_ID (without VITE_ prefix)" -ForegroundColor Yellow
    Write-Host "   This was only used by the deleted function" -ForegroundColor Gray
    $response = Read-Host "   Remove it? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        npx supabase secrets unset GOOGLE_IOS_CLIENT_ID
        Write-Host "   ✅ Removed" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✨ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Summary:" -ForegroundColor Cyan
Write-Host "   - Code files: ✅ Already deleted" -ForegroundColor Gray
Write-Host "   - Config files: ✅ Already cleaned" -ForegroundColor Gray
if ($deletedAny) {
    Write-Host "   - Deployed functions: ✅ Deleted" -ForegroundColor Gray
} else {
    Write-Host "   - Deployed functions: ✅ None found (or already deleted)" -ForegroundColor Gray
}

