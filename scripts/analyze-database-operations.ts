/**
 * Database Operations Analysis Script
 * 
 * This script analyzes all database read/write operations in the codebase
 * and generates a comprehensive report comparing them against the actual schemas.
 */

import * as fs from 'fs';
import * as path from 'path';

interface DatabaseOperation {
  file: string;
  line: number;
  operation: 'read' | 'write' | 'delete' | 'update';
  collection: string;
  fields: string[];
  query?: {
    filters?: Array<{ field: string; operator: string; value: any }>;
    orderBy?: string;
    limit?: number;
  };
}

interface CollectionSchema {
  name: string;
  existsInFirestore: boolean;
  existsInSupabase: boolean;
  firestoreFields: Set<string>;
  supabaseFields: Set<string>;
  operations: DatabaseOperation[];
}

// Extract all table names from Supabase types
function extractSupabaseTables(typesContent: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const tableRegex = /(\w+):\s*\{[\s\S]*?Row:\s*\{([\s\S]*?)\}/g;
  let match;
  
  while ((match = tableRegex.exec(typesContent)) !== null) {
    const tableName = match[1];
    const rowContent = match[2];
    const fields = new Set<string>();
    
    // Extract field names from Row type
    const fieldRegex /(\w+):\s*[^,}]+/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(rowContent)) !== null) {
      fields.add(fieldMatch[1]);
    }
    
    tables.set(tableName, fields);
  }
  
  return tables;
}

// Extract Firestore collections from rules
function extractFirestoreCollections(rulesContent: string): Set<string> {
  const collections = new Set<string>();
  const matchRegex = /match\s+\/(\w+)\//g;
  let match;
  
  while ((match = matchRegex.exec(rulesContent)) !== null) {
    collections.add(match[1]);
  }
  
  return collections;
}

// Main analysis function
async function analyzeDatabaseOperations() {
  const projectRoot = path.resolve(__dirname, '..');
  const srcDir = path.join(projectRoot, 'src');
  const functionsDir = path.join(projectRoot, 'functions', 'src');
  
  // Read schema files
  const supabaseTypesPath = path.join(srcDir, 'integrations', 'supabase', 'types.ts');
  const firestoreRulesPath = path.join(projectRoot, 'firestore.rules');
  
  const supabaseTypes = fs.readFileSync(supabaseTypesPath, 'utf-8');
  const firestoreRules = fs.readFileSync(firestoreRulesPath, 'utf-8');
  
  // Extract schemas
  const supabaseTables = extractSupabaseTables(supabaseTypes);
  const firestoreCollections = extractFirestoreCollections(firestoreRules);
  
  console.log('Found Supabase tables:', Array.from(supabaseTables.keys()).length);
  console.log('Found Firestore collections:', firestoreCollections.size);
  
  // TODO: Parse source files to extract operations
  // This would require a more sophisticated AST parser
  
  return {
    supabaseTables,
    firestoreCollections,
  };
}

// Run analysis
analyzeDatabaseOperations().then(result => {
  console.log('\n=== Analysis Complete ===\n');
  console.log('Supabase Tables:', Array.from(result.supabaseTables.keys()));
  console.log('\nFirestore Collections:', Array.from(result.firestoreCollections));
}).catch(console.error);

