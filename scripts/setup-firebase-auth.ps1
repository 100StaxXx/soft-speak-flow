#!/usr/bin/env pwsh
# Firebase Authentication Setup Helper for Windows
# This script helps you set up Firebase authentication for running scripts

Write-Host "🔐 Firebase Authentication Setup" -ForegroundColor Cyan
Write-Host ("=" * 50)

# Check if service account file exists
$serviceAccountPath = $env:GOOGLE_APPLICATION_CREDENTIALS

if ($serviceAccountPath -and (Test-Path $serviceAccountPath)) {
    Write-Host "✅ Service account already configured!" -ForegroundColor Green
    Write-Host "   Path: $serviceAccountPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "You can now run: npm run seed:quotes" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "No service account found. Let's set one up!" -ForegroundColor Yellow
Write-Host ""

# Option 1: Service Account
Write-Host "Option 1: Use Service Account (Recommended)" -ForegroundColor Cyan
Write-Host "  1. Go to: https://console.firebase.google.com/project/cosmiq-prod/settings/serviceaccounts/adminsdk"
Write-Host "  2. Click 'Generate New Private Key'"
Write-Host "  3. Save the JSON file somewhere secure"
Write-Host ""

$useServiceAccount = Read-Host "Do you have a service account JSON file? (y/n)"

if ($useServiceAccount -eq 'y' -or $useServiceAccount -eq 'Y') {
    Write-Host ""
    $filePath = Read-Host "Enter the full path to your service account JSON file"
    
    if (Test-Path $filePath) {
        # Validate it's a JSON file
        try {
            $json = Get-Content $filePath | ConvertFrom-Json
            if ($json.type -eq "service_account") {
                # Set environment variable for current session
                $env:GOOGLE_APPLICATION_CREDENTIALS = $filePath
                
                Write-Host ""
                Write-Host "✅ Service account configured for this session!" -ForegroundColor Green
                Write-Host ""
                Write-Host "To make this permanent, run:" -ForegroundColor Yellow
                Write-Host "  [System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', '$filePath', 'User')" -ForegroundColor Gray
                Write-Host ""
                Write-Host "Or use setx (requires new terminal):" -ForegroundColor Yellow
                Write-Host "  setx GOOGLE_APPLICATION_CREDENTIALS `"$filePath`"" -ForegroundColor Gray
                Write-Host ""
                
                $makePermanent = Read-Host "Make this permanent now? (y/n)"
                if ($makePermanent -eq 'y' -or $makePermanent -eq 'Y') {
                    try {
                        [System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', $filePath, 'User')
                        Write-Host "✅ Environment variable set permanently!" -ForegroundColor Green
                        Write-Host "   (You may need to restart your terminal)" -ForegroundColor Yellow
                    }
                    catch {
                        Write-Host "⚠️  Could not set permanently. Please run as administrator or use setx command." -ForegroundColor Yellow
                    }
                }
                
                Write-Host ""
                Write-Host "You can now run: npm run seed:quotes" -ForegroundColor Green
                exit 0
            } else {
                Write-Host "❌ File doesn't appear to be a valid service account JSON" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ Error reading JSON file: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ File not found: $filePath" -ForegroundColor Red
    }
}

# Option 2: gcloud
Write-Host ""
Write-Host "Option 2: Use gcloud Authentication" -ForegroundColor Cyan
Write-Host "  This uses your personal Google Cloud credentials"
Write-Host ""

$useGcloud = Read-Host "Do you want to use gcloud authentication? (y/n)"

if ($useGcloud -eq 'y' -or $useGcloud -eq 'Y') {
    # Check if gcloud is installed
    $gcloudInstalled = Get-Command gcloud -ErrorAction SilentlyContinue
    
    if (-not $gcloudInstalled) {
        Write-Host ""
        Write-Host "❌ gcloud CLI not found" -ForegroundColor Red
        Write-Host ""
        Write-Host "Install it from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
        Write-Host "Or using Chocolatey: choco install gcloudsdk" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host ""
    Write-Host "Running: gcloud auth application-default login" -ForegroundColor Yellow
    Write-Host ""
    
    gcloud auth application-default login
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ gcloud authentication successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Setting project to cosmiq-prod..." -ForegroundColor Yellow
        gcloud config set project cosmiq-prod
        
        Write-Host ""
        Write-Host "You can now run: npm run seed:quotes" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "❌ gcloud authentication failed" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host ""
    Write-Host "No authentication method selected." -ForegroundColor Yellow
    Write-Host "See docs/FIREBASE_AUTH_SETUP.md for manual setup instructions." -ForegroundColor Yellow
    exit 1
}
