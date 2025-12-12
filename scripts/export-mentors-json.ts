/**
 * Export mentors as JSON for manual import into Firestore
 * 
 * Run with: npx ts-node scripts/export-mentors-json.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

async function exportMentors() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

    console.log(`✅ Found ${mentors.length} mentors\n`);

    // Format for Firestore
    const mentorsForFirestore = mentors.map(mentor => ({
      id: mentor.id, // Use this as the document ID in Firestore
      data: {
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
        is_active: mentor.is_active !== false,
        created_at: mentor.created_at || new Date().toISOString(),
      }
    }));

    console.log('📋 Copy this JSON and paste into Firebase Console:\n');
    console.log(JSON.stringify(mentorsForFirestore, null, 2));
    
    console.log('\n\n📝 Instructions:');
    console.log('1. Go to Firebase Console → Firestore Database');
    console.log('2. Create collection "mentors" if it doesn\'t exist');
    console.log('3. For each mentor, click "Add document"');
    console.log('4. Use the "id" as the document ID');
    console.log('5. Paste the "data" fields as the document fields');
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportMentors();

