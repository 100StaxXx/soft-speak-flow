# Quick Start - Run Migration Now

## Step 1: Add to .env file

Open your `.env` file and add this line:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=C:\Users\darry\Downloads\cosmiq-prod-firebase-adminsdk-fbsvc-a80d2df0bd.json
```

## Step 2: Install packages

```bash
npm install firebase-admin dotenv
```

## Step 3: Run migration

```bash
npm run migrate:data
```

That's it! The script will:
- ✅ Connect to Supabase
- ✅ Connect to Firebase
- ✅ Copy all your data
- ✅ Show progress for each collection
- ✅ Print a summary

## What to expect

You'll see output like:
```
🚀 Starting Supabase to Firestore Migration

📦 Migrating mentors...
   Found 12 records
   ✅ Migrated batch: 12/12
   ✅ Completed: 12 migrated, 0 skipped

📦 Migrating quotes...
   Found 150 records
   ✅ Migrated batch: 150/150
   ✅ Completed: 150 migrated, 0 skipped

... (continues for all collections)

📊 Migration Summary
==================================================
mentors: 12 migrated, 0 skipped
quotes: 150 migrated, 0 skipped
...
Total: 5000+ migrated, 0 skipped

✅ Migration complete!
```

## After migration

1. Go to [Firebase Console](https://console.firebase.google.com/) → Firestore Database
2. Verify your collections are there
3. Test your app - everything should work!






