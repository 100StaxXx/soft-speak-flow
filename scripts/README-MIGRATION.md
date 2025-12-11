# Data Migration Guide: Supabase to Firestore

## ⚠️ Important: Your Data is Safe!

**Your data is NOT lost!** It's still in Supabase. We just need to copy it to Firestore.

## Migration Steps

### 1. Set Up Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file
6. Add to your `.env` file:

```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

Or set it as an environment variable:

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

### 2. Install Dependencies

```bash
npm install firebase-admin @supabase/supabase-js dotenv
```

### 3. Run Migration Script

```bash
node scripts/migrate-data-to-firestore.js
```

### 4. Verify Migration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database**
3. Verify all collections are present
4. Spot-check a few documents to ensure data looks correct

### 5. Test Your App

1. Test key features:
   - Login/authentication
   - Viewing pep talks
   - Creating tasks
   - Viewing profile
   - etc.

2. If everything works, you're done! 🎉

## What Gets Migrated

The script migrates all major collections:

- **Static Data**: mentors, quotes, zodiac_sign_content, evolution_thresholds
- **Content**: pep_talks, challenges
- **User Data**: profiles, companions, tasks, habits, epics, etc.
- **Activity**: activity_feed, daily_check_ins, reflections
- **Social**: guild_stories, guild_shouts, epic_activity_feed
- **Gaming**: astral_encounters, battle_matches, evolution_cards
- And more...

## Troubleshooting

### "Missing Supabase credentials"
- Make sure `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`

### "Missing FIREBASE_SERVICE_ACCOUNT"
- Follow step 1 above to get your service account JSON

### "Permission denied"
- Make sure your Firebase service account has Firestore write permissions
- Check Firebase Console > IAM & Admin > Service Accounts

### Partial Migration
- The script is idempotent - you can run it multiple times
- It will skip documents that already exist
- Check the error log at the end for any issues

## Rollback Plan

If something goes wrong:

1. **Your Supabase data is still there** - nothing was deleted
2. You can revert the code changes using git:
   ```bash
   git restore src/
   ```
3. Or keep both systems running temporarily (read from Supabase, write to both)

## Need Help?

If you encounter issues:
1. Check the migration logs
2. Verify your credentials
3. Check Firebase Console for any errors
4. Review the error summary at the end of the migration






