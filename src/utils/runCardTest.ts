/**
 * Standalone Card Test Runner
 * 
 * Quick utility to test card generation formulas.
 * Run this in your browser console or Node.js environment.
 * 
 * Usage in browser console (after importing):
 *   import { runQuickTest, runFullTest } from './utils/runCardTest';
 *   runQuickTest();
 *   runFullTest();
 * 
 * Usage with Node/Deno:
 *   npx tsx src/utils/runCardTest.ts
 */

import { 
  generateSampleCards, 
  printSampleCards, 
  generateScenarios,
  type UserAttributes 
} from './cardTestGenerator';

/**
 * Quick test with default attributes
 */
export function runQuickTest(): void {
  console.log('\n🎴 QUICK CARD TEST\n');
  printSampleCards([0, 5, 10, 15, 20]);
}

/**
 * Full test with all scenarios
 */
export function runFullTest(): void {
  console.log('\n🎴 FULL CARD TEST - ALL SCENARIOS\n');
  generateScenarios();
}

/**
 * Custom test with specific attributes
 */
export function runCustomTest(attributes: UserAttributes, stages: number[] = [0, 5, 10, 15, 20]): void {
  console.log('\n🎴 CUSTOM CARD TEST\n');
  printSampleCards(stages, attributes);
}

/**
 * Test all stage boundaries
 */
export function runBoundaryTest(): void {
  console.log('\n🎴 STAGE BOUNDARY TEST\n');
  
  const boundaryStages = [
    0,   // Common
    1,   // First Rare
    4,   // First Epic
    7,   // First Legendary
    9,   // Last 1-energy
    10,  // First Mythic & 2-energy
    13,  // First Celestial
    14,  // Last 2-energy
    15,  // First 3-energy
    16,  // First Primal
    19,  // First Origin
    20,  // Ultimate
  ];
  
  printSampleCards(boundaryStages);
}

/**
 * Generate raw data for analysis
 */
export function generateTestData(): any[] {
  const cards = generateSampleCards([0, 5, 10, 15, 20]);
  console.log('\n🎴 RAW TEST DATA\n');
  console.log(JSON.stringify(cards, null, 2));
  return cards;
}

// If running directly as a script
if (import.meta.url === `file://${process.argv[1]}` || typeof Deno !== 'undefined') {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   EVOLUTION CARD FORMULA TEST SUITE                           ║');
  console.log('║                           Phase 2.5 - Validation                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  
  runQuickTest();
  
  console.log('\n\n' + '═'.repeat(80));
  console.log('                              BOUNDARY TEST');
  console.log('═'.repeat(80));
  runBoundaryTest();
  
  console.log('\n\n' + '═'.repeat(80));
  console.log('                         COMPREHENSIVE SCENARIOS');
  console.log('═'.repeat(80));
  runFullTest();
  
  console.log('\n✅ All tests complete!\n');
  console.log('📄 See CARD_SYSTEM_ANALYSIS.md for detailed bug report and recommendations.\n');
}
