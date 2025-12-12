/**
 * Script to manually trigger daily pep talk generation
 * Run with: npx tsx scripts/trigger-daily-pep-talks-now.ts
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFunctions } from 'firebase-admin/functions';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'cosmiq-prod';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  // Try to use service account from environment or default credentials
  try {
    // Option 1: Use GOOGLE_APPLICATION_CREDENTIALS environment variable
    // Option 2: Use explicit credentials from environment variables
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      : undefined;

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } else {
      // Use default credentials (requires gcloud auth application-default login)
      initializeApp({
        projectId,
      });
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    console.error('\nTo fix this, either:');
    console.error('1. Set GOOGLE_APPLICATION_CREDENTIALS to point to service account key');
    console.error('2. Run: gcloud auth application-default login');
    process.exit(1);
  }
}

async function triggerDailyPepTalks() {
  try {
    console.log('🚀 Triggering daily pep talk generation...');
    console.log(`Project: ${projectId}`);

    // Create a custom token for an admin user
    // Note: This requires an actual user UID or you can use the service account
    // For now, we'll try to call the function directly using HTTP
    
    const functions = getFunctions();
    const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/generateDailyMentorPepTalks`;
    
    console.log(`Function URL: ${functionUrl}`);
    console.log('\nNote: Callable functions require authentication.');
    console.log('To trigger this manually, you can:');
    console.log('1. Use the Admin page in the app');
    console.log('2. Use Firebase CLI: firebase functions:call generateDailyMentorPepTalks');
    console.log('3. Use curl with authentication token');
    
    // Alternative: Use HTTP client to call the function
    // But we'd need a valid auth token
    console.log('\n⚠️  For automated triggering, you need to:');
    console.log('   - Authenticate as a user with admin privileges');
    console.log('   - Get their ID token');
    console.log('   - Call the function with that token');
    
    // For now, let's try using gcloud to call it
    console.log('\n📝 Trying alternative approach...');
    console.log('Run this command manually:');
    console.log(`gcloud functions call generateDailyMentorPepTalks --region=us-central1 --gen2 --data='{"data":{}}'`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

triggerDailyPepTalks();
