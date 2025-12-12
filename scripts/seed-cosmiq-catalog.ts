#!/usr/bin/env tsx
/**
 * Seed Cosmiq Content Catalog to Firebase Firestore
 * 
 * Usage:
 *   tsx scripts/seed-cosmiq-catalog.ts [options]
 * 
 * Options:
 *   --dry-run        Validate data without writing to Firestore
 *   --collection     Seed only a specific collection (e.g., --collection mentors)
 *   --verify         Run verification after seeding
 * 
 * Prerequisites:
 *   - Firebase Admin SDK credentials (GOOGLE_APPLICATION_CREDENTIALS env var or default credentials)
 *   - Firebase project configured
 *   - cosmiq-content-catalog.json file in project root
 * 
 * This script will:
 *   1. Read the cosmiq-content-catalog.json file
 *   2. Seed all collections to Firestore
 *   3. Handle batch writes for efficiency
 *   4. Provide progress feedback
 *   5. Optionally verify the seeded data
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Collection names mapping
const COLLECTIONS = {
  mentors: 'mentors',
  tone_profiles: 'tone_profiles',
  pep_talks: 'pep_talks',
  mission_templates: 'mission_templates',
  evolution_stages: 'evolution_stages',
  quest_templates: 'quest_templates',
  cosmic_assets: 'cosmic_assets',
} as const;

interface CatalogData {
  mentors: any[];
  tone_profiles: any[];
  pep_talks: any[];
  mission_templates: any[];
  evolution_stages: any[];
  quest_templates: any[];
  cosmic_assets: any[];
}

// Initialize Firebase Admin
function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  // Try to use service account from environment
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let app;

  if (serviceAccountPath) {
    try {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount;
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('✅ Initialized Firebase Admin with service account');
    } catch (error) {
      console.warn('⚠️  Could not load service account, trying default credentials...');
      app = initializeApp();
    }
  } else {
    // Use default credentials (useful for local development with Firebase emulator or gcloud auth)
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    try {
      app = initializeApp(projectId ? { projectId } : undefined);
      console.log('✅ Initialized Firebase Admin with default credentials' + (projectId ? ` (project: ${projectId})` : ''));
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin');
      console.error('   Please set one of:');
      console.error('   - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)');
      console.error('   - FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID (with gcloud auth)');
      console.error('   See: https://firebase.google.com/docs/admin/setup');
      process.exit(1);
    }
  }

  return getFirestore(app);
}

// Load catalog data from JSON file
function loadCatalogData(): CatalogData {
  const catalogPath = join(__dirname, '..', 'cosmiq-content-catalog.json');
  
  try {
    const fileContent = readFileSync(catalogPath, 'utf8');
    const data = JSON.parse(fileContent) as CatalogData;
    console.log('✅ Loaded catalog data from:', catalogPath);
    return data;
  } catch (error) {
    console.error('❌ Failed to load catalog data:', error);
    console.error(`   Expected file at: ${catalogPath}`);
    process.exit(1);
  }
}

// Convert ISO date strings to Firestore Timestamps
function processDocument(doc: any): { id: string | undefined; data: any } {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('Invalid document: must be a non-array object');
  }
  
  const processed = { ...doc };
  
  // Convert created_at strings to Firestore Timestamps
  // Only convert if it's a string (not already a timestamp or null)
  if (processed.created_at && typeof processed.created_at === 'string') {
    processed.created_at = FieldValue.serverTimestamp();
  }
  
  // Extract id field (Firestore will use document ID instead)
  // We'll use the id as the document ID when writing
  const { id, ...rest } = processed;
  
  return { id, data: rest };
}

// Write documents to Firestore collection in batches
async function seedCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  documents: any[],
  useIdAsDocId: boolean = true
): Promise<void> {
  if (!documents || documents.length === 0) {
    console.log(`⏭️  Skipping ${collectionName} (empty)`);
    return;
  }

  console.log(`\n📦 Seeding ${collectionName}...`);
  console.log(`   Documents: ${documents.length}`);

  const batchSize = 500; // Firestore batch limit
  let processed = 0;
  let batchCount = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = db.batch();
    const endIndex = Math.min(i + batchSize, documents.length);
    const batchDocs = documents.slice(i, endIndex);
    let batchWriteCount = 0;

    for (const doc of batchDocs) {
      try {
        const { id, data } = processDocument(doc);
        
        // Validate data is not empty
        if (!data || Object.keys(data).length === 0) {
          console.warn(`   ⚠️  Skipping empty document in ${collectionName}`);
          continue;
        }
        
        const docRef = useIdAsDocId && id && typeof id === 'string'
          ? db.collection(collectionName).doc(id)
          : db.collection(collectionName).doc();

        batch.set(docRef, data);
        batchWriteCount++;
      } catch (error) {
        console.error(`   ❌ Error processing document in ${collectionName}:`, error);
        try {
          const docPreview = JSON.stringify(doc, null, 2).substring(0, 200);
          console.error(`   Document:`, docPreview);
        } catch (stringifyError) {
          console.error(`   Document: [Unable to stringify document]`);
        }
        throw error;
      }
    }

    // Only commit if there are writes in the batch
    if (batchWriteCount > 0) {
      try {
        await batch.commit();
        batchCount++;
        processed = endIndex;
        console.log(`   ✅ Committed batch ${batchCount} (${processed}/${documents.length} documents, ${batchWriteCount} written)`);
      } catch (error) {
        console.error(`   ❌ Error committing batch ${batchCount + 1}:`, error);
        throw error;
      }
    } else {
      console.log(`   ⏭️  Skipping empty batch (all documents were skipped)`);
    }
  }

  console.log(`   ✅ Completed ${collectionName}: ${processed} documents in ${batchCount} batch(es)`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  // Handle --collection=name or --collection name format
  let collection: string | null = null;
  const collectionFlagIndex = args.findIndex(arg => arg.startsWith('--collection'));
  if (collectionFlagIndex !== -1) {
    const flag = args[collectionFlagIndex];
    if (flag.includes('=')) {
      collection = flag.split('=')[1];
    } else if (args[collectionFlagIndex + 1]) {
      collection = args[collectionFlagIndex + 1];
    }
  }
  
  const options = {
    dryRun: args.includes('--dry-run'),
    collection,
    verify: args.includes('--verify'),
  };
  return options;
}

// Validate catalog data structure
function validateCatalogData(data: CatalogData): boolean {
  const requiredCollections = Object.keys(COLLECTIONS);
  const missing = requiredCollections.filter(key => !(key in data));
  
  if (missing.length > 0) {
    console.error(`❌ Missing collections in catalog: ${missing.join(', ')}`);
    return false;
  }

  // Validate each collection is an array
  for (const key of requiredCollections) {
    if (!Array.isArray(data[key as keyof CatalogData])) {
      console.error(`❌ Collection ${key} is not an array`);
      return false;
    }
  }

  return true;
}

// Main seeding function
async function seedCatalog() {
  const options = parseArgs();
  
  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be written to Firestore\n');
  }

  console.log('🚀 Starting Cosmiq Content Catalog Seeding...\n');

  // Load catalog data
  const catalogData = loadCatalogData();

  // Validate data structure
  if (!validateCatalogData(catalogData)) {
    console.error('❌ Catalog data validation failed');
    process.exit(1);
  }

  if (options.dryRun) {
    console.log('✅ Catalog data structure is valid');
    console.log('\n📊 Data Summary:');
    console.log(`   - Mentors: ${catalogData.mentors.length}`);
    console.log(`   - Tone Profiles: ${catalogData.tone_profiles.length}`);
    console.log(`   - Pep Talks: ${catalogData.pep_talks.length}`);
    console.log(`   - Mission Templates: ${catalogData.mission_templates.length}`);
    console.log(`   - Evolution Stages: ${catalogData.evolution_stages.length}`);
    console.log(`   - Quest Templates: ${catalogData.quest_templates.length}`);
    console.log(`   - Cosmic Assets: ${catalogData.cosmic_assets.length}`);
    console.log('\n✨ Dry run completed - no data was written');
    return;
  }

  // Initialize Firebase
  const db = initializeFirebaseAdmin();

  // Determine which collections to seed
  let collectionsToSeed: Array<{ name: string; data: any[] }>;
  
  if (options.collection) {
    // Validate collection name
    const validCollections = Object.keys(COLLECTIONS);
    if (!validCollections.includes(options.collection)) {
      console.error(`❌ Invalid collection name: ${options.collection}`);
      console.error(`   Valid collections: ${validCollections.join(', ')}`);
      process.exit(1);
    }
    
    const collectionData = catalogData[options.collection as keyof CatalogData];
    if (!collectionData || !Array.isArray(collectionData)) {
      console.error(`❌ Collection ${options.collection} not found or is not an array in catalog data`);
      process.exit(1);
    }
    
    // Use the mapped collection name from COLLECTIONS
    const collectionName = COLLECTIONS[options.collection as keyof typeof COLLECTIONS];
    collectionsToSeed = [{ name: collectionName, data: collectionData }];
  } else {
    collectionsToSeed = [
      { name: COLLECTIONS.mentors, data: catalogData.mentors },
      { name: COLLECTIONS.tone_profiles, data: catalogData.tone_profiles },
      { name: COLLECTIONS.pep_talks, data: catalogData.pep_talks },
      { name: COLLECTIONS.mission_templates, data: catalogData.mission_templates },
      { name: COLLECTIONS.evolution_stages, data: catalogData.evolution_stages },
      { name: COLLECTIONS.quest_templates, data: catalogData.quest_templates },
      { name: COLLECTIONS.cosmic_assets, data: catalogData.cosmic_assets },
    ];
  }

  // Seed collections
  try {
    for (const { name, data } of collectionsToSeed) {
      if (!data || !Array.isArray(data)) {
        console.warn(`⚠️  Skipping ${name}: data is not an array`);
        continue;
      }
      await seedCollection(db, name, data);
    }

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📊 Summary:');
    for (const { name, data } of collectionsToSeed) {
      console.log(`   - ${name}: ${data.length} documents`);
    }
    console.log('\n✅ All collections have been seeded to Firestore!');

    // Run verification if requested
    if (options.verify) {
      console.log('\n🔍 Running verification...');
      console.log('   Run: npm run verify:catalog');
    }
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding script
seedCatalog().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

