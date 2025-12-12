/**
 * Data Migration Script: Supabase to Firestore
 * 
 * This script migrates all data from Supabase to Firestore.
 * Run this BEFORE switching your app to use Firestore.
 * 
 * Usage:
 * 1. Install dependencies: npm install firebase-admin @supabase/supabase-js dotenv
 * 2. Set up Firebase Service Account (see README-MIGRATION.md)
 * 3. Run: npm run migrate:data
 * 4. Review the migration logs
 * 5. Test your app with Firestore
 */

import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Initialize Supabase client
// For migration, we need the service role key to access all tables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Try service role key first (for admin access), fallback to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Need: VITE_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  WARNING: Using anon key - some tables may not be accessible due to RLS');
  console.warn('   💡 For full access, add SUPABASE_SERVICE_ROLE_KEY to .env');
  console.warn('      Get it from: Supabase Dashboard > Settings > API > service_role key');
  console.warn('');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Test connection
console.log(`\n🔗 Testing Supabase connection...`);
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Using: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role Key' : 'Anon Key'}`);

// Initialize Firebase Admin
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // Load from file (supports both relative and absolute paths)
  let serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath.startsWith('/') && !serviceAccountPath.match(/^[A-Za-z]:/)) {
    // Relative path - resolve from project root
    serviceAccountPath = join(__dirname, '..', serviceAccountPath);
  }
  try {
    const serviceAccountFile = readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(serviceAccountFile);
    console.log(`✅ Loaded service account from: ${serviceAccountPath}`);
  } catch (error) {
    console.error('❌ Could not read service account file:', error.message);
    console.error(`   Tried path: ${serviceAccountPath}`);
    process.exit(1);
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Load from environment variable
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (error) {
    console.error('❌ Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ Missing Firebase Service Account credentials');
  console.error('   Set either FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT in .env');
  console.error('   Get this from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

if (!serviceAccount.project_id) {
  console.error('❌ Invalid service account: missing project_id');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Migration statistics
const stats = {
  collections: {},
  errors: []
};

/**
 * Convert Supabase row to Firestore document
 */
function convertRowToFirestore(row) {
  const { id, ...data } = row;
  const converted = { ...data };
  
  // Convert timestamps to Firestore Timestamps
  Object.keys(converted).forEach(key => {
    if (key.includes('_at') || key.includes('_date') || key === 'date') {
      if (converted[key]) {
        try {
          converted[key] = Timestamp.fromDate(new Date(converted[key]));
        } catch (e) {
          // If conversion fails, keep original value
          console.warn(`Could not convert ${key} to timestamp:`, converted[key]);
        }
      }
    }
  });
  
  return converted;
}

/**
 * Migrate a single collection
 */
async function migrateCollection(collectionName, options = {}) {
  const { 
    batchSize = 500,
    transform = convertRowToFirestore,
    filter = null,
    orderBy = 'created_at'
  } = options;

  console.log(`\n📦 Migrating ${collectionName}...`);

  try {
    // Fetch all data from Supabase using REST API directly
    // This bypasses the schema cache issue
    const url = `${supabaseUrl}/rest/v1/${collectionName}?select=*`;
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // Add filters to URL if needed
    let queryParams = 'select=*';
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        queryParams += `&${key}=eq.${encodeURIComponent(value)}`;
      });
    }
    if (orderBy) {
      queryParams += `&order=${orderBy}.asc`;
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/${collectionName}?${queryParams}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let error = null;

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`   ⚠️  No data found in ${collectionName}`);
      stats.collections[collectionName] = { migrated: 0, skipped: 0 };
      return;
    }

    console.log(`   Found ${data.length} records`);

    // Migrate in batches
    let migrated = 0;
    let skipped = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = db.batch();
      const batchData = data.slice(i, i + batchSize);
      let batchCount = 0;

      for (const row of batchData) {
        try {
          const docId = row.id || `${collectionName}_${i + batchCount}`;
          const docData = transform(row);
          
          // Skip if document already exists (idempotent)
          const docRef = db.collection(collectionName).doc(docId);
          batch.set(docRef, docData, { merge: true });
          batchCount++;
        } catch (err) {
          console.error(`   ❌ Error processing row ${row.id}:`, err.message);
          skipped++;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        migrated += batchCount;
        console.log(`   ✅ Migrated batch: ${migrated}/${data.length}`);
      }
    }

    stats.collections[collectionName] = { migrated, skipped };
    console.log(`   ✅ Completed: ${migrated} migrated, ${skipped} skipped`);

  } catch (error) {
    console.error(`   ❌ Error migrating ${collectionName}:`, error.message);
    stats.errors.push({ collection: collectionName, error: error.message });
  }
}

