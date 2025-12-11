# Cosmiq Content Catalog

Complete content catalog for the Cosmiq app, ready to seed into Firebase Firestore.

## 📦 What's Included

- **9 Mentors** - Complete mentor profiles with bios, tone descriptions, and configurations
- **9 Tone Profiles** - Matching tone profiles for each mentor
- **9 Pep Talks** - Inspirational pep talks, one per mentor
- **15 Mission Templates** - Daily mission templates (connection, quick_win, identity)
- **21 Evolution Stages** - Complete evolution system from Egg to Ultimate
- **10 Quest Templates** - Quest templates for various activities
- **15 Cosmic Assets** - Visual assets for cosmic-themed UI elements

## 🚀 Quick Start

### 1. Seed the Catalog

```bash
# Seed all collections to Firebase
npm run seed:catalog

# Or with verification
npm run seed:catalog -- --verify
```

### 2. Verify the Data

```bash
# Verify all collections were seeded correctly
npm run verify:catalog
```

### 3. Advanced Usage

```bash
# Dry run (validate without writing)
npm run seed:catalog -- --dry-run

# Seed only one collection
npm run seed:catalog -- --collection=mentors
```

## 📁 Files

- **`cosmiq-content-catalog.json`** - Complete catalog data in JSON format
- **`scripts/seed-cosmiq-catalog.ts`** - Seeding script for Firebase
- **`scripts/verify-catalog-seed.ts`** - Verification script
- **`docs/SEEDING_CATALOG.md`** - Detailed documentation

## 📊 Collection Structure

### Mentors
Each mentor includes:
- Name, slug, archetype
- Description and tone description
- Voice style and style description
- Target user information
- Theme configuration (colors)
- Tags and themes
- Welcome message and signature line

### Tone Profiles
- Name and description
- Characteristics
- Associated mentor IDs

### Pep Talks
- Title and description
- Category and duration
- Associated mentor
- Transcript
- Tags

### Mission Templates
- Type and text
- XP value and difficulty
- Category (connection/quick_win/identity)
- Auto-complete flag

### Evolution Stages
- Stage number (0-20)
- Stage name
- XP required
- Description

### Quest Templates
- Title and description
- Category and difficulty
- XP reward
- Estimated time
- Tags

### Cosmic Assets
- Name and type
- Category
- Description
- Tags
- Premium flag

## 🔧 Configuration

See `docs/SEEDING_CATALOG.md` for:
- Firebase Admin setup
- Environment configuration
- Troubleshooting
- Customization options

## ✅ Verification

After seeding, the verification script checks:
- Document counts match expected values
- Collections are accessible
- Sample data structure is correct

## 🔄 Re-seeding

The script will update existing documents with the same ID. To re-seed:

```bash
# Just run the seed script again
npm run seed:catalog
```

Or delete specific collections in Firebase Console first if you want a fresh start.

## 📝 Notes

- Document IDs are preserved from the JSON file
- Timestamps are set to server timestamp at write time
- The script uses batch writes for efficiency (500 docs/batch)
- All collections are seeded sequentially for reliability

