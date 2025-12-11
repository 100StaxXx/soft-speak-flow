# Cleanup script that uses SUPABASE_ACCESS_TOKEN environment variable
# Usage: $env:SUPABASE_ACCESS_TOKEN="your-token"; .\scripts\cleanup-with-token.ps1

param(
    [string]$Token = $env:SUPABASE_ACCESS_TOKEN
)

$ErrorActionPreference = "Stop"

if (-not $Token) {
    Write-Host "❌ SUPABASE_ACCESS_TOKEN not provided" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  `$env:SUPABASE_ACCESS_TOKEN='your-token'; .\scripts\cleanup-with-token.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Or get a token from: https://supabase.com/dashboard/account/tokens" -ForegroundColor Cyan
    exit 1
}

Write-Host "🔍 Starting cleanup with provided token..." -ForegroundColor Cyan
Write-Host ""

# Set the token for this session
$env:SUPABASE_ACCESS_TOKEN = $Token

# Check if functions exist and delete them
Write-Host "📋 Checking deployed functions..." -ForegroundColor Cyan
try {
    $functions = npx supabase functions list 2>&1
    $functionsOutput = $functions -join "`n"
    
    if ($functionsOutput -match "apple-native-auth") {
        Write-Host "🔴 Found apple-native-auth function" -ForegroundColor Red
        Write-Host "   Deleting..." -ForegroundColor Yellow
        npx supabase functions delete apple-native-auth 2>&1 | Out-Null
        Write-Host "   ✅ Deleted apple-native-auth" -ForegroundColor Green
    } else {
        Write-Host "✅ apple-native-auth not found (already deleted or never deployed)" -ForegroundColor Green
    }
    
    if ($functionsOutput -match "google-native-auth") {
        Write-Host "🔴 Found google-native-auth function" -ForegroundColor Red
        Write-Host "   Deleting..." -ForegroundColor Yellow
        npx supabase functions delete google-native-auth 2>&1 | Out-Null
        Write-Host "   ✅ Deleted google-native-auth" -ForegroundColor Green
    } else {
        Write-Host "✅ google-native-auth not found (already deleted or never deployed)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not list functions: $_" -ForegroundColor Yellow
    Write-Host "   Trying to delete anyway..." -ForegroundColor Yellow
    try {
        npx supabase functions delete apple-native-auth 2>&1 | Out-Null
        Write-Host "   ✅ Attempted to delete apple-native-auth" -ForegroundColor Green
    } catch {}
    try {
        npx supabase functions delete google-native-auth 2>&1 | Out-Null
        Write-Host "   ✅ Attempted to delete google-native-auth" -ForegroundColor Green
    } catch {}
}

Write-Host ""
Write-Host "🔍 Checking secrets..." -ForegroundColor Cyan

try {
    $secrets = npx supabase secrets list 2>&1
    $secretsOutput = $secrets -join "`n"
    
    if ($secretsOutput -match "GOOGLE_WEB_CLIENT_ID\b" -and $secretsOutput -notmatch "VITE_GOOGLE_WEB_CLIENT_ID") {
        Write-Host "⚠️  Found GOOGLE_WEB_CLIENT_ID secret (without VITE_ prefix)" -ForegroundColor Yellow
        Write-Host "   This was only used by the deleted function. Removing..." -ForegroundColor Gray
        npx supabase secrets unset GOOGLE_WEB_CLIENT_ID 2>&1 | Out-Null
        Write-Host "   ✅ Removed GOOGLE_WEB_CLIENT_ID" -ForegroundColor Green
    } else {
        Write-Host "✅ GOOGLE_WEB_CLIENT_ID not found or VITE_ version exists" -ForegroundColor Green
    }
    
    if ($secretsOutput -match "GOOGLE_IOS_CLIENT_ID\b" -and $secretsOutput -notmatch "VITE_GOOGLE_IOS_CLIENT_ID") {
        Write-Host "⚠️  Found GOOGLE_IOS_CLIENT_ID secret (without VITE_ prefix)" -ForegroundColor Yellow
        Write-Host "   This was only used by the deleted function. Removing..." -ForegroundColor Gray
        npx supabase secrets unset GOOGLE_IOS_CLIENT_ID 2>&1 | Out-Null
        Write-Host "   ✅ Removed GOOGLE_IOS_CLIENT_ID" -ForegroundColor Green
    } else {
        Write-Host "✅ GOOGLE_IOS_CLIENT_ID not found or VITE_ version exists" -ForegroundColor Green
    }
    
    if ($secretsOutput -match "APPLE_SERVICE_ID") {
        Write-Host "ℹ️  Found APPLE_SERVICE_ID secret" -ForegroundColor Cyan
        Write-Host "   ✅ KEEPING - Still used in apple-webhook function" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not list secrets: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✨ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Summary:" -ForegroundColor Cyan
Write-Host "   - Orphaned functions: Deleted (if they existed)" -ForegroundColor Gray
Write-Host "   - Secrets: Checked and cleaned up" -ForegroundColor Gray
Write-Host "   - APPLE_SERVICE_ID: Kept (still in use)" -ForegroundColor Gray