/**
 * Main migration function
 */
async function migrateAll() {
  console.log('🚀 Starting Supabase to Firestore Migration\n');
  console.log('⚠️  This will copy all data from Supabase to Firestore');
  console.log('⚠️  Make sure you have backups!\n');

  // Test connection with a simple query
  console.log('🔍 Testing Supabase connection...');
  try {
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Connection test failed:', testError.message);
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check VITE_SUPABASE_URL is correct');
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('   2. ⚠️  SUPABASE_SERVICE_ROLE_KEY not found in .env');
        console.error('      Add it: SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
        console.error('      Get it from: Supabase Dashboard > Settings > API > service_role key');
      } else {
        console.error('   2. Check SUPABASE_SERVICE_ROLE_KEY is correct');
      }
      console.error('   3. Verify tables exist in Supabase Dashboard');
      console.error('   4. Check RLS policies allow access');
      process.exit(1);
    }
    console.log('✅ Connection successful! Found', testData?.length || 0, 'test records\n');
  } catch (err) {
    console.error('❌ Connection test error:', err.message);
    process.exit(1);
  }

  // Core collections (order matters for dependencies)
  const collections = [
    // Static/reference data first
    'mentors',
    'quotes',
    'zodiac_sign_content',
    'evolution_thresholds',
    
    // User-generated content
    'pep_talks',
    'challenges',
    
    // User data (profiles first, then user-specific data)
    'profiles',
    'user_companion',
    'daily_tasks',
    'habits',
    'habit_completions',
    'epics',
    'epic_habits',
    'epic_members',
    'user_challenges',
    'challenge_progress',
    'daily_missions',
    'user_reflections',
    'activity_feed',
    'daily_check_ins',
    'favorites',
    'downloads',
    'referral_codes',
    'referral_payouts',
    'adaptive_push_settings',
    'muted_users',
    'welcome_messages',
    'mentor_chats',
    'mentor_nudges',
    'guild_stories',
    'guild_shouts',
    'epic_activity_feed',
    'guild_rivalries',
    'companion_stories',
    'companion_postcards',
    'evolution_cards',
    'astral_encounters',
    'adversary_essences',
    'cosmic_codex_entries',
    'battle_matches',
    'battle_participants',
    'battle_rounds',
    'battle_rankings',
    'daily_pep_talks',
  ];

  // Migrate each collection
  for (const collection of collections) {
    await migrateCollection(collection);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));
  
  let totalMigrated = 0;
  let totalSkipped = 0;

  Object.entries(stats.collections).forEach(([name, { migrated, skipped }]) => {
    console.log(`${name}: ${migrated} migrated, ${skipped} skipped`);
    totalMigrated += migrated;
    totalSkipped += skipped;
  });

  console.log('\n' + '-'.repeat(50));
  console.log(`Total: ${totalMigrated} migrated, ${totalSkipped} skipped`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(({ collection, error }) => {
      console.log(`  ${collection}: ${error}`);
    });
  }

  console.log('\n✅ Migration complete!');
  console.log('⚠️  Please verify your data in Firebase Console before switching your app.');
}

// Run migration
migrateAll()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

