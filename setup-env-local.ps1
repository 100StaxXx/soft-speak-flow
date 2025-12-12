# Setup .env.local file for Vite frontend
# This script creates .env.local with placeholder values

$envFile = ".env.local"
$envExample = @"
# ============================================
# Frontend Environment Variables (.env.local)
# ============================================
# IMPORTANT: Replace all placeholder values with your actual credentials
# This file is gitignored and will not be committed to version control

# --------------------------------------------
# Firebase Configuration (Required)
# --------------------------------------------
# Get these from: https://console.firebase.google.com/project/cosmiq-prod/settings/general
# Click on your web app to see the config values
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=cosmiq-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=cosmiq-prod
VITE_FIREBASE_STORAGE_BUCKET=cosmiq-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# --------------------------------------------
# OAuth & Authentication (Required for native auth)
# --------------------------------------------
# Get these from: https://console.cloud.google.com/apis/credentials
VITE_GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
VITE_GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id

# --------------------------------------------
# Push Notifications (Required)
# --------------------------------------------
# Get this from: Firebase Console > Cloud Messaging > Web Push certificates
# Or generate using: npm run generate-vapid-keys (if available)
VITE_WEB_PUSH_KEY=your_vapid_public_key

# --------------------------------------------
# Native Redirects (Required)
# --------------------------------------------
# Base URL for native (Capacitor) authentication redirects
VITE_NATIVE_REDIRECT_BASE=https://app.cosmiq.quest

# --------------------------------------------
# Supabase (Optional - Only for migration scripts)
# --------------------------------------------
# These are only needed if running migration scripts
# Not used in the frontend application code
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
"@

if (Test-Path $envFile) {
    Write-Host "⚠️  .env.local already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Cancelled. Existing .env.local was not modified." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Creating .env.local file..." -ForegroundColor Green
$envExample | Out-File -FilePath $envFile -Encoding utf8

Write-Host "✅ .env.local file created!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Edit .env.local and replace all placeholder values with your actual credentials." -ForegroundColor Yellow
Write-Host "   See FIREBASE-SETUP.md for instructions on how to get these values." -ForegroundColor Yellow
Write-Host ""

