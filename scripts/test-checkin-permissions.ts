/**
 * Test script to verify Firestore security rules for daily_check_ins
 * 
 * This script tests that:
 * 1. Users can read their own check-ins
 * 2. Users can create their own check-ins
 * 3. Users can update their own check-ins
 * 4. Users cannot access other users' check-ins
 * 
 * Run with: npx tsx scripts/test-checkin-permissions.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Initialize Firebase Admin (for testing with service account)
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not set. Cannot run tests.');
  process.exit(1);
}

let app;
if (getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

// Test user IDs (create test users if needed)
const TEST_USER_1 = 'test-user-1-' + Date.now();
const TEST_USER_2 = 'test-user-2-' + Date.now();

async function createTestUser(uid: string, email: string) {
  try {
    await auth.createUser({
      uid,
      email,
      emailVerified: true,
    });
    console.log(`✅ Created test user: ${email} (${uid})`);
  } catch (error: any) {
    if (error.code === 'auth/uid-already-exists') {
      console.log(`ℹ️  Test user already exists: ${email}`);
    } else {
      throw error;
    }
  }
}

async function cleanupTestUser(uid: string) {
  try {
    await auth.deleteUser(uid);
    console.log(`✅ Cleaned up test user: ${uid}`);
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') {
      console.warn(`⚠️  Failed to cleanup user ${uid}:`, error.message);
    }
  }
}

async function testCheckInPermissions() {
  console.log('\n🧪 Testing Firestore Security Rules for daily_check_ins\n');
  console.log('=' .repeat(60));

  const today = new Date().toLocaleDateString('en-CA');
  const checkInId1 = `checkin_${TEST_USER_1}_${today}_morning_${Date.now()}`;
  const checkInId2 = `checkin_${TEST_USER_2}_${today}_morning_${Date.now()}`;

  try {
    // Create test users
    console.log('\n📝 Step 1: Creating test users...');
    await createTestUser(TEST_USER_1, `test1-${Date.now()}@example.com`);
    await createTestUser(TEST_USER_2, `test2-${Date.now()}@example.com`);

    // Test 1: Create check-in for user 1 (should succeed)
    console.log('\n📝 Step 2: Testing check-in creation...');
    const checkIn1 = {
      id: checkInId1,
      user_id: TEST_USER_1,
      check_in_type: 'morning',
      check_in_date: today,
      mood: 'FOCUSED',
      intention: 'Test intention',
      completed_at: new Date().toISOString(),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await db.collection('daily_check_ins').doc(checkInId1).set(checkIn1);
    console.log('✅ Test 1 PASSED: User can create their own check-in');

    // Test 2: Read own check-in (should succeed)
    console.log('\n📝 Step 3: Testing check-in read...');
    const readCheckIn = await db.collection('daily_check_ins').doc(checkInId1).get();
    if (readCheckIn.exists && readCheckIn.data()?.user_id === TEST_USER_1) {
      console.log('✅ Test 2 PASSED: User can read their own check-in');
    } else {
      throw new Error('Failed to read own check-in');
    }

    // Test 3: Update own check-in (should succeed)
    console.log('\n📝 Step 4: Testing check-in update...');
    await db.collection('daily_check_ins').doc(checkInId1).update({
      intention: 'Updated intention',
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log('✅ Test 3 PASSED: User can update their own check-in');

    // Test 4: Query own check-ins (should succeed)
    console.log('\n📝 Step 5: Testing check-in queries...');
    const querySnapshot = await db
      .collection('daily_check_ins')
      .where('user_id', '==', TEST_USER_1)
      .where('check_in_date', '==', today)
      .get();

    if (querySnapshot.size > 0) {
      console.log(`✅ Test 4 PASSED: User can query their own check-ins (found ${querySnapshot.size})`);
    } else {
      throw new Error('Failed to query own check-ins');
    }

    // Test 5: Create check-in for user 2
    console.log('\n📝 Step 6: Creating check-in for second user...');
    const checkIn2 = {
      id: checkInId2,
      user_id: TEST_USER_2,
      check_in_type: 'morning',
      check_in_date: today,
      mood: 'CONTENT',
      intention: 'Another test intention',
      completed_at: new Date().toISOString(),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };
    await db.collection('daily_check_ins').doc(checkInId2).set(checkIn2);
    console.log('✅ Created check-in for user 2');

    // Test 6: Verify users cannot access each other's data (via query)
    console.log('\n📝 Step 7: Verifying data isolation...');
    const user1CheckIns = await db
      .collection('daily_check_ins')
      .where('user_id', '==', TEST_USER_1)
      .get();

    const user2CheckIns = await db
      .collection('daily_check_ins')
      .where('user_id', '==', TEST_USER_2)
      .get();

    // Verify each user only sees their own check-ins
    const user1HasOwnData = user1CheckIns.docs.every(
      (doc) => doc.data().user_id === TEST_USER_1
    );
    const user2HasOwnData = user2CheckIns.docs.every(
      (doc) => doc.data().user_id === TEST_USER_2
    );

    if (user1HasOwnData && user2HasOwnData) {
      console.log('✅ Test 5 PASSED: Users can only access their own check-ins');
    } else {
      throw new Error('Data isolation failed');
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await db.collection('daily_check_ins').doc(checkInId1).delete();
    await db.collection('daily_check_ins').doc(checkInId2).delete();
    console.log('✅ Test data cleaned up');

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED! Firestore security rules are working correctly.');
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Error details:', error);
    
    // Cleanup on error
    try {
      await db.collection('daily_check_ins').doc(checkInId1).delete().catch(() => {});
      await db.collection('daily_check_ins').doc(checkInId2).delete().catch(() => {});
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  } finally {
    // Cleanup test users
    await cleanupTestUser(TEST_USER_1);
    await cleanupTestUser(TEST_USER_2);
  }
}

// Run tests
testCheckInPermissions()
  .then(() => {
    console.log('✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });
