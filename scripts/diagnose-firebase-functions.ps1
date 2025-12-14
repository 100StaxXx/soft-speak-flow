#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Diagnostic script for Firebase Cloud Functions issues
    
.DESCRIPTION
    Checks Firebase Functions configuration, secrets, and deployment status
    to help diagnose FirebaseError: internal errors
#>

Write-Host "🔍 Firebase Functions Diagnostic Tool" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Check if firebase CLI is installed
Write-Host "1. Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseVersion = firebase --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Firebase CLI installed: $firebaseVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ Firebase CLI not found. Install with: npm install -g firebase-tools" -ForegroundColor Red
    exit 1
}

# Check if logged in
Write-Host "`n2. Checking Firebase login status..." -ForegroundColor Yellow
$firebaseUser = firebase login:list 2>&1 | Select-String "email"
if ($firebaseUser) {
    Write-Host "   ✅ Logged in: $firebaseUser" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Not logged in. Run: firebase login" -ForegroundColor Yellow
}

# Get current project
Write-Host "`n3. Checking current Firebase project..." -ForegroundColor Yellow
$projectId = (Get-Content .firebaserc | ConvertFrom-Json).projects.default
Write-Host "   📦 Project ID: $projectId" -ForegroundColor Cyan

# Check required secrets
Write-Host "`n4. Checking Firebase Functions Secrets..." -ForegroundColor Yellow
$requiredSecrets = @("GEMINI_API_KEY", "ELEVENLABS_API_KEY", "OPENAI_API_KEY")
$missingSecrets = @()

foreach ($secret in $requiredSecrets) {
    $secretExists = firebase functions:secrets:access $secret --project $projectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ $secret is configured" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $secret is MISSING" -ForegroundColor Red
        $missingSecrets += $secret
    }
}

# Check functions deployment status
Write-Host "`n5. Checking deployed functions..." -ForegroundColor Yellow
Write-Host "   Fetching function list from Firebase..." -ForegroundColor Gray
$functions = firebase functions:list --project $projectId 2>&1 | Select-String "generate"
if ($functions) {
    Write-Host "   ✅ Functions deployed:" -ForegroundColor Green
    $functions | ForEach-Object { Write-Host "      - $_" -ForegroundColor Gray }
} else {
    Write-Host "   ⚠️  Could not fetch function list. Try: firebase functions:list" -ForegroundColor Yellow
}

# Check Firebase Storage
Write-Host "`n6. Checking Firebase Storage..." -ForegroundColor Yellow
Write-Host "   📝 Default bucket should be: ${projectId}.appspot.com" -ForegroundColor Cyan
Write-Host "   🔗 Check in Firebase Console: https://console.firebase.google.com/project/$projectId/storage" -ForegroundColor Cyan

# Check package.json dependencies
Write-Host "`n7. Checking functions dependencies..." -ForegroundColor Yellow
if (Test-Path "functions/package.json") {
    $packageJson = Get-Content "functions/package.json" | ConvertFrom-Json
    $deps = @("form-data", "firebase-admin", "firebase-functions")
    
    foreach ($dep in $deps) {
        if ($packageJson.dependencies.$dep) {
            Write-Host "   ✅ $dep@$($packageJson.dependencies.$dep)" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $dep is MISSING" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ❌ functions/package.json not found" -ForegroundColor Red
}

# Summary and recommendations
Write-Host "`n📋 SUMMARY" -ForegroundColor Cyan
Write-Host "==========`n" -ForegroundColor Cyan

if ($missingSecrets.Count -gt 0) {
    Write-Host "⚠️  MISSING SECRETS:" -ForegroundColor Red
    foreach ($secret in $missingSecrets) {
        Write-Host "   - $secret" -ForegroundColor Yellow
        Write-Host "     Set with: firebase functions:secrets:set $secret --project $projectId" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "🔧 RECOMMENDED ACTIONS:" -ForegroundColor Cyan
Write-Host "1. Ensure all secrets are set (see above)" -ForegroundColor White
Write-Host "2. Verify Firebase Storage default bucket exists:" -ForegroundColor White
Write-Host "   https://console.firebase.google.com/project/$projectId/storage" -ForegroundColor Gray
Write-Host "3. Build and deploy functions:" -ForegroundColor White
Write-Host "   cd functions" -ForegroundColor Gray
Write-Host "   npm run build" -ForegroundColor Gray
Write-Host "   cd .." -ForegroundColor Gray
Write-Host "   firebase deploy --only functions --project $projectId" -ForegroundColor Gray
Write-Host "4. Check function logs for detailed errors:" -ForegroundColor White
Write-Host "   firebase functions:log --project $projectId" -ForegroundColor Gray
Write-Host "   Or in console: https://console.firebase.google.com/project/$projectId/functions/logs" -ForegroundColor Gray

Write-Host "`n✅ Diagnostic complete!" -ForegroundColor Green
