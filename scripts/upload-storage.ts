/**
 * Storage Upload Script for Supabase Migration
 * 
 * Run with: npx ts-node scripts/upload-storage.ts
 * 
 * Prerequisites:
 * - npm install @supabase/supabase-js
 * - Set environment variables: NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY
 * - Run backup-storage.ts first to create ./supabase-storage-backup
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || '';
const NEW_SERVICE_ROLE_KEY = process.env.NEW_SERVICE_ROLE_KEY || '';

if (!NEW_SUPABASE_URL || !NEW_SERVICE_ROLE_KEY) {
  console.error('ERROR: NEW_SUPABASE_URL and NEW_SERVICE_ROLE_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const BACKUP_DIR = './supabase-storage-backup';

const BUCKETS = [
  'pep-talk-audio',
  'audio-pep-talks',
  'video-pep-talks',
  'quotes-json',
  'mentors-avatars',
  'voice-samples',
  'playlists-assets',
  'hero-media',
  'mentor-audio',
  'evolution-cards'
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function uploadBucket(bucket: string) {
  const bucketDir = path.join(BACKUP_DIR, bucket);
  
  if (!fs.existsSync(bucketDir)) {
    console.log(`⚠️  Skipping ${bucket} - backup directory not found`);
    return { bucket, total: 0, uploaded: 0, failed: 0 };
  }

  console.log(`\n📤 Uploading to bucket: ${bucket}`);

  const allFiles = getAllFiles(bucketDir);
  console.log(`   Found ${allFiles.length} files to upload`);

  let uploaded = 0;
  let failed = 0;

  for (const localPath of allFiles) {
    const relativePath = path.relative(bucketDir, localPath);
    const storagePath = relativePath.replace(/\\/g, '/'); // Windows compatibility
    
    const fileBuffer = fs.readFileSync(localPath);
    const mimeType = getMimeType(localPath);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error(`\n   ❌ Failed: ${storagePath} - ${error.message}`);
      failed++;
    } else {
      uploaded++;
      process.stdout.write(`\r   Uploaded: ${uploaded}/${allFiles.length}`);
    }
  }

  console.log(`\n   ✅ Completed: ${uploaded} uploaded, ${failed} failed`);
  return { bucket, total: allFiles.length, uploaded, failed };
}

async function main() {
  console.log('🚀 Starting Supabase Storage Upload');
  console.log(`   Target URL: ${NEW_SUPABASE_URL}`);
  console.log(`   Backup directory: ${BACKUP_DIR}`);

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`\nERROR: Backup directory not found: ${BACKUP_DIR}`);
    console.error('Run backup-storage.ts first to create backups.');
    process.exit(1);
  }

  const results: Array<{ bucket: string; total: number; uploaded: number; failed: number }> = [];

  for (const bucket of BUCKETS) {
    const result = await uploadBucket(bucket);
    results.push(result);
  }

  console.log('\n\n📊 Upload Summary:');
  console.log('─'.repeat(50));
  
  let totalFiles = 0;
  let totalUploaded = 0;
  let totalFailed = 0;

  for (const r of results) {
    if (r.total > 0) {
      console.log(`${r.bucket}: ${r.uploaded}/${r.total} files`);
    }
    totalFiles += r.total;
    totalUploaded += r.uploaded;
    totalFailed += r.failed;
  }

  console.log('─'.repeat(50));
  console.log(`TOTAL: ${totalUploaded}/${totalFiles} files (${totalFailed} failed)`);
  console.log(`\n✅ Upload complete!`);
}

main().catch(console.error);
