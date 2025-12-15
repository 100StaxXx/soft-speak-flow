#!/usr/bin/env node

import { execSync } from 'child_process';
import { platform } from 'os';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const workspacePath = resolve(projectRoot, 'ios/App/App.xcworkspace');

if (platform() === 'darwin') {
  try {
    console.log('Opening Xcode workspace...');
    execSync(`open "${workspacePath}"`, { stdio: 'inherit' });
    console.log('\n✅ Xcode opened!');
    console.log('📱 Next steps:');
    console.log('   1. Select "Any iOS Device" or a connected device');
    console.log('   2. Product → Archive');
    console.log('   3. In Organizer, click "Distribute App"');
    console.log('   4. Choose "App Store Connect" → "Upload"');
    console.log('   5. Follow the prompts to upload to TestFlight');
  } catch (error) {
    console.error('❌ Failed to open Xcode:', error.message);
    process.exit(1);
  }
} else {
  console.log('⚠️  Xcode can only be opened on macOS');
  console.log('✅ Build and sync completed!');
  console.log('📱 On macOS, run: npm run ios:testflight');
  console.log('   Or manually open: ios/App/App.xcworkspace');
}
