const fs = require('fs');
const path = require('path');

const auditPath = path.resolve(__dirname, '..', 'docs', 'database_audit.md');

console.log('--- Database Audit Report (docs/database_audit.md) ---\n');

if (!fs.existsSync(auditPath)) {
  console.error('Audit report not found at', auditPath);
  process.exit(1);
}

const content = fs.readFileSync(auditPath, 'utf8');
console.log(content);
