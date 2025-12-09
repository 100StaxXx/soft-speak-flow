/**
 * Storage Backup Script for Supabase Migration
 * 
 * Run with: npx ts-node scripts/backup-storage.ts
 * 
 * Prerequisites:
 * - npm install @supabase/supabase-js
 * - Set environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://opbfpbbqvuksuuvmtmssd.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

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

const BACKUP_DIR = './supabase-storage-backup';

async function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function listAllFiles(bucket: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' }
  });

  if (error) {
    console.error(`Error listing ${bucket}/${prefix}:`, error.message);
    return files;
  }

  for (const item of data || []) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    
    if (item.id === null) {
      // It's a folder, recurse
      const subFiles = await listAllFiles(bucket, itemPath);
      files.push(...subFiles);
    } else {
      files.push(itemPath);
    }
  }

  return files;
}

async function downloadFile(bucket: string, filePath: string) {
  const { data, error } = await supabase.storage.from(bucket).download(filePath);

  if (error) {
    console.error(`Error downloading ${bucket}/${filePath}:`, error.message);
    return null;
  }

  return data;
}

async function backupBucket(bucket: string) {
  console.log(`\n📦 Backing up bucket: ${bucket}`);
  
  const bucketDir = path.join(BACKUP_DIR, bucket);
  await ensureDir(bucketDir);

  const files = await listAllFiles(bucket);
  console.log(`   Found ${files.length} files`);

  let downloaded = 0;
  let failed = 0;

  for (const file of files) {
    const localPath = path.join(bucketDir, file);
    await ensureDir(path.dirname(localPath));

    const data = await downloadFile(bucket, file);
    
    if (data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      downloaded++;
      process.stdout.write(`\r   Downloaded: ${downloaded}/${files.length}`);
    } else {
      failed++;
    }
  }

  console.log(`\n   ✅ Completed: ${downloaded} downloaded, ${failed} failed`);
  return { bucket, total: files.length, downloaded, failed };
}

async function main() {
  console.log('🚀 Starting Supabase Storage Backup');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Backup directory: ${BACKUP_DIR}`);
  
  await ensureDir(BACKUP_DIR);

  const results: Array<{ bucket: string; total: number; downloaded: number; failed: number }> = [];

  for (const bucket of BUCKETS) {
    const result = await backupBucket(bucket);
    results.push(result);
  }

  console.log('\n\n📊 Backup Summary:');
  console.log('─'.repeat(50));
  
  let totalFiles = 0;
  let totalDownloaded = 0;
  let totalFailed = 0;

  for (const r of results) {
    console.log(`${r.bucket}: ${r.downloaded}/${r.total} files`);
    totalFiles += r.total;
    totalDownloaded += r.downloaded;
    totalFailed += r.failed;
  }

  console.log('─'.repeat(50));
  console.log(`TOTAL: ${totalDownloaded}/${totalFiles} files (${totalFailed} failed)`);
  console.log(`\n✅ Backup complete! Files saved to: ${BACKUP_DIR}`);
}

main().catch(console.error);
