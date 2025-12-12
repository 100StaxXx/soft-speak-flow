# Cosmiq Content Catalog

Complete content catalog for the Cosmiq app, ready to seed into Firebase.

## Overview

This catalog contains all the core content data needed for the Cosmiq app to function properly:

- **9 Mentors** - Complete mentor profiles with bios, tone descriptions, and personality data
- **9 Tone Profiles** - Tone configurations for each mentor
- **9 Pep Talks** - Initial pep talk library (one per mentor)
- **15 Mission Templates** - Daily mission templates across connection, quick_win, and identity categories
- **21 Evolution Stages** - Complete companion evolution system (stages 0-20)
- **10 Quest Templates** - Quest templates for various activities
- **15 Cosmic Assets** - Visual and animation assets for cosmic themes
- **Cosmic Flavor Data** - Factions, elements, and spirit animals

## File Structure

The catalog is stored in `cosmiq-content-catalog.json` with the following structure:

```json
{
  "mentors": [...],
  "tone_profiles": [...],
  "pep_talks": [...],
  "mission_templates": [...],
  "evolution_stages": [...],
  "quest_templates": [...],
  "cosmic_assets": [...],
  "cosmic_flavor_data": {...}
}
```

## Data Details

### Mentors (9 total)

1. **Atlas** - The Motivator (motivational_guide)
2. **Darius** - The Challenger (tough_love_coach)
3. **Eli** - The Sage (wise_guide)
4. **Nova** - The Innovator (innovative_visionary)
5. **Sienna** - The Healer (compassionate_healer)
6. **Lumi** - The Light (mindful_guide)
7. **Astor (Kai)** - The Catalyst (energetic_catalyst)
8. **Rich (Stryker)** - The Force (powerful_force)
9. **Solace** - The Comfort (comforting_presence)

Each mentor includes:
- Complete bio and description
- Tone and voice style descriptions
- Target user profiles
- Theme colors and configuration
- Tags and themes
- Welcome message

### Evolution Stages (21 stages)

Stages 0-20 with correct XP thresholds matching `src/config/xpSystem.ts`:

- Stage 0 (Egg): 0 XP
- Stage 1 (Hatchling): 10 XP
- Stage 2 (Sproutling): 100 XP
- Stage 3 (Cub): 250 XP
- Stage 4 (Juvenile): 450 XP
- Stage 5 (Apprentice): 800 XP
- Stage 6 (Scout): 1,300 XP
- Stage 7 (Fledgling): 2,000 XP
- Stage 8 (Warrior): 2,900 XP
- Stage 9 (Guardian): 4,000 XP
- Stage 10 (Champion): 5,400 XP
- Stage 11 (Ascended): 7,100 XP
- Stage 12 (Vanguard): 9,100 XP
- Stage 13 (Titan): 11,400 XP
- Stage 14 (Mythic): 14,000 XP
- Stage 15 (Prime): 17,000 XP
- Stage 16 (Regal): 20,400 XP
- Stage 17 (Eternal): 24,200 XP
- Stage 18 (Transcendent): 28,400 XP
- Stage 19 (Apex): 33,000 XP
- Stage 20 (Ultimate): 38,000 XP

### Mission Templates (15 total)

**Connection Category** (5-10 XP, easy):
- Text friend
- Check in
- Compliment
- Gratitude

**Quick Win Category** (5-10 XP, easy/medium):
- Avoided task
- Organize
- Make bed
- Declutter
- Five minutes

**Identity Category** (10-15 XP, medium/hard):
- Complete all quests
- Complete all habits
- Plan tomorrow
- Schedule something
- Future self action
- Discipline burst

### Quest Templates (10 total)

- Daily Reflection (8 XP, easy)
- Gratitude Practice (8 XP, easy)
- Goal Setting Session (16 XP, medium)
- Learn Something New (16 XP, medium)
- Creative Project (16 XP, medium)
- Physical Activity (16 XP, medium)
- Social Connection (8 XP, easy)
- Organize Your Space (8 XP, easy)
- Self-Care Ritual (8 XP, easy)
- Challenge Your Comfort Zone (28 XP, hard)

### Cosmic Flavor Data

**Factions** (3):
- Starfall Fleet
- Void Collective
- Stellar Voyagers

**Elements** (5):
- Fire, Water, Earth, Air, Spirit

**Spirit Animals** (8):
- Wolf, Eagle, Bear, Dolphin, Phoenix, Owl, Tiger, Butterfly

## Seeding to Firebase

### Option 1: Using Firebase Admin SDK

```javascript
const admin = require('firebase-admin');
const catalog = require('./cosmiq-content-catalog.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Seed mentors
async function seedMentors() {
  const batch = db.batch();
  catalog.mentors.forEach(mentor => {
    const ref = db.collection('mentors').doc(mentor.id);
    batch.set(ref, mentor);
  });
  await batch.commit();
  console.log('✓ Mentors seeded');
}

// Seed evolution stages
async function seedEvolutionStages() {
  const batch = db.batch();
  catalog.evolution_stages.forEach(stage => {
    const ref = db.collection('evolution_stages').doc(stage.id);
    batch.set(ref, stage);
  });
  await batch.commit();
  console.log('✓ Evolution stages seeded');
}

// Repeat for other collections...
```

### Option 2: Using Firebase Console

1. Open Firebase Console
2. Navigate to Firestore Database
3. Create collections: `mentors`, `tone_profiles`, `pep_talks`, `mission_templates`, `evolution_stages`, `quest_templates`, `cosmic_assets`, `cosmic_flavor_data`
4. Import the JSON data for each collection

### Option 3: Using Firebase CLI

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Login
firebase login

# Use firestore:import (requires proper format)
firebase firestore:import --project your-project-id ./catalog-data
```

## Collection Mapping

| Catalog Section | Firebase Collection | Notes |
|----------------|---------------------|-------|
| `mentors` | `mentors` | Use `id` as document ID |
| `tone_profiles` | `tone_profiles` | Use `id` as document ID |
| `pep_talks` | `pep_talks` | Use `id` as document ID |
| `mission_templates` | `mission_templates` | Use `id` as document ID |
| `evolution_stages` | `evolution_stages` | Use `id` as document ID |
| `quest_templates` | `quest_templates` | Use `id` as document ID |
| `cosmic_assets` | `cosmic_assets` | Use `id` as document ID |
| `cosmic_flavor_data` | `cosmic_flavor_data` | Store as single document or subcollections |

## Important Notes

1. **XP Values**: Evolution stage XP thresholds match the values in `src/config/xpSystem.ts`
2. **Mentor Slugs**: All mentor slugs are lowercase and match the mentor IDs
3. **Timestamps**: All `created_at` fields use ISO 8601 format
4. **Null Values**: `avatar_url` and `audio_url` fields are set to `null` and should be populated with actual URLs after upload
5. **Transcripts**: Pep talk transcripts are empty arrays `[]` and should be populated with word-level timestamps when audio is processed

## Validation

The JSON file has been validated and is ready for use. To validate again:

```bash
# PowerShell
Get-Content cosmiq-content-catalog.json | ConvertFrom-Json

# Node.js
node -e "JSON.parse(require('fs').readFileSync('cosmiq-content-catalog.json', 'utf8')); console.log('Valid')"
```

## Next Steps

1. Review the catalog data for accuracy
2. Upload any missing assets (avatars, audio files) and update URLs
3. Seed the data into Firebase using one of the methods above
4. Verify data appears correctly in the app
5. Test app functionality with the seeded data
