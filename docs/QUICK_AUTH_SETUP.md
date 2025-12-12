# Quick Firebase Authentication Setup

## Quick Setup (Choose One Method)

### Method 1: Service Account (Recommended)

1. **Get Service Account Key:**
   - Go to: https://console.firebase.google.com/project/cosmiq-prod/settings/serviceaccounts/adminsdk
   - Click **"Generate New Private Key"**
   - Save the JSON file (e.g., `cosmiq-prod-key.json`)

2. **Set Environment Variable (Windows PowerShell):**
   ```powershell
   # For current session
   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\cosmiq-prod-key.json"
   
   # Or permanently (requires new terminal)
   setx GOOGLE_APPLICATION_CREDENTIALS "C:\path\to\cosmiq-prod-key.json"
   ```

3. **Test it:**
   ```powershell
   npm run seed:quotes -- --dry-run
   ```

### Method 2: gcloud Authentication

1. **Install gcloud** (if not installed):
   - Download: https://cloud.google.com/sdk/docs/install
   - Or: `choco install gcloudsdk` (Windows)

2. **Authenticate:**
   ```powershell
   gcloud auth application-default login
   gcloud config set project cosmiq-prod
   ```

3. **Test it:**
   ```powershell
   npm run seed:quotes -- --dry-run
   ```

## That's It!

Once authenticated, run:
```powershell
npm run seed:quotes
```

For more details, see `docs/FIREBASE_AUTH_SETUP.md`
