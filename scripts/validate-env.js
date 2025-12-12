#!/usr/bin/env node

/**
 * Validate that all required environment variables are present before building.
 * This prevents iOS builds from failing due to missing Firebase configuration.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required environment variables for Firebase
const REQUIRED_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

// Optional but recommended
const RECOMMENDED_VARS = [
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
];

// Load .env file if it exists
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    }
  });
}

// Check required variables
const missing = REQUIRED_VARS.filter(key => {
  const value = process.env[key];
  return !value || value.trim() === '' || value === 'undefined';
});

if (missing.length > 0) {
  console.error('❌ ERROR: Missing required environment variables:');
  missing.forEach(key => {
    console.error(`   - ${key}`);
  });
  console.error('\n💡 Please add these variables to your .env file.');
  console.error('   See .env.example for reference.\n');
  process.exit(1);
}

// Check recommended variables
const missingRecommended = RECOMMENDED_VARS.filter(key => {
  const value = process.env[key];
  return !value || value.trim() === '' || value === 'undefined';
});

if (missingRecommended.length > 0) {
  console.warn('⚠️  WARNING: Missing recommended environment variables:');
  missingRecommended.forEach(key => {
    console.warn(`   - ${key}`);
  });
  console.warn('   These are optional but recommended for full functionality.\n');
}

// Validate Firebase config values (basic sanity checks)
const checks = [
  { key: 'VITE_FIREBASE_AUTH_DOMAIN', pattern: /\.firebaseapp\.com$/, name: 'auth domain' },
  { key: 'VITE_FIREBASE_PROJECT_ID', minLength: 3, name: 'project ID' },
  { key: 'VITE_FIREBASE_API_KEY', minLength: 20, name: 'API key' },
];

let hasWarnings = false;
checks.forEach(({ key, pattern, minLength, name }) => {
  const value = process.env[key];
  if (value) {
    if (pattern && !pattern.test(value)) {
      console.warn(`⚠️  WARNING: ${key} may be invalid (expected ${name} format)`);
      hasWarnings = true;
    }
    if (minLength && value.length < minLength) {
      console.warn(`⚠️  WARNING: ${key} seems too short (expected ${name})`);
      hasWarnings = true;
    }
  }
});

if (!hasWarnings) {
  console.log('✅ All required environment variables are present and valid.\n');
}
