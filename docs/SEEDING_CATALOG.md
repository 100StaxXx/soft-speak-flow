# Seeding Cosmiq Content Catalog to Firebase

This guide explains how to seed the Cosmiq content catalog into Firebase Firestore.

## Prerequisites

1. **Firebase Admin SDK Setup**
   - You need Firebase Admin credentials configured
   - Option 1: Service Account JSON file
     - Download service account key from Firebase Console
     - Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to the JSON file
   - Option 2: Default Application Credentials (for local development)
     - Use `gcloud auth application-default login` for local testing
     - Or use Firebase Emulator Suite

2. **Catalog JSON File**
   - Ensure `cosmiq-content-catalog.json` exists in the project root
   - This file contains all the content data to be seeded

## Quick Start

```bash
# Seed all collections to Firebase
npm run seed:catalog

# Verify the seeded data
npm run verify:catalog

# Seed and verify in one command
npm run seed:catalog -- --verify
```

Or directly with tsx:

```bash
# Seed all collections
tsx scripts/seed-cosmiq-catalog.ts

# Dry run (validate without writing)
tsx scripts/seed-cosmiq-catalog.ts --dry-run

# Seed only one collection
tsx scripts/seed-cosmiq-catalog.ts --collection=mentors

# Seed and verify
tsx scripts/seed-cosmiq-catalog.ts --verify

# Verify existing data
tsx scripts/verify-catalog-seed.ts
```

## What Gets Seeded

The script seeds the following collections:

1. **mentors** - 9 mentor profiles with bios, tone descriptions, and configurations
2. **tone_profiles** - 9 tone profiles matching each mentor
3. **pep_talks** - 9 pep talks (one per mentor)
4. **mission_templates** - 15 mission templates (connection, quick_win, identity)
5. **evolution_stages** - 21 evolution stages (0-20) with XP thresholds
6. **quest_templates** - 10 quest templates for various activities
7. **cosmic_assets** - 15 cosmic-themed visual assets

## Configuration

### Using Service Account (Production)

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Set environment variable:

```bash
# Windows (PowerShell)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account-key.json"

# Windows (CMD)
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account-key.json

# macOS/Linux
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

5. Run the seeding script:

```bash
npm run seed:catalog
```

### Using Firebase Emulator (Local Development)

1. Start Firebase Emulator:

```bash
firebase emulators:start --only firestore
```

2. Set environment variable to use emulator:

```bash
# Windows (PowerShell)
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"

# macOS/Linux
export FIRESTORE_EMULATOR_HOST="localhost:8080"
```

3. Run the seeding script:

```bash
npm run seed:catalog
```

## Script Options

The seeding script supports several options:

- `--dry-run`: Validate the catalog data without writing to Firestore
- `--collection=<name>` or `--collection <name>`: Seed only a specific collection (e.g., `--collection=mentors` or `--collection mentors`)
- `--verify`: Automatically run verification after seeding completes

Valid collection names:
- `mentors`
- `tone_profiles`
- `pep_talks`
- `mission_templates`
- `evolution_stages`
- `quest_templates`
- `cosmic_assets`

## Script Behavior

- **Batch Writes**: Uses Firestore batch writes (500 documents per batch) for efficiency
- **Document IDs**: Uses the `id` field from JSON as Firestore document IDs
- **Timestamps**: Converts `created_at` strings to Firestore server timestamps
- **Progress Tracking**: Shows real-time progress for each collection
- **Error Handling**: Stops on errors and provides clear error messages
- **Data Validation**: Validates catalog structure before seeding

## Verification

### Automated Verification

Use the verification script to automatically check all collections:

```bash
npm run verify:catalog
```

This will:
- Check document counts for each collection
- Display sample data from each collection
- Report any mismatches

### Manual Verification

After seeding, verify the data in Firebase Console:

1. Go to Firebase Console → Firestore Database
2. Check each collection:
   - `mentors` should have 9 documents
   - `tone_profiles` should have 9 documents
   - `pep_talks` should have 9 documents
   - `mission_templates` should have 15 documents
   - `evolution_stages` should have 21 documents
   - `quest_templates` should have 10 documents
   - `cosmic_assets` should have 15 documents

## Troubleshooting

### Error: "Failed to initialize Firebase Admin"

**Solution**: Ensure you have Firebase Admin credentials configured:
- Check `GOOGLE_APPLICATION_CREDENTIALS` is set correctly
- Verify the service account JSON file exists and is valid
- For local development, try `gcloud auth application-default login`

### Error: "Failed to load catalog data"

**Solution**: Ensure `cosmiq-content-catalog.json` exists in the project root directory.

### Error: "Permission denied"

**Solution**: Ensure your service account has Firestore write permissions:
- Go to Firebase Console → IAM & Admin
- Verify your service account has "Cloud Datastore User" or "Firebase Admin" role

### Documents not appearing in Firestore

**Solution**: 
- Check Firestore security rules allow writes
- Verify you're looking at the correct Firebase project
- Check the console output for any error messages during batch commits

## Re-seeding

The script will overwrite existing documents with the same ID. To re-seed:

1. **Option 1**: Delete existing collections in Firebase Console, then re-run the script
2. **Option 2**: Just run the script again - it will update existing documents

## Customization

To modify what gets seeded:

1. Edit `cosmiq-content-catalog.json` to add/remove/modify content
2. Run `npm run seed:catalog` again
3. The script will update existing documents or create new ones

## Notes

- The script preserves document IDs from the JSON file
- Timestamps are set to server timestamp at write time
- The script handles large datasets efficiently using batch writes
- All collections are seeded in sequence (not parallel) for reliability

