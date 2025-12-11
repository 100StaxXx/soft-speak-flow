#!/usr/bin/env tsx
/**
 * Verify Cosmiq Content Catalog in Firebase Firestore
 * 
 * Usage:
 *   tsx scripts/verify-catalog-seed.ts
 * 
 * This script verifies that all collections have been seeded correctly
 * by checking document counts and sample data.
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Expected counts from catalog
const EXPECTED_COUNTS = {
  mentors: 9,
  tone_profiles: 9,
  pep_talks: 9,
  mission_templates: 15,
  evolution_stages: 21,
  quest_templates: 10,
  cosmic_assets: 15,
} as const;

// Initialize Firebase Admin
function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let app;

  if (serviceAccountPath) {
    try {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount;
      app = initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (error) {
      app = initializeApp();
    }
  } else {
    app = initializeApp();
  }

  return getFirestore(app);
}

// Verify a collection
async function verifyCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  expectedCount: number
): Promise<{ success: boolean; actualCount: number; sample?: any }> {
  try {
    const allDocs = await db.collection(collectionName).get();
    const actualCount = allDocs.size;
    
    const sample = allDocs.empty ? null : allDocs.docs[0].data();

    return {
      success: actualCount === expectedCount,
      actualCount,
      sample: sample || undefined,
    };
  } catch (error) {
    console.error(`   ❌ Error reading ${collectionName}:`, error);
    return {
      success: false,
      actualCount: 0,
    };
  }
}

// Main verification function
async function verifyCatalog() {
  console.log('🔍 Verifying Cosmiq Content Catalog in Firestore...\n');

  const db = initializeFirebaseAdmin();
  const results: Record<string, { success: boolean; actualCount: number; expectedCount: number }> = {};

  // Verify each collection
  for (const [collectionName, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
    console.log(`📊 Checking ${collectionName}...`);
    const result = await verifyCollection(db, collectionName, expectedCount);
    results[collectionName] = {
      ...result,
      expectedCount,
    };

    if (result.success) {
      console.log(`   ✅ ${collectionName}: ${result.actualCount}/${expectedCount} documents`);
    } else {
      console.log(`   ❌ ${collectionName}: ${result.actualCount}/${expectedCount} documents (MISMATCH)`);
    }

    if (result.sample) {
      const sampleKeys = Object.keys(result.sample).slice(0, 3).join(', ');
      console.log(`   📄 Sample fields: ${sampleKeys}...`);
    }
  }

  // Summary
  console.log('\n📋 Verification Summary:');
  console.log('─'.repeat(50));
  
  const allPassed = Object.values(results).every(r => r.success);
  const totalExpected = Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0);
  const totalActual = Object.values(results).reduce((a, b) => a + b.actualCount, 0);

  for (const [collectionName, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${collectionName.padEnd(20)} ${result.actualCount.toString().padStart(3)}/${result.expectedCount}`);
  }

  console.log('─'.repeat(50));
  console.log(`   Total: ${totalActual}/${totalExpected} documents`);

  if (allPassed) {
    console.log('\n✨ All collections verified successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some collections have mismatched counts. Please re-run the seeding script.');
    process.exit(1);
  }
}

// Run verification
verifyCatalog().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

