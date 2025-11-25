/**
 * Card Snapshot & Test Generator
 * 
 * Quick helper to generate and visualize sample cards at different evolution stages.
 * Use this to sanity-check stat ranges and formulas.
 * 
 * Usage:
 *   npx tsx card-test-generator.ts
 */

interface UserAttributes {
  mind: number;
  body: number;
  soul: number;
}

interface CardStats {
  mind: number;
  body: number;
  soul: number;
}

interface Card {
  stage: number;
  cardId: string;
  rarity: string;
  stats: CardStats;
  energyCost: number;
  bondLevel: number;
  formula: string;
}

// Test with different attribute levels
const testProfiles = [
  { name: "Beginner", attrs: { mind: 10, body: 10, soul: 10 } },
  { name: "Average", attrs: { mind: 50, body: 50, soul: 50 } },
  { name: "Advanced", attrs: { mind: 80, body: 80, soul: 80 } },
];

// Stages to test: 0, 5, 10, 15, 20
const testStages = [0, 5, 10, 15, 20];

function generateCardStats(stage: number, userAttributes: UserAttributes): CardStats {
  // CURRENT FORMULA from generate-evolution-card/index.ts (lines 66-77)
  const baseStatValue = 20 + (stage * 8);
  const avgAttribute = (userAttributes.mind + userAttributes.body + userAttributes.soul) / 3;
  
  return {
    mind: Math.floor(baseStatValue + avgAttribute * 0.15),
    body: Math.floor(baseStatValue + avgAttribute * 0.15),
    soul: Math.floor(baseStatValue + avgAttribute * 0.15),
  };
}

function getEnergyCost_Current(stage: number): number {
  // CURRENT FORMULA from generate-evolution-card/index.ts (line 80)
  return stage <= 9 ? 1 : stage <= 14 ? 2 : 3;
}

function getEnergyCost_Frontend(stage: number): number {
  // FRONTEND FORMULA from BattleCardSelector.tsx (lines 22-28)
  const costs: Record<number, number> = { 0: 1, 5: 2, 10: 3, 15: 4, 20: 5 };
  return costs[stage] || 1;
}

function getRarity(stage: number): string {
  // CURRENT FORMULA from generate-evolution-card/index.ts (lines 56-63)
  if (stage >= 19) return 'Origin';       // Stage 19-20
  if (stage >= 16) return 'Primal';       // Stage 16-18
  if (stage >= 13) return 'Celestial';    // Stage 13-15
  if (stage >= 10) return 'Mythic';       // Stage 10-12
  if (stage >= 7) return 'Legendary';     // Stage 7-9
  if (stage >= 4) return 'Epic';          // Stage 4-6
  if (stage >= 1) return 'Rare';          // Stage 1-3
  return 'Common';                        // Stage 0
}

function getBondLevel(stage: number, userAttributes: UserAttributes): number {
  // CURRENT FORMULA from generate-evolution-card/index.ts (line 223)
  const totalAttributes = userAttributes.mind + userAttributes.body + userAttributes.soul;
  return Math.min(100, Math.floor(10 + (totalAttributes / 3) + (stage * 2)));
}

function generateCardSnapshot(stage: number, userAttributes: UserAttributes, profileName: string): Card {
  const stats = generateCardStats(stage, userAttributes);
  const energyCost = getEnergyCost_Current(stage);
  const bondLevel = getBondLevel(stage, userAttributes);
  const rarity = getRarity(stage);
  
  return {
    stage,
    cardId: `TEST-S${stage}-${profileName}`,
    rarity,
    stats,
    energyCost,
    bondLevel,
    formula: `base(${20 + stage * 8}) + avg_attr(${((userAttributes.mind + userAttributes.body + userAttributes.soul) / 3).toFixed(1)}) * 0.15`,
  };
}

function printCard(card: Card): void {
  console.log(`\n┌${'─'.repeat(60)}┐`);
  console.log(`│ ${card.cardId.padEnd(30)} Stage ${card.stage.toString().padStart(2)} │`);
  console.log(`├${'─'.repeat(60)}┤`);
  console.log(`│ Rarity: ${card.rarity.padEnd(20)} Energy: ⚡${card.energyCost}         │`);
  console.log(`│ Bond Level: ${card.bondLevel.toString().padStart(3)}                                      │`);
  console.log(`├${'─'.repeat(60)}┤`);
  console.log(`│ Stats (Mind/Body/Soul):                                    │`);
  console.log(`│   🧠 Mind: ${card.stats.mind.toString().padStart(3)}                                         │`);
  console.log(`│   💪 Body: ${card.stats.body.toString().padStart(3)}                                         │`);
  console.log(`│   🔥 Soul: ${card.stats.soul.toString().padStart(3)}                                         │`);
  console.log(`├${'─'.repeat(60)}┤`);
  console.log(`│ Formula: ${card.formula.padEnd(48)} │`);
  console.log(`└${'─'.repeat(60)}┘`);
}

function compareEnergyCosts(): void {
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              ENERGY COST COMPARISON (MISMATCH!)              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('Stage │ Backend (current) │ Frontend (expected) │ MATCH?');
  console.log('──────┼───────────────────┼────────────────────┼────────');
  
  for (const stage of testStages) {
    const backend = getEnergyCost_Current(stage);
    const frontend = getEnergyCost_Frontend(stage);
    const match = backend === frontend ? '✓' : '✗ BUG!';
    console.log(`  ${stage.toString().padStart(2)}  │        ${backend}          │         ${frontend}          │ ${match}`);
  }
}

function main(): void {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           CARD SNAPSHOT & TEST GENERATOR                     ║');
  console.log('║           5 Stages × 3 Attribute Levels                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  for (const profile of testProfiles) {
    console.log(`\n\n${'═'.repeat(64)}`);
    console.log(`  ${profile.name.toUpperCase()} PROFILE`);
    console.log(`  Attributes: Mind=${profile.attrs.mind}, Body=${profile.attrs.body}, Soul=${profile.attrs.soul}`);
    console.log(`${'═'.repeat(64)}`);

    for (const stage of testStages) {
      const card = generateCardSnapshot(stage, profile.attrs, profile.name);
      printCard(card);
    }
  }

  // Show energy cost mismatch
  compareEnergyCosts();

  // Summary statistics
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    STAT RANGE SUMMARY                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const minAttrs = { mind: 0, body: 0, soul: 0 };
  const maxAttrs = { mind: 100, body: 100, soul: 100 };

  console.log('Stat Ranges (Mind/Body/Soul are identical):');
  console.log('────────────────────────────────────────────\n');

  for (const stage of testStages) {
    const minStats = generateCardStats(stage, minAttrs);
    const maxStats = generateCardStats(stage, maxAttrs);
    console.log(`Stage ${stage.toString().padStart(2)}: ${minStats.mind.toString().padStart(3)} - ${maxStats.mind.toString().padStart(3)} (all three stats)`);
  }

  console.log('\n\nBond Level Ranges:');
  console.log('──────────────────\n');

  for (const stage of testStages) {
    const minBond = getBondLevel(stage, minAttrs);
    const maxBond = getBondLevel(stage, maxAttrs);
    console.log(`Stage ${stage.toString().padStart(2)}: ${minBond.toString().padStart(3)} - ${maxBond.toString().padStart(3)}`);
  }
}

main();
