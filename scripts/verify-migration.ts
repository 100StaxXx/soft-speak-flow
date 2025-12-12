#!/usr/bin/env tsx
/**
 * Migration Verification Script
 * Checks for remaining Supabase usage and verifies Firebase migration completeness
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface CheckResult {
  file: string;
  issues: string[];
}

const results: CheckResult[] = [];

// Patterns to check for
const SUPABASE_PATTERNS = [
  /from\s+['"]@\/integrations\/supabase/,
  /import.*supabase.*from/,
  /supabase\.from\(/,
  /supabase\.auth\./,
  /supabase\.storage\./,
  /supabase\.functions\./,
  /@supabase\/supabase-js/,
];

const FIREBASE_PATTERNS = [
  /from\s+['"]@\/lib\/firebase/,
  /@\/lib\/firebase\//,
];

async function checkFile(filePath: string): Promise<CheckResult | null> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: string[] = [];

  // Check for Supabase usage
  SUPABASE_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(content)) {
      const matches = content.match(new RegExp(pattern.source, 'g'));
      issues.push(`Found Supabase usage: ${matches?.join(', ')}`);
    }
  });

  // Check if file uses Firebase (for verification)
  const usesFirebase = FIREBASE_PATTERNS.some(pattern => pattern.test(content));

  if (issues.length > 0) {
    return {
      file: filePath,
      issues,
    };
  }

  return null;
}

async function main() {
  console.log('🔍 Verifying Supabase to Firebase migration...\n');

  // Get all TypeScript/JavaScript files in src
  const files = await glob('src/**/*.{ts,tsx,js,jsx}', {
    ignore: [
      '**/node_modules/**', 
      '**/*.d.ts', 
      '**/dist/**',
      '**/integrations/supabase/**', // Exclude Supabase integration files (expected to remain until cleanup)
    ],
  });

  console.log(`Checking ${files.length} files...\n`);

  for (const file of files) {
    const result = await checkFile(file);
    if (result) {
      results.push(result);
    }
  }

  // Check package.json
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps['@supabase/supabase-js'] || deps['@supabase/auth-helpers-react']) {
      results.push({
        file: 'package.json',
        issues: ['Contains Supabase dependencies'],
      });
    }
  }

  // Report results
  if (results.length === 0) {
    console.log('✅ No Supabase usage found! Migration appears complete.\n');
    process.exit(0);
  } else {
    console.log(`❌ Found ${results.length} file(s) with Supabase usage:\n`);
    
    results.forEach(result => {
      console.log(`📄 ${result.file}`);
      result.issues.forEach(issue => {
        console.log(`   ⚠️  ${issue}`);
      });
      console.log('');
    });

    console.log('⚠️  Migration incomplete. Please address the issues above.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error running verification:', error);
  process.exit(1);
});

