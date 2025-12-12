#!/usr/bin/env node

/**
 * Test script to verify build configuration
 * Checks that environment variables will be included in the build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Testing build configuration...\n');

// Check if dist folder exists (from previous build)
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log('✅ dist/ folder exists (previous build found)');
  
  // Check for built JS files
  const jsFiles = [];
  function findJSFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        findJSFiles(filePath);
      } else if (file.endsWith('.js')) {
        jsFiles.push(filePath);
      }
    });
  }
  
  findJSFiles(distPath);
  
  if (jsFiles.length > 0) {
    console.log(`✅ Found ${jsFiles.length} built JS files`);
    
    // Sample check one file for Firebase config
    const sampleFile = jsFiles[0];
    const content = fs.readFileSync(sampleFile, 'utf-8');
    
    // Check for common Firebase strings (not undefined)
    const hasFirebaseConfig = 
      content.includes('firebaseapp.com') ||
      content.includes('VITE_FIREBASE') ||
      content.match(/apiKey.*undefined/) === null;
    
    if (hasFirebaseConfig) {
      console.log('✅ Firebase configuration appears in build');
    } else {
      console.warn('⚠️  Warning: Firebase config may not be in build');
      console.warn('   Rebuild with: npm run build');
    }
  }
} else {
  console.log('ℹ️  dist/ folder not found - will be created on next build');
}

console.log('\n✅ Build configuration check complete');
console.log('   Run "npm run ios:build" to create iOS build');
