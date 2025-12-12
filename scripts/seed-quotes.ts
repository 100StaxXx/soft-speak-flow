#!/usr/bin/env tsx
/**
 * Seed Quotes from Public API to Firebase Firestore
 * 
 * Usage:
 *   tsx scripts/seed-quotes.ts [options]
 * 
 * Options:
 *   --count <number>    Number of quotes to fetch (default: 300)
 *   --dry-run          Validate data without writing to Firestore
 *   --skip-duplicates  Skip quotes that already exist (default: true)
 * 
 * Prerequisites:
 *   - Firebase Admin SDK credentials (GOOGLE_APPLICATION_CREDENTIALS env var or default credentials)
 *   - Firebase project configured
 * 
 * This script will:
 *   1. Fetch quotes from quotable.io API
 *   2. Map them to Firestore schema
 *   3. Store them in Firestore quotes collection
 *   4. Handle duplicates and provide progress feedback
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface QuoteAPIResponse {
  _id: string;
  content: string;
  author: string;
  tags: string[];
  authorSlug: string;
  length: number;
  dateAdded: string;
  dateModified: string;
}

interface FirestoreQuote {
  text: string;
  author: string;
  category: string | null;
  intensity: string | null;
  emotional_triggers: string[];
  mentor_id: string | null;
  is_premium: boolean;
  created_at: any;
}

// Map API tags to our categories
const TAG_TO_CATEGORY: Record<string, string> = {
  'business': 'business',
  'success': 'business',
  'entrepreneurship': 'business',
  'motivational': 'mindset',
  'inspirational': 'mindset',
  'wisdom': 'mindset',
  'philosophy': 'mindset',
  'life': 'mindset',
  'fitness': 'physique',
  'health': 'physique',
  'sports': 'physique',
  'discipline': 'discipline',
  'perseverance': 'discipline',
  'hard-work': 'discipline',
  'confidence': 'confidence',
  'self-esteem': 'confidence',
  'courage': 'confidence',
  'focus': 'focus',
  'productivity': 'focus',
  'concentration': 'focus',
};

// Map tags to emotional triggers
const TAG_TO_TRIGGERS: Record<string, string[]> = {
  'motivational': ['Unmotivated', 'Avoiding Action'],
  'inspirational': ['Heavy or Low', 'Feeling Stuck'],
  'confidence': ['Self-Doubt', 'Anxious & Overthinking'],
  'courage': ['Anxious & Overthinking', 'Self-Doubt'],
  'perseverance': ['Frustrated', 'Emotionally Hurt'],
  'discipline': ['Needing Discipline', 'Avoiding Action'],
  'focus': ['Anxious & Overthinking', 'Avoiding Action'],
  'success': ['Motivated & Ready', 'Needing Discipline'],
  'wisdom': ['In Transition', 'Feeling Stuck'],
  'life': ['Heavy or Low', 'In Transition'],
};

// Determine intensity based on quote length and content
function determineIntensity(quote: QuoteAPIResponse): string {
  const lowerContent = quote.content.toLowerCase();
  const intenseWords = ['must', 'never', 'always', 'destroy', 'crush', 'dominate', 'unleash', 'break', 'shatter'];
  const gentleWords = ['maybe', 'perhaps', 'consider', 'gentle', 'soft', 'kind', 'peaceful'];
  
  const hasIntense = intenseWords.some(word => lowerContent.includes(word));
  const hasGentle = gentleWords.some(word => lowerContent.includes(word));
  
  if (hasIntense) return 'intense';
  if (hasGentle) return 'gentle';
  if (quote.length > 100) return 'moderate';
  return 'moderate';
}

// Map API quote to Firestore schema
function mapQuoteToFirestore(quote: QuoteAPIResponse, mentors: any[]): FirestoreQuote {
  // Determine category from tags
  let category: string | null = null;
  for (const tag of quote.tags) {
    if (TAG_TO_CATEGORY[tag]) {
      category = TAG_TO_CATEGORY[tag];
      break;
    }
  }
  // Default to mindset if no category found
  if (!category) category = 'mindset';

  // Determine emotional triggers from tags
  const emotionalTriggers: string[] = [];
  for (const tag of quote.tags) {
    if (TAG_TO_TRIGGERS[tag]) {
      emotionalTriggers.push(...TAG_TO_TRIGGERS[tag]);
    }
  }
  // Remove duplicates
  const uniqueTriggers = Array.from(new Set(emotionalTriggers));
  // Default triggers if none found
  if (uniqueTriggers.length === 0) {
    uniqueTriggers.push('Motivated & Ready');
  }

  // Find matching mentor (optional - can be null)
  let mentorId: string | null = null;
  if (mentors.length > 0) {
    const matchingMentors = mentors.filter((mentor: any) =>
      mentor.tags?.some((tag: string) =>
        tag.toLowerCase().includes(category!.toLowerCase())
      )
    );
    if (matchingMentors.length > 0) {
      mentorId = matchingMentors[Math.floor(Math.random() * matchingMentors.length)].id;
    }
  }

  return {
    text: quote.content,
    author: quote.author || 'Unknown',
    category,
    intensity: determineIntensity(quote),
    emotional_triggers: uniqueTriggers,
    mentor_id: mentorId,
    is_premium: false,
    created_at: FieldValue.serverTimestamp(),
  };
}

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
      console.log('✅ Initialized Firebase Admin with service account');
    } catch (error) {
      console.warn('⚠️  Could not load service account, trying default credentials...');
      app = initializeApp();
    }
  } else {
    // Try to get project ID from environment or .firebaserc
    let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      try {
        const firebasercPath = join(__dirname, '..', '.firebaserc');
        const firebaserc = JSON.parse(readFileSync(firebasercPath, 'utf8'));
        projectId = firebaserc.projects?.default;
      } catch (error) {
        // Ignore if .firebaserc doesn't exist
      }
    }
    
    try {
      app = initializeApp(projectId ? { projectId } : undefined);
      console.log('✅ Initialized Firebase Admin with default credentials' + (projectId ? ` (project: ${projectId})` : ''));
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin');
      console.error('   Please set one of:');
      console.error('   - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)');
      console.error('   - FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID (with gcloud auth)');
      console.error('   - Or ensure .firebaserc exists with project ID');
      process.exit(1);
    }
  }

  return getFirestore(app);
}

// Fetch a batch of quotes from quotable.io API
async function fetchQuoteBatch(page: number, pageSize: number = 150): Promise<QuoteAPIResponse[]> {
  try {
    const url = `https://api.quotable.io/quotes?limit=${pageSize}&page=${page}&tags=motivational|inspirational|success|wisdom|business|life|fitness|discipline|confidence|focus`;
    
    // Use https module to handle certificate issues
    const response = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
      const req = https.get(url, { 
        rejectUnauthorized: false // Allow self-signed or expired certificates for development
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 200, data });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
    
    if (response.statusCode !== 200) {
      throw new Error(`API returned ${response.statusCode}`);
    }

    const data = JSON.parse(response.data);
    const results: QuoteAPIResponse[] = data.results || [];
    
    // Rate limiting - be nice to the API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return results;
  } catch (error) {
    console.error(`❌ Error fetching quotes from page ${page}:`, error);
    throw error;
  }
}

// Check if quote already exists in Firestore
async function quoteExists(db: FirebaseFirestore.Firestore, text: string): Promise<boolean> {
  const snapshot = await db.collection('quotes')
    .where('text', '==', text)
    .limit(1)
    .get();
  return !snapshot.empty;
}

// Check multiple quotes for existence (batch check for efficiency)
async function checkQuotesExist(
  db: FirebaseFirestore.Firestore,
  quotes: FirestoreQuote[]
): Promise<Set<string>> {
  const existingTexts = new Set<string>();
  
  // Firestore doesn't support IN queries with more than 10 items efficiently
  // So we'll check in batches of 10
  const batchSize = 10;
  
  for (let i = 0; i < quotes.length; i += batchSize) {
    const batch = quotes.slice(i, i + batchSize);
    const texts = batch.map(q => q.text);
    
    // Check each quote individually (could be optimized with a compound query if needed)
    for (const quote of batch) {
      const exists = await quoteExists(db, quote.text);
      if (exists) {
        existingTexts.add(quote.text);
      }
    }
  }
  
  return existingTexts;
}

// Seed quotes to Firestore, fetching more as needed until target is reached
async function seedQuotesWithAutoFetch(
  db: FirebaseFirestore.Firestore,
  targetCount: number,
  mentors: any[],
  skipDuplicates: boolean = true,
  dryRun: boolean = false
): Promise<void> {
  console.log(`\n📦 ${dryRun ? 'Validating' : 'Seeding'} quotes to Firestore...`);
  console.log(`   Target count: ${targetCount}`);
  console.log(`   Skip duplicates: ${skipDuplicates}`);
  console.log(`   Dry run: ${dryRun}`);

  const firestoreBatchSize = 500; // Firestore batch write limit
  const apiPageSize = 150; // API max per page
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let apiPage = 1;
  let fetchedCount = 0;
  const seenApiIds = new Set<string>(); // Track API IDs we've already fetched

  // Queue to hold quotes ready to be inserted
  const quoteQueue: FirestoreQuote[] = [];

  while (inserted < targetCount) {
    // If queue is getting low, fetch more quotes from API
    if (quoteQueue.length < 50 && inserted + quoteQueue.length < targetCount) {
      console.log(`\n📥 Fetching more quotes from API (page ${apiPage})...`);
      
      try {
        const apiQuotes = await fetchQuoteBatch(apiPage, apiPageSize);
        
        if (apiQuotes.length === 0) {
          console.log('   ⚠️  No more quotes available from API');
          break;
        }

        // Filter out API-level duplicates
        const newQuotes = apiQuotes.filter(q => !seenApiIds.has(q._id));
        newQuotes.forEach(q => seenApiIds.add(q._id));
        
        // Map to Firestore schema
        const firestoreQuotes = newQuotes.map(quote => mapQuoteToFirestore(quote, mentors));
        quoteQueue.push(...firestoreQuotes);
        fetchedCount += newQuotes.length;
        
        console.log(`   ✅ Fetched ${newQuotes.length} new quotes (total fetched: ${fetchedCount}, queue: ${quoteQueue.length})`);
        
        apiPage++;
        
        // If we got fewer results than requested, we might be near the end
        if (apiQuotes.length < apiPageSize) {
          console.log('   ⚠️  Reached end of available quotes');
        }
      } catch (error) {
        console.error(`   ❌ Error fetching quotes:`, error);
        // Continue with what we have
        if (quoteQueue.length === 0) {
          throw error;
        }
        break;
      }
    }

    // If queue is empty and we still need more, break
    if (quoteQueue.length === 0) {
      console.log('   ⚠️  No more quotes available to process');
      break;
    }

    // Process quotes from queue in Firestore batches
    const batch = db.batch();
    const batchQuotes: FirestoreQuote[] = [];
    let batchInserted = 0;

    // Fill batch with quotes from queue
    while (batchQuotes.length < firestoreBatchSize && quoteQueue.length > 0 && inserted + batchInserted < targetCount) {
      const quote = quoteQueue.shift()!;
      batchQuotes.push(quote);
    }

    if (batchQuotes.length === 0) break;

    // Check for duplicates if enabled
    let quotesToInsert = batchQuotes;
    if (skipDuplicates && !dryRun) {
      const existingTexts = await checkQuotesExist(db, batchQuotes);
      quotesToInsert = batchQuotes.filter(q => !existingTexts.has(q.text));
      skipped += batchQuotes.length - quotesToInsert.length;
    }

    // Add quotes to batch
    for (const quote of quotesToInsert) {
      try {
        if (!dryRun) {
          const quoteRef = db.collection('quotes').doc();
          batch.set(quoteRef, quote);
          batchInserted++;
        } else {
          // Validate quote structure
          if (!quote.text || !quote.author) {
            throw new Error('Quote missing required fields: text or author');
          }
          batchInserted++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing quote:`, error);
        errors++;
      }
    }

    // Commit batch
    if (!dryRun && batchInserted > 0) {
      try {
        await batch.commit();
        inserted += batchInserted;
        console.log(`   ✅ Inserted ${batchInserted} quotes (${inserted}/${targetCount} total inserted, ${quoteQueue.length} in queue)`);
      } catch (error) {
        console.error(`   ❌ Error committing batch:`, error);
        errors += batchInserted;
      }
    } else if (dryRun) {
      inserted += batchInserted;
      console.log(`   ✅ Validated ${batchInserted} quotes (${inserted}/${targetCount} total validated, ${quoteQueue.length} in queue)`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Target: ${targetCount}`);
  console.log(`   Fetched from API: ${fetchedCount}`);
  console.log(`   ${dryRun ? 'Validated' : 'Inserted'}: ${inserted}`);
  if (skipDuplicates) {
    console.log(`   Skipped (duplicates): ${skipped}`);
  }
  if (errors > 0) {
    console.log(`   Errors: ${errors}`);
  }
  
  if (inserted < targetCount) {
    console.log(`   ⚠️  Only inserted ${inserted} out of ${targetCount} requested quotes`);
  } else {
    console.log(`   ✅ Successfully ${dryRun ? 'validated' : 'inserted'} ${inserted} quotes!`);
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const countIndex = args.indexOf('--count');
  const count = countIndex !== -1 && args[countIndex + 1] 
    ? parseInt(args[countIndex + 1], 10) 
    : 300;
  const dryRun = args.includes('--dry-run');
  const skipDuplicates = !args.includes('--no-skip-duplicates');

  console.log('🚀 Quote Seeding Script');
  console.log('='.repeat(50));
  console.log(`Count: ${count}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Skip duplicates: ${skipDuplicates}`);

  try {
    // Initialize Firebase
    const db = initializeFirebaseAdmin();

    // Fetch mentors for assignment
    console.log(`\n👥 Fetching mentors for quote assignment...`);
    let mentors: any[] = [];
    try {
      const mentorsSnapshot = await db.collection('mentors').get();
      mentors = mentorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`✅ Found ${mentors.length} mentors`);
    } catch (error) {
      console.warn('⚠️  Could not fetch mentors, quotes will have null mentor_id');
    }

    // Seed quotes with auto-fetch (will keep fetching until target is reached)
    await seedQuotesWithAutoFetch(db, count, mentors, skipDuplicates, dryRun);

    console.log('\n✅ Done!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
main();
