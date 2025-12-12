# Catalog Content Verification Instructions

## Overview

The Cosmiq app uses a content catalog (`cosmiq-content-catalog.json`) that defines mentors, mission templates, quest templates, and other content. This content must be seeded into Firestore for the app to function correctly.

---

## Quick Verification

To verify that catalog content is seeded in Firestore:

```bash
npm run verify:catalog
```

This will check all collections and report any missing content.

---

## Seeding Catalog Content

If content is missing, seed it with:

```bash
npm run seed:catalog
```

This will:
1. Read `cosmiq-content-catalog.json`
2. Seed all collections to Firestore
3. Handle batch writes for efficiency
4. Provide progress feedback

---

## Collections Verified

The verification script checks these collections:

- ✅ **mentors** - Expected: 9 mentors
- ✅ **tone_profiles** - Expected: 9 profiles
- ✅ **pep_talks** - Expected: 9 pep talks
- ✅ **mission_templates** - Expected: 15 templates
- ✅ **evolution_stages** - Expected: 21 stages
- ✅ **quest_templates** - Expected: 10 templates
- ✅ **cosmic_assets** - Expected: 15 assets

---

## Prerequisites

Before running the seed script, ensure:

1. ✅ Firebase Admin SDK credentials are configured
   - Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable, OR
   - Use default credentials (gcloud auth application-default login)

2. ✅ Firebase project is configured
   - Project ID matches your `.env` file
   - Firestore is enabled

3. ✅ Catalog file exists
   - `cosmiq-content-catalog.json` in project root

---

## Dry Run

To validate catalog data without writing to Firestore:

```bash
tsx scripts/seed-cosmiq-catalog.ts --dry-run
```

This will:
- Validate catalog data structure
- Show data summary
- Not write any data to Firestore

---

## Seed Specific Collection

To seed only a specific collection:

```bash
tsx scripts/seed-cosmiq-catalog.ts --collection mentors
```

Valid collection names:
- `mentors`
- `tone_profiles`
- `pep_talks`
- `mission_templates`
- `evolution_stages`
- `quest_templates`
- `cosmic_assets`

---

## Verification After Seeding

After seeding, run verification:

```bash
npm run verify:catalog
```

Or seed with automatic verification:

```bash
tsx scripts/seed-cosmiq-catalog.ts --verify
```

---

## Troubleshooting

### Error: "Failed to initialize Firebase Admin"

**Solution:** Set up Firebase Admin credentials:
```bash
# Option 1: Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# Option 2: Use default credentials
gcloud auth application-default login
```

### Error: "Catalog data validation failed"

**Solution:** Check that `cosmiq-content-catalog.json` has all required collections:
- mentors
- tone_profiles
- pep_talks
- mission_templates
- evolution_stages
- quest_templates
- cosmic_assets

### Error: "Collection not found or is not an array"

**Solution:** Ensure the catalog JSON file is valid and all collections are arrays.

---

## Related Files

- `cosmiq-content-catalog.json` - Catalog definition
- `scripts/seed-cosmiq-catalog.ts` - Seeding script
- `scripts/verify-catalog-seed.ts` - Verification script
- `package.json` - Scripts: `seed:catalog`, `verify:catalog`

---

**Last Updated:** 2025-01-27

