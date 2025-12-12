#!/bin/bash
# Firebase Authentication Setup Helper for Mac/Linux
# This script helps you set up Firebase authentication for running scripts

echo "🔐 Firebase Authentication Setup"
echo "=================================================="

# Check if service account file exists
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ] && [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "✅ Service account already configured!"
    echo "   Path: $GOOGLE_APPLICATION_CREDENTIALS"
    echo ""
    echo "You can now run: npm run seed:quotes"
    exit 0
fi

echo ""
echo "No service account found. Let's set one up!"
echo ""

# Option 1: Service Account
echo "Option 1: Use Service Account (Recommended)"
echo "  1. Go to: https://console.firebase.google.com/project/cosmiq-prod/settings/serviceaccounts/adminsdk"
echo "  2. Click 'Generate New Private Key'"
echo "  3. Save the JSON file somewhere secure"
echo ""

read -p "Do you have a service account JSON file? (y/n) " use_service_account

if [ "$use_service_account" = "y" ] || [ "$use_service_account" = "Y" ]; then
    echo ""
    read -p "Enter the full path to your service account JSON file: " file_path
    
    if [ -f "$file_path" ]; then
        # Validate it's a JSON file with service account
        if grep -q '"type": "service_account"' "$file_path" 2>/dev/null; then
            # Set environment variable for current session
            export GOOGLE_APPLICATION_CREDENTIALS="$file_path"
            
            echo ""
            echo "✅ Service account configured for this session!"
            echo ""
            echo "To make this permanent, add to ~/.bashrc or ~/.zshrc:"
            echo "  export GOOGLE_APPLICATION_CREDENTIALS=\"$file_path\""
            echo ""
            
            read -p "Make this permanent now? (y/n) " make_permanent
            if [ "$make_permanent" = "y" ] || [ "$make_permanent" = "Y" ]; then
                if [ -f ~/.zshrc ]; then
                    echo "export GOOGLE_APPLICATION_CREDENTIALS=\"$file_path\"" >> ~/.zshrc
                    echo "✅ Added to ~/.zshrc"
                    echo "   Run: source ~/.zshrc"
                elif [ -f ~/.bashrc ]; then
                    echo "export GOOGLE_APPLICATION_CREDENTIALS=\"$file_path\"" >> ~/.bashrc
                    echo "✅ Added to ~/.bashrc"
                    echo "   Run: source ~/.bashrc"
                else
                    echo "⚠️  Could not find ~/.bashrc or ~/.zshrc"
                    echo "   Please add manually: export GOOGLE_APPLICATION_CREDENTIALS=\"$file_path\""
                fi
            fi
            
            echo ""
            echo "You can now run: npm run seed:quotes"
            exit 0
        else
            echo "❌ File doesn't appear to be a valid service account JSON"
            exit 1
        fi
    else
        echo "❌ File not found: $file_path"
        exit 1
    fi
fi

# Option 2: gcloud
echo ""
echo "Option 2: Use gcloud Authentication"
echo "  This uses your personal Google Cloud credentials"
echo ""

read -p "Do you want to use gcloud authentication? (y/n) " use_gcloud

if [ "$use_gcloud" = "y" ] || [ "$use_gcloud" = "Y" ]; then
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        echo ""
        echo "❌ gcloud CLI not found"
        echo ""
        echo "Install it from: https://cloud.google.com/sdk/docs/install"
        echo "Or using Homebrew: brew install google-cloud-sdk"
        exit 1
    fi
    
    echo ""
    echo "Running: gcloud auth application-default login"
    echo ""
    
    gcloud auth application-default login
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ gcloud authentication successful!"
        echo ""
        echo "Setting project to cosmiq-prod..."
        gcloud config set project cosmiq-prod
        
        echo ""
        echo "You can now run: npm run seed:quotes"
    else
        echo ""
        echo "❌ gcloud authentication failed"
        exit 1
    fi
else
    echo ""
    echo "No authentication method selected."
    echo "See docs/FIREBASE_AUTH_SETUP.md for manual setup instructions."
    exit 1
fi
