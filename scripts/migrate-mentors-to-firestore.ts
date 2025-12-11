/**
 * Migrate mentors from Supabase to Firestore
 * 
 * Run with: npx ts-node scripts/migrate-mentors-to-firestore.ts
 * 
 * Prerequisites:
 * - Set environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 * - Temporarily allow writes in Firestore rules for mentors collection
 */

import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const firebaseConfig = {
  apiKey: "AIzaSyAy7LTw3I8rFkyyOkylEaxnGdEDFMl0AHs",
  authDomain: "cosmiq-prod.firebaseapp.com",
  projectId: "cosmiq-prod",
  storageBucket: "cosmiq-prod.firebasestorage.app",
  messagingSenderId: "636156363416",
  appId: "1:636156363416:web:206d7bcafd23ce894e06ed",
  measurementId: "G-ZMYXRHZN96",
};

async function migrateMentors() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
    process.exit(1);
  }

  // Initialize Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    console.log('📥 Fetching mentors from Supabase...');
    const { data: mentors, error } = await supabase
      .from('mentors')
      .select('*')
      .order('name');

    if (error) {
      throw error;
    }

    if (!mentors || mentors.length === 0) {
      console.log('⚠️ No mentors found in Supabase');
      return;
    }

    console.log(`✅ Found ${mentors.length} mentors in Supabase`);
    console.log('📤 Migrating to Firestore...');

    // Migrate each mentor
    for (const mentor of mentors) {
      const mentorData = {
        name: mentor.name,
        slug: mentor.slug,
        description: mentor.description,
        tone_description: mentor.tone_description,
        avatar_url: mentor.avatar_url || null,
        tags: mentor.tags || [],
        mentor_type: mentor.mentor_type,
        target_user_type: mentor.target_user_type || null,
        short_title: mentor.short_title || null,
        primary_color: mentor.primary_color || '#7B68EE',
        target_user: mentor.target_user || null,
        themes: mentor.themes || null,
        intensity_level: mentor.intensity_level || null,
        is_active: mentor.is_active !== false, // Default to true
        created_at: mentor.created_at || new Date().toISOString(),
      };

      // Use the Supabase ID as the Firestore document ID
      const docRef = doc(collection(db, 'mentors'), mentor.id);
      await setDoc(docRef, mentorData, { merge: true });
      console.log(`  ✅ Migrated: ${mentor.name} (${mentor.slug})`);
    }

    console.log(`\n🎉 Successfully migrated ${mentors.length} mentors to Firestore!`);
    console.log('\n⚠️  Remember to restore your original Firestore rules after migration!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateMentors();

