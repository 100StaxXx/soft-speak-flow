# Quick Migration Steps

## 1. Install Dependencies
```bash
npm install firebase-admin dotenv
```

## 2. Get Firebase Service Account

1. Go to https://console.firebase.google.com/
2. Select your project (cosmiq-prod)
3. Click ⚙️ → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the JSON file (e.g., `firebase-service-account.json` in project root)

## 3. Add to .env

Add ONE of these to your `.env` file:

**Option A: File path (recommended)**
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

**Option B: Direct JSON**
```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

## 4. Run Migration

```bash
npm run migrate:data
```

This will:
- ✅ Copy all data from Supabase to Firestore
- ✅ Show progress for each collection
- ✅ Print a summary at the end
- ✅ Be safe to run multiple times (idempotent)

## 5. Verify

1. Go to Firebase Console → Firestore Database
2. Check that collections are present
3. Spot-check a few documents

## 6. Test Your App

Test key features:
- Login
- View pep talks
- Create tasks
- View profile
- etc.

## Troubleshooting

**"Missing Supabase credentials"**
- Make sure `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`

**"Missing Firebase Service Account"**
- Follow step 2 above

**"Permission denied"**
- Make sure service account has Firestore write permissions
- Check Firebase Console → IAM & Admin

**Partial migration?**
- Script is idempotent - run it again
- Check error log at the end






