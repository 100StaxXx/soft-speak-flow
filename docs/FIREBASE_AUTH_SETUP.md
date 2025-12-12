# Firebase Authentication Setup for Scripts

This guide will help you set up Firebase authentication for running scripts like `seed-quotes.ts`.

## Option 1: Service Account (Recommended for Scripts)

This is the best option for automated scripts and CI/CD.

### Step 1: Create a Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **cosmiq-prod**
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. Click **Generate Key** in the confirmation dialog
7. A JSON file will be downloaded (e.g., `cosmiq-prod-firebase-adminsdk-xxxxx.json`)

### Step 2: Store the Service Account File

**Important:** Never commit this file to git! It contains sensitive credentials.

1. Create a secure location for the file (outside your project or in a `.secrets` folder)
2. Recommended locations:
   - `C:\Users\<YourUsername>\.firebase\service-accounts\cosmiq-prod.json` (Windows)
   - `~/.firebase/service-accounts/cosmiq-prod.json` (Mac/Linux)
   - Or in a `.secrets` folder in your project (make sure it's in `.gitignore`)

### Step 3: Set Environment Variable

#### Windows (PowerShell):
```powershell
# For current session only
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\your\cosmiq-prod-firebase-adminsdk-xxxxx.json"

# Or set permanently (requires admin)
[System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', 'C:\path\to\your\cosmiq-prod-firebase-adminsdk-xxxxx.json', 'User')
```

#### Windows (Command Prompt):
```cmd
setx GOOGLE_APPLICATION_CREDENTIALS "C:\path\to\your\cosmiq-prod-firebase-adminsdk-xxxxx.json"
```

#### Mac/Linux:
```bash
# For current session
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/cosmiq-prod-firebase-adminsdk-xxxxx.json"

# Or add to ~/.bashrc or ~/.zshrc for permanent
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/cosmiq-prod-firebase-adminsdk-xxxxx.json"' >> ~/.bashrc
source ~/.bashrc
```

### Step 4: Verify Setup

Run the script to verify:
```bash
npm run seed:quotes -- --dry-run
```

## Option 2: gcloud Authentication (Alternative)

This uses your personal Google Cloud credentials.

### Step 1: Install Google Cloud SDK

1. Download and install from: https://cloud.google.com/sdk/docs/install
2. Or use a package manager:
   ```bash
   # Windows (using Chocolatey)
   choco install gcloudsdk
   
   # Mac (using Homebrew)
   brew install google-cloud-sdk
   ```

### Step 2: Authenticate

```bash
gcloud auth application-default login
```

This will:
- Open a browser window
- Ask you to sign in with your Google account
- Grant permissions to access Google Cloud services

### Step 3: Set Project ID (if needed)

```bash
gcloud config set project cosmiq-prod
```

### Step 4: Verify Setup

Run the script:
```bash
npm run seed:quotes -- --dry-run
```

## Troubleshooting

### Error: "Could not load the default credentials"

**Solution:** Make sure you've set up one of the authentication methods above.

### Error: "Permission denied" or "Insufficient permissions"

**Solution:** The service account needs proper permissions:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Make sure the service account has the **Firebase Admin SDK Administrator Service Agent** role
3. Or in Google Cloud Console, grant the service account the **Firebase Admin** role

### Error: "Project not found"

**Solution:** Verify your project ID:
- Check `.firebaserc` file - should have `"default": "cosmiq-prod"`
- Or set `FIREBASE_PROJECT_ID=cosmiq-prod` environment variable

### Windows: Environment variable not persisting

**Solution:** 
- Use `setx` instead of `set` (requires new terminal window)
- Or set it in System Properties → Environment Variables
- Or create a `.env` file and use a package like `dotenv`

## Quick Setup Script

You can also use the helper script to set up authentication:

```bash
# Windows PowerShell
.\scripts\setup-firebase-auth.ps1

# Mac/Linux
./scripts/setup-firebase-auth.sh
```

## Security Best Practices

1. **Never commit service account keys to git**
2. **Store keys in secure locations** (outside project or in `.secrets` folder)
3. **Use different service accounts** for development and production
4. **Rotate keys regularly**
5. **Limit permissions** - only grant necessary roles
6. **Use environment variables** instead of hardcoding paths

## Next Steps

Once authentication is set up, you can run:

```bash
# Seed 300 quotes
npm run seed:quotes

# Seed custom amount
npm run seed:quotes -- --count 500

# Dry run (test without writing)
npm run seed:quotes -- --dry-run
```
