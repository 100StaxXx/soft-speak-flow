# Quote Acquisition System

## Overview

This document explains how quotes are currently acquired and stored in the Soft Speak Flow application.

## Current Quote Acquisition Methods

### 1. **Hardcoded Seed Quotes** (Primary Method)
- **Location**: `functions/src/index.ts` - `seedRealQuotes` function
- **Count**: ~25-30 quotes
- **Content**: Manually curated inspirational quotes
- **Schema**: Includes text, author, category, intensity, emotional_triggers, mentor_id
- **Usage**: Callable Firebase Cloud Function that can be invoked from the admin panel

### 2. **AI-Generated Quotes** (On-Demand)
- **Location**: `functions/src/index.ts` - `generateQuotes` function
- **Method**: Uses Google Gemini API to generate quotes dynamically
- **Parameters**: 
  - Category or emotional trigger
  - Count of quotes to generate
- **Usage**: Generates quotes on-demand when needed

### 3. **Public API Quotes** (New - Bulk Seeding)
- **Location**: `scripts/seed-quotes.ts`
- **Source**: [quotable.io](https://quotable.io) - Free public API
- **Purpose**: Bulk seed 300+ quotes for initial database population
- **Features**:
  - Fetches quotes from public API automatically
  - **Auto-fetching**: Continues fetching more quotes until target count is reached (accounts for duplicates)
  - Maps tags to categories and emotional triggers
  - Assigns intensity levels
  - Optionally matches quotes to mentors
  - Handles duplicates intelligently
  - Supports dry-run mode
  - Processes quotes in efficient batches

## Database Schema

Quotes are stored in Firestore `quotes` collection with the following schema:

```typescript
interface Quote {
  id: string;                    // Auto-generated document ID
  text: string;                  // The quote text
  author: string;                // Author name
  category: string | null;       // Category: discipline, confidence, focus, mindset, business, physique
  intensity: string | null;      // Intensity: gentle, moderate, intense
  emotional_triggers: string[];  // Array of triggers: Self-Doubt, Anxious & Overthinking, etc.
  mentor_id: string | null;      // Optional mentor assignment
  is_premium: boolean;           // Premium content flag
  created_at: Timestamp;         // Creation timestamp
}
```

## Usage

### Seed Quotes from Public API

To seed 300 quotes from the public API:

```bash
npm run seed:quotes
```

**How it works:**
- The script will automatically fetch quotes from the API in batches
- It checks for duplicates and skips quotes that already exist in your database
- **Auto-fetching**: If duplicates are found, it automatically fetches more quotes until the target count is reached
- This ensures you always get the exact number of NEW quotes you requested

Options:
- `--count <number>`: Number of NEW quotes to insert (default: 300)
- `--dry-run`: Validate data without writing to Firestore
- `--no-skip-duplicates`: Allow duplicate quotes (default: skips duplicates)

Examples:
```bash
# Seed 300 new quotes (default)
# Will automatically fetch more if duplicates are found
npm run seed:quotes

# Seed 500 new quotes
npm run seed:quotes -- --count 500

# Dry run to validate
npm run seed:quotes -- --dry-run

# Seed without duplicate checking (may insert duplicates)
npm run seed:quotes -- --no-skip-duplicates
```

### Seed Hardcoded Quotes

The hardcoded quotes can be seeded via the Firebase Cloud Function `seedRealQuotes`. This is typically called from the admin interface.

### Generate AI Quotes

AI quotes are generated on-demand via the `generateQuotes` Firebase Cloud Function, typically called from the admin interface with specific parameters.

## Category Mapping

The seed script maps API tags to our categories:

- **business**: business, success, entrepreneurship
- **mindset**: motivational, inspirational, wisdom, philosophy, life
- **physique**: fitness, health, sports
- **discipline**: discipline, perseverance, hard-work
- **confidence**: confidence, self-esteem, courage
- **focus**: focus, productivity, concentration

## Emotional Triggers Mapping

Tags are mapped to emotional triggers:

- **motivational** → Unmotivated, Avoiding Action
- **inspirational** → Heavy or Low, Feeling Stuck
- **confidence** → Self-Doubt, Anxious & Overthinking
- **courage** → Anxious & Overthinking, Self-Doubt
- **perseverance** → Frustrated, Emotionally Hurt
- **discipline** → Needing Discipline, Avoiding Action
- **focus** → Anxious & Overthinking, Avoiding Action
- **success** → Motivated & Ready, Needing Discipline
- **wisdom** → In Transition, Feeling Stuck
- **life** → Heavy or Low, In Transition

## Intensity Determination

Intensity is determined based on:
- **Intense**: Contains words like "must", "never", "always", "destroy", "crush", "dominate"
- **Gentle**: Contains words like "maybe", "perhaps", "consider", "gentle", "soft", "kind"
- **Moderate**: Default for most quotes, or quotes longer than 100 characters

## Future Improvements

1. **More Quote Sources**: Integrate additional quote APIs or sources
2. **Better Categorization**: Use AI to better categorize and tag quotes
3. **User-Generated Quotes**: Allow users to submit and vote on quotes
4. **Quote Quality Scoring**: Implement a scoring system for quote relevance
5. **Automated Daily Seeding**: Schedule regular quote updates

## Prerequisites

To run the seed script, you need:

1. Firebase Admin SDK credentials:
   - Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to service account JSON, OR
   - Set `FIREBASE_PROJECT_ID` or `VITE_FIREBASE_PROJECT_ID` and use `gcloud auth application-default login`

2. Firebase project configured with Firestore enabled

3. Node.js and npm installed

4. TypeScript execution environment (tsx) - already in devDependencies
