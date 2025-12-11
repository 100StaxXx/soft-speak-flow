/**
 * Migration script to copy profiles from Supabase to Firestore
 * Run with: npx tsx scripts/migrate-profiles-to-firestore.ts
 */

import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file');
  process.exit(1);
}

async function initializeFirebase() {
  try {
    // Check if already initialized
    admin.app();
    return admin.firestore();
  } catch (e) {
    // Not initialized, so initialize it
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (serviceAccountPath) {
      try {
        // Try dynamic import first (ES modules)
        const serviceAccountModule = await import(serviceAccountPath);
        const serviceAccount = serviceAccountModule.default || serviceAccountModule;
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (importError) {
        // If import fails, try require (for CommonJS)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
    } else {
      // Try to use default credentials
      admin.initializeApp();
    }
    return admin.firestore();
  }
}

async function migrateProfiles() {
  console.log('🚀 Starting profile migration from Supabase to Firestore...\n');

  try {
    // Initialize Firebase Admin
    const db = await initializeFirebase();

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Fetch all profiles from Supabase
    console.log('📥 Fetching profiles from Supabase...');
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*');

    if (error) {
      console.error('❌ Error fetching profiles from Supabase:', error);
      process.exit(1);
    }

    if (!profiles || profiles.length === 0) {
      console.log('⚠️  No profiles found in Supabase');
      return;
    }

    console.log(`✅ Found ${profiles.length} profiles to migrate\n`);

    // Migrate each profile
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      try {
        // Check if profile already exists in Firestore
        const existing = await db.collection('profiles').doc(profile.id).get();
        
        if (existing.exists) {
          console.log(`⏭️  Skipping ${profile.id} (already exists in Firestore)`);
          skipCount++;
          continue;
        }

        // Map Supabase profile to Firestore format
        const firestoreProfile = {
          id: profile.id,
          email: profile.email || null,
          is_premium: profile.is_premium || false,
          preferences: profile.preferences || null,
          selected_mentor_id: profile.selected_mentor_id || null,
          created_at: profile.created_at || admin.firestore.FieldValue.serverTimestamp(),
          updated_at: profile.updated_at || admin.firestore.FieldValue.serverTimestamp(),
          daily_push_enabled: profile.daily_push_enabled ?? null,
          daily_push_window: profile.daily_push_window || null,
          daily_push_time: profile.daily_push_time || null,
          daily_quote_push_enabled: profile.daily_quote_push_enabled ?? null,
          daily_quote_push_window: profile.daily_quote_push_window || null,
          daily_quote_push_time: profile.daily_quote_push_time || null,
          timezone: profile.timezone || null,
          current_habit_streak: profile.current_habit_streak ?? null,
          longest_habit_streak: profile.longest_habit_streak ?? null,
          onboarding_completed: profile.onboarding_completed ?? false,
          onboarding_data: profile.onboarding_data || {},
          trial_ends_at: profile.trial_ends_at || null,
          subscription_status: profile.subscription_status || null,
          subscription_expires_at: profile.subscription_expires_at || null,
          zodiac_sign: profile.zodiac_sign || null,
          birthdate: profile.birthdate || null,
          birth_time: profile.birth_time || null,
          birth_location: profile.birth_location || null,
          moon_sign: profile.moon_sign || null,
          rising_sign: profile.rising_sign || null,
          mercury_sign: profile.mercury_sign || null,
          mars_sign: profile.mars_sign || null,
          venus_sign: profile.venus_sign || null,
          cosmic_profile_generated_at: profile.cosmic_profile_generated_at || null,
          faction: profile.faction || null,
          referred_by: profile.referred_by || null,
        };

        // Write to Firestore
        await db.collection('profiles').doc(profile.id).set(firestoreProfile, { merge: true });
        
        console.log(`  ✅ Migrated: ${profile.id} (${profile.email || 'no email'})`);
        successCount++;
      } catch (err) {
        console.error(`  ❌ Error migrating profile ${profile.id}:`, err);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total: ${profiles.length}\n`);

    if (errorCount > 0) {
      console.log('⚠️  Some profiles failed to migrate. Check the errors above.');
      process.exit(1);
    } else {
      console.log('🎉 Migration completed successfully!');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateProfiles();
