# Setting PayPal Environment Variables

## Option 1: Firebase Console (Recommended for Quick Setup)

1. Go to: https://console.firebase.google.com/project/cosmiq-prod/functions
2. Click on any function (e.g., `processPaypalPayout`)
3. Go to the "Configuration" tab
4. Scroll to "Environment variables"
5. Add:
   - `PAYPAL_CLIENT_ID` = `[FULL_CLIENT_ID_HERE]`
   - `PAYPAL_SECRET` = `EOBowT84R_FGPqOB84X-uMwS3vEFP5tDXkgtUgv35PGdW7Dmqpdk_dLVpTAd0KkSm8zPbpYY8ivR_OCP`

**Note:** The Client ID you provided was truncated. Please provide the full value.

## Option 2: Using Secrets (More Secure)

The secrets have been created, but the functions need to be updated to use them. This requires code changes to use `defineSecret` in the function definitions.

## Current Status

✅ `PAYPAL_SECRET` secret created
⚠️ `PAYPAL_CLIENT_ID` secret created (but value was truncated - needs full value)

