# Deploy Firebase Functions Script
# This script helps deploy Firebase Cloud Functions and set required secrets
# Usage:
#   .\scripts\deploy-firebase-functions.ps1                 # Interactive mode
#   .\scripts\deploy-firebase-functions.ps1 -SkipSecrets    # Skip secret setup
#   .\scripts\deploy-firebase-functions.ps1 -AutoDeploy     # Auto-deploy without prompts

param(
    [switch]$SkipSecrets,
    [switch]$AutoDeploy,
    [switch]$NonInteractive
)

Write-Host "🚀 Firebase Functions Deployment Script" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a secret is set
function Test-FirebaseSecret {
    param([string]$SecretName)
    try {
        $result = firebase functions:secrets:access $SecretName 2>&1
        return $LASTEXITCODE -eq 0 -and $result -ne $null -and $result.Length -gt 0
    } catch {
        return $false
    }
}

# Check if Firebase CLI is installed
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI installed: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Please install it:" -ForegroundColor Red
    Write-Host "   npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check Node.js version
Write-Host ""
Write-Host "Checking Node.js version..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -ge 18) {
        Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Node.js version $nodeVersion detected. Recommended: Node.js 18+ (functions use Node.js 20)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not check Node.js version" -ForegroundColor Yellow
}

# Check if logged in
Write-Host ""
Write-Host "Checking Firebase login status..." -ForegroundColor Yellow
try {
    $projects = firebase projects:list 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Not logged in. Please run: firebase login" -ForegroundColor Yellow
        if (-not $NonInteractive) {
            $login = Read-Host "Login now? (y/n)"
            if ($login -eq "y") {
                firebase login
            } else {
                exit 1
            }
        } else {
            exit 1
        }
    } else {
        Write-Host "✅ Logged into Firebase" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Error checking login status" -ForegroundColor Red
    exit 1
}

# Set project
Write-Host ""
Write-Host "Setting Firebase project to cosmiq-prod..." -ForegroundColor Yellow
firebase use cosmiq-prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set project" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Project set to cosmiq-prod" -ForegroundColor Green

