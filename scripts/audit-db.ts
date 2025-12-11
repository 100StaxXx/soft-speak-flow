#!/usr/bin/env tsx
import { createReadStream } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const auditFilePath = join(__dirname, '..', 'docs', 'database_audit.md');

const stream = createReadStream(auditFilePath, { encoding: 'utf8' });

stream.on('data', (chunk) => {
  process.stdout.write(chunk);
});

stream.on('error', (error) => {
  console.error(`Error reading database audit file: ${error.message}`);
  console.error(`Expected file at: ${auditFilePath}`);
  process.exit(1);
});

stream.on('end', () => {
  process.exit(0);
});

