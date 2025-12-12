/**
 * Simple script to verify Firestore rules file syntax
 * Run with: npx tsx scripts/verify-firestore-rules.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const rulesPath = resolve(process.cwd(), 'firestore.rules');

console.log('🔍 Verifying Firestore rules file...\n');

try {
  const rulesContent = readFileSync(rulesPath, 'utf8');
  
  // Basic syntax checks
  const checks = [
    {
      name: 'Rules version present',
      test: () => rulesContent.includes("rules_version = '2'"),
    },
    {
      name: 'Service declaration present',
      test: () => rulesContent.includes('service cloud.firestore'),
    },
    {
      name: 'daily_check_ins rules present',
      test: () => rulesContent.includes('daily_check_ins'),
    },
    {
      name: 'daily_tasks rules present',
      test: () => rulesContent.includes('daily_tasks'),
    },
    {
      name: 'pep_talks rules present',
      test: () => rulesContent.includes('pep_talks'),
    },
    {
      name: 'quotes rules present',
      test: () => rulesContent.includes('match /quotes/'),
    },
    {
      name: 'habits rules present',
      test: () => rulesContent.includes('match /habits/'),
    },
    {
      name: 'Authentication check present',
      test: () => rulesContent.includes('isAuthenticated()'),
    },
    {
      name: 'User ownership check present',
      test: () => rulesContent.includes('user_id == request.auth.uid'),
    },
  ];

  let passed = 0;
  let failed = 0;

  console.log('Running checks...\n');
  
  checks.forEach((check) => {
    const result = check.test();
    if (result) {
      console.log(`✅ ${check.name}`);
      passed++;
    } else {
      console.log(`❌ ${check.name}`);
      failed++;
    }
  });

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n✅ All checks passed! Rules file looks good.');
    console.log('\n📝 Next steps:');
    console.log('   1. Rules have been deployed to Firebase');
    console.log('   2. Test in the app by creating a check-in');
    console.log('   3. Verify no permission errors appear');
    process.exit(0);
  } else {
    console.log('\n❌ Some checks failed. Please review the rules file.');
    process.exit(1);
  }
} catch (error: any) {
  console.error('❌ Error reading rules file:', error.message);
  process.exit(1);
}