# Build functions
Write-Host ""
Write-Host "Building functions..." -ForegroundColor Yellow
Set-Location functions
if (Test-Path "node_modules") {
    Write-Host "✅ node_modules exists" -ForegroundColor Green
} else {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

Write-Host "Building TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Check errors above." -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green
Set-Location ..

# Check and set secrets
$secrets = @(
    @{Name="APPLE_SHARED_SECRET"; Description="App Store Shared Secret (from App Store Connect)"; Required=$true},
    @{Name="APPLE_SERVICE_ID"; Description="Apple Service ID"; Default="com.darrylgraham.revolution.web"; Required=$true},
    @{Name="APPLE_IOS_BUNDLE_ID"; Description="iOS Bundle ID"; Default="com.darrylgraham.revolution"; Required=$true},
    @{Name="APPLE_WEBHOOK_AUDIENCE"; Description="Apple Webhook Audience"; Default="appstoreconnect-v1"; Required=$true},
    @{Name="GEMINI_API_KEY"; Description="Gemini API Key (from Google Cloud Console)"; Required=$true},
    @{Name="OPENAI_API_KEY"; Description="OpenAI API Key"; Required=$true},
    @{Name="ELEVENLABS_API_KEY"; Description="ElevenLabs API Key"; Required=$true},
    @{Name="VAPID_PUBLIC_KEY"; Description="VAPID Public Key (for web push)"; Required=$false},
    @{Name="VAPID_PRIVATE_KEY"; Description="VAPID Private Key (for web push)"; Required=$false},
    @{Name="VAPID_SUBJECT"; Description="VAPID Subject"; Default="mailto:admin@cosmiq.quest"; Required=$false},
    @{Name="APNS_KEY_ID"; Description="APNS Key ID (for iOS push)"; Required=$false},
    @{Name="APNS_TEAM_ID"; Description="APNS Team ID (Apple Developer Team ID)"; Required=$false},
    @{Name="APNS_BUNDLE_ID"; Description="APNS Bundle ID"; Default="com.darrylgraham.revolution"; Required=$false},
    @{Name="APNS_AUTH_KEY"; Description="APNS Auth Key (contents of .p8 file)"; Required=$false},
    @{Name="APNS_ENVIRONMENT"; Description="APNS Environment"; Default="production"; Required=$false},
    @{Name="PAYPAL_CLIENT_ID"; Description="PayPal Client ID (optional)"; Required=$false},
    @{Name="PAYPAL_SECRET"; Description="PayPal Secret (optional)"; Required=$false}
)

if (-not $SkipSecrets) {
    Write-Host ""
    Write-Host "🔐 Secrets Configuration" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check existing secrets
    Write-Host "Checking existing secrets..." -ForegroundColor Yellow
    $missingRequired = @()
    $secretStatus = @{}
    
    foreach ($secret in $secrets) {
        $isSet = Test-FirebaseSecret -SecretName $secret.Name
        $secretStatus[$secret.Name] = $isSet
        
        if ($isSet) {
            Write-Host "✅ $($secret.Name) - SET" -ForegroundColor Green
        } else {
            if ($secret.Required) {
                Write-Host "❌ $($secret.Name) - NOT SET (REQUIRED)" -ForegroundColor Red
                $missingRequired += $secret
            } else {
                Write-Host "⚠️  $($secret.Name) - NOT SET (optional)" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host ""
    
    if ($missingRequired.Count -gt 0) {
        Write-Host "⚠️  Missing required secrets:" -ForegroundColor Yellow
        foreach ($secret in $missingRequired) {
            Write-Host "   - $($secret.Name): $($secret.Description)" -ForegroundColor Gray
        }
        Write-Host ""
        
        if (-not $NonInteractive) {
            $setSecrets = if ($AutoDeploy) { "y" } else { Read-Host "Set missing secrets now? (y/n)" }
            
            if ($setSecrets -eq "y") {
                Write-Host ""
                Write-Host "Setting secrets. You'll be prompted for each value." -ForegroundColor Yellow
                Write-Host ""
                
                foreach ($secret in $missingRequired) {
                    $displayText = $secret.Description
                    if ($secret.Default) {
                        $displayText += " (default: $($secret.Default))"
                    }
                    
                    Write-Host ""
                    Write-Host "Setting: $($secret.Name)" -ForegroundColor Cyan
                    Write-Host "  $displayText" -ForegroundColor Gray
                    
                    $value = $secret.Default
                    if (-not $value) {
                        $value = Read-Host "Enter value"
                    } else {
                        $useDefault = Read-Host "Use default '$value'? (y/n)"
                        if ($useDefault -ne "y") {
                            $value = Read-Host "Enter value"
                        }
                    }
                    
                    if ($value) {
                        Write-Host "Setting $($secret.Name)..." -ForegroundColor Yellow
                        $value | firebase functions:secrets:set $secret.Name
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host "✅ Set $($secret.Name)" -ForegroundColor Green
                            $secretStatus[$secret.Name] = $true
                        } else {
                            Write-Host "❌ Failed to set $($secret.Name)" -ForegroundColor Red
                        }
                    }
                }
                
                # Check for optional secrets
                Write-Host ""
                $setOptional = Read-Host "Set optional secrets? (y/n)"
                if ($setOptional -eq "y") {
                    $optionalSecrets = $secrets | Where-Object { -not $_.Required -and -not $secretStatus[$_.Name] }
                    foreach ($secret in $optionalSecrets) {
                        $displayText = $secret.Description
                        if ($secret.Default) {
                            $displayText += " (default: $($secret.Default))"
                        }
                        
                        Write-Host ""
                        $skip = Read-Host "Set $($secret.Name)? $displayText (y/n/skip)"
                        
                        if ($skip -eq "y") {
                            $value = $secret.Default
                            if (-not $value) {
                                $value = Read-Host "Enter value"
                            } else {
                                $useDefault = Read-Host "Use default '$value'? (y/n)"
                                if ($useDefault -ne "y") {
                                    $value = Read-Host "Enter value"
                                }
                            }
                            
                            if ($value) {
                                Write-Host "Setting $($secret.Name)..." -ForegroundColor Yellow
                                $value | firebase functions:secrets:set $secret.Name
                                if ($LASTEXITCODE -eq 0) {
                                    Write-Host "✅ Set $($secret.Name)" -ForegroundColor Green
                                } else {
                                    Write-Host "❌ Failed to set $($secret.Name)" -ForegroundColor Red
                                }
                            }
                        }
                    }
                }
            }
        } else {
            Write-Host "❌ Missing required secrets. Cannot deploy in non-interactive mode." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✅ All required secrets are set!" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "⏭️  Skipping secret configuration (SkipSecrets flag set)" -ForegroundColor Yellow
}

# Deploy functions
Write-Host ""
Write-Host ""
Write-Host "🚀 Deploying Functions" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

if (-not $AutoDeploy -and -not $NonInteractive) {
    Write-Host "This will deploy all functions to Firebase. This may take a few minutes." -ForegroundColor Yellow
    $deploy = Read-Host "Deploy now? (y/n)"
} else {
    $deploy = "y"
}

if ($deploy -eq "y") {
    Write-Host ""
    Write-Host "Deploying..." -ForegroundColor Yellow
    $deployOutput = firebase deploy --only functions 2>&1
    $deployOutput | Write-Host
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
        Write-Host ""
        
        # Try to extract webhook URL
        $webhookUrl = ""
        if ($deployOutput -match 'https://[^\s]+cloudfunctions\.net/appleWebhook') {
            $webhookUrl = $matches[0]
        } else {
            Write-Host "Getting webhook URL..." -ForegroundColor Yellow
            $functionsList = firebase functions:list 2>&1
            if ($functionsList -match 'appleWebhook.*(https://[^\s]+)') {
                $webhookUrl = $matches[1]
            }
        }
        
        Write-Host "📋 Next Steps:" -ForegroundColor Cyan
        Write-Host ""
        if ($webhookUrl) {
            Write-Host "✅ Apple Webhook URL:" -ForegroundColor Green
            Write-Host "   $webhookUrl" -ForegroundColor White
            Write-Host ""
            # Try to copy to clipboard
            try {
                Set-Clipboard -Value $webhookUrl
                Write-Host "✅ Webhook URL copied to clipboard!" -ForegroundColor Green
            }
            catch {
                # Clipboard not available, that's okay
            }
        }
        else {
            Write-Host "1. Find your appleWebhook function URL:" -ForegroundColor White
            Write-Host "   firebase functions:list" -ForegroundColor Gray
            Write-Host "   Or check: Firebase Console → Functions → appleWebhook" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "2. Update App Store Connect:" -ForegroundColor White
        Write-Host "   - Go to: https://appstoreconnect.apple.com" -ForegroundColor Gray
        Write-Host "   - Your App → App Information" -ForegroundColor Gray
        Write-Host "   - Update 'Server Notification URL' with the webhook URL above" -ForegroundColor Gray
        Write-Host ""
        Write-Host "3. Test subscription purchases in TestFlight" -ForegroundColor White
        Write-Host ""
        Write-Host "To view function logs:" -ForegroundColor Yellow
        Write-Host "  firebase functions:log" -ForegroundColor Gray
        Write-Host "  firebase functions:log --only appleWebhook" -ForegroundColor Gray
    }
    else {
        Write-Host ""
        Write-Host "❌ Deployment failed. Check errors above." -ForegroundColor Red
        Write-Host ""
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "  - Missing secrets (set them first)" -ForegroundColor Gray
        Write-Host "  - Build errors (check functions/src/index.ts)" -ForegroundColor Gray
        Write-Host "  - Firebase permissions" -ForegroundColor Gray
        Write-Host "  - Check logs: firebase functions:log" -ForegroundColor Gray
        exit 1
    }
}
else {
    Write-Host ""
    Write-Host "⏭️  Deployment skipped. Deploy manually with:" -ForegroundColor Yellow
    Write-Host "  firebase deploy --only functions" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✨ Done!" -ForegroundColor Cyan
