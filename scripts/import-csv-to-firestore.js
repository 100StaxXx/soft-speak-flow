/**
 * Import CSV/JSON exports from Supabase to Firestore
 * 
 * Usage:
 * 1. Export tables from Supabase Dashboard as CSV or JSON
 * 2. Put the files in a folder (e.g., ./supabase-exports/)
 * 3. Run: node scripts/import-csv-to-firestore.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Initialize Firebase Admin
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let fullPath = serviceAccountPath;
  if (!serviceAccountPath.startsWith('/') && !serviceAccountPath.match(/^[A-Za-z]:/)) {
    fullPath = join(__dirname, '..', serviceAccountPath);
  }
  try {
    const serviceAccountFile = readFileSync(fullPath, 'utf8');
    serviceAccount = JSON.parse(serviceAccountFile);
    console.log(`✅ Loaded service account from: ${fullPath}`);
  } catch (error) {
    console.error('❌ Could not read service account file:', error.message);
    process.exit(1);
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (error) {
    console.error('❌ Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ Missing Firebase Service Account credentials');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Convert date strings to Firestore Timestamps
function convertDates(obj) {
  const converted = { ...obj };
  Object.keys(converted).forEach(key => {
    if (key.includes('_at') || key.includes('_date') || key === 'date') {
      if (converted[key]) {
        try {
          const date = new Date(converted[key]);
          if (!isNaN(date.getTime())) {
            converted[key] = Timestamp.fromDate(date);
          }
        } catch (e) {
          // Keep original if conversion fails
        }
      }
    }
  });
  return converted;
}

// Import a single file
async function importFile(filePath, collectionName) {
  console.log(`\n📦 Importing ${collectionName} from ${filePath}...`);

  try {
    const fileContent = readFileSync(filePath, 'utf8');
    let data;

    // Determine file type and parse
    if (filePath.endsWith('.json')) {
      data = JSON.parse(fileContent);
      if (!Array.isArray(data)) {
        data = [data];
      }
    } else if (filePath.endsWith('.csv')) {
      // Try semicolon delimiter first (Supabase exports), then comma
      let parsed;
      try {
        parsed = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          cast: true,
          delimiter: ';'
        });
        // If we only got one column, try comma delimiter
        if (parsed.length > 0 && Object.keys(parsed[0]).length === 1) {
          parsed = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            cast: true,
            delimiter: ','
          });
        }
      } catch (e) {
        // Fallback to comma delimiter
        parsed = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          cast: true,
          delimiter: ','
        });
      }
      data = parsed;
    } else {
      throw new Error('Unsupported file format. Use .json or .csv');
    }

    if (!data || data.length === 0) {
      console.log(`   ⚠️  No data found in file`);
      return { migrated: 0, skipped: 0 };
    }

    console.log(`   Found ${data.length} records`);

    // Import in batches
    const batchSize = 500;
    let migrated = 0;
    let skipped = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = db.batch();
      const batchData = data.slice(i, i + batchSize);
      let batchCount = 0;

      for (const row of batchData) {
        try {
          // Use 'id' field as document ID, or generate one
          const docId = row.id || `${collectionName}_${i + batchCount}_${Date.now()}`;
          const docData = convertDates(row);
          
          // Remove id from data (it's the document ID)
          delete docData.id;
          
          const docRef = db.collection(collectionName).doc(docId);
          batch.set(docRef, docData, { merge: true });
          batchCount++;
        } catch (err) {
          console.error(`   ❌ Error processing row:`, err.message);
          skipped++;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        migrated += batchCount;
        console.log(`   ✅ Migrated batch: ${migrated}/${data.length}`);
      }
    }

    console.log(`   ✅ Completed: ${migrated} migrated, ${skipped} skipped`);
    return { migrated, skipped };

  } catch (error) {
    console.error(`   ❌ Error importing ${collectionName}:`, error.message);
    throw error;
  }
}

// Main import function
async function importAll() {
  console.log('🚀 Starting CSV/JSON Import to Firestore\n');

  // Default export directory
  const exportDir = join(__dirname, '..', 'supabase-exports');
  
  console.log(`📁 Looking for files in: ${exportDir}\n`);

  // Map of filename patterns to collection names
  const fileMappings = {
    'mentors': 'mentors',
    'quotes': 'quotes',
    'zodiac_sign_content': 'zodiac_sign_content',
    'evolution_thresholds': 'evolution_thresholds',
    'pep_talks': 'pep_talks',
    'daily_pep_talks': 'daily_pep_talks', // Keep this separate from pep_talks
    'challenges': 'challenges',
  };

  const stats = {};

  try {
    // Check if directory exists
    if (!statSync(exportDir).isDirectory()) {
      console.error(`❌ Directory not found: ${exportDir}`);
      console.error(`   Create the directory and add your exported files there`);
      process.exit(1);
    }

    // Read all files
    const files = readdirSync(exportDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const csvFiles = files.filter(f => f.endsWith('.csv'));

    if (jsonFiles.length === 0 && csvFiles.length === 0) {
      console.error(`❌ No .json or .csv files found in ${exportDir}`);
      console.error(`   Export your tables from Supabase and place them in that directory`);
      process.exit(1);
    }

    console.log(`Found ${jsonFiles.length} JSON files and ${csvFiles.length} CSV files\n`);

    // Import each file
    for (const file of [...jsonFiles, ...csvFiles]) {
      // Try to match filename to collection name
      let collectionName = null;
      const fileLower = file.toLowerCase();
      
      // Check exact matches first (longer names first to avoid partial matches)
      const sortedMappings = Object.entries(fileMappings).sort((a, b) => b[0].length - a[0].length);
      for (const [key, value] of sortedMappings) {
        if (fileLower.includes(key.toLowerCase())) {
          collectionName = value;
          break;
        }
      }

      // If no match, use filename without extension
      if (!collectionName) {
        collectionName = file.replace(/\.(json|csv)$/i, '');
        console.log(`   ⚠️  No mapping found for ${file}, using collection name: ${collectionName}`);
      }

      const filePath = join(exportDir, file);
      const result = await importFile(filePath, collectionName);
      stats[collectionName] = result;
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary');
    console.log('='.repeat(50));

    let totalMigrated = 0;
    let totalSkipped = 0;

    Object.entries(stats).forEach(([name, { migrated, skipped }]) => {
      console.log(`${name}: ${migrated} migrated, ${skipped} skipped`);
      totalMigrated += migrated;
      totalSkipped += skipped;
    });

    console.log('\n' + '-'.repeat(50));
    console.log(`Total: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    console.log('\n✅ Import complete!');

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run import
importAll()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });

