# APNS (Apple Push Notification Service) Setup Guide

This guide will help you configure APNS for sending push notifications to iOS devices.

## Required Information

You need the following information from your Apple Developer account:

1. **APNS Key ID**: `99379WF4MQ` (already provided)
2. **Team ID**: Found in your Apple Developer account (usually 10 characters, e.g., `B6VW78ABTR`)
3. **Bundle ID**: `com.darrylgraham.revolution` (already found in project)
4. **APNS Auth Key (.p8 file)**: The private key file downloaded from Apple Developer

## Step 1: Get Your Team ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Click on "Membership" in the sidebar
3. Your Team ID is displayed at the top (10 characters)

## Step 2: Download APNS Auth Key (.p8 file)

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Click on "Keys" in the sidebar
4. Find the key with ID `99379WF4MQ`
5. Download the `.p8` file (you can only download it once, so save it securely)
6. Open the `.p8` file in a text editor and copy its contents

## Step 3: Set Firebase Secrets

Run these commands to set the APNS configuration as Firebase Secrets:

```bash
# Set APNS Key ID
firebase functions:secrets:set APNS_KEY_ID

# When prompted, enter: 99379WF4MQ

# Set Team ID (replace with your actual Team ID)
firebase functions:secrets:set APNS_TEAM_ID

# When prompted, enter your Team ID (e.g., B6VW78ABTR)

# Set Bundle ID
firebase functions:secrets:set APNS_BUNDLE_ID

# When prompted, enter: com.darrylgraham.revolution

# Set APNS Auth Key (.p8 file content)
firebase functions:secrets:set APNS_AUTH_KEY

# When prompted, paste the entire contents of your .p8 file
# It should look like:
# -----BEGIN PRIVATE KEY-----
# MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
# -----END PRIVATE KEY-----

# Set APNS Environment (production or sandbox)
firebase functions:secrets:set APNS_ENVIRONMENT

# When prompted, enter: production
```

## Step 4: Update Function Configuration

After setting the secrets, you need to update the `sendApnsNotification` function to use them:

```bash
# Redeploy the function with secrets
firebase deploy --only functions:sendApnsNotification
```

## Step 5: Verify Configuration

You can test the APNS configuration by calling the `sendApnsNotification` function with a test device token.

## Notes

- The `.p8` key file can only be downloaded once from Apple Developer. Keep it secure.
- For development/testing, use `sandbox` environment. For production, use `production`.
- The Team ID is usually 10 characters and can be found in your Apple Developer account membership page.
- Make sure your iOS app has push notifications enabled in the App Store Connect and Xcode project settings.

## Troubleshooting

- **"APNs not configured" error**: Make sure all secrets are set correctly
- **"Invalid token" error**: Verify the device token is correct and the app is properly configured for push notifications
- **"Topic mismatch" error**: Ensure the Bundle ID matches exactly (case-sensitive)

