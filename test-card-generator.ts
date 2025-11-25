/**
 * Card Stats Snapshot Generator
 * 
 * This tool generates sample cards for stages 0, 5, 10, 15, 20
 * to visualize and validate card generation formulas.
 * 
 * Run with: deno run --allow-net --allow-env test-card-generator.ts
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

interface GeneratedCard {
  stage: number;
  stageName: string;
  rarity: string;
  stats: CardStats;
  energyCost: number;
  bondLevel: number;
  userAttributes: UserAttributes;
}

// Stage names for reference
const STAGE_NAMES: Record<number, string> = {
  0: "Egg",
  5: "Apprentice",
  10: "Champion",
  15: "Prime",
  20: "Ultimate",
};

/**
 * Generate card stats based on current formula in generate-evolution-card/index.ts
 */
function generateCardStats(stage: number, userAttributes: UserAttributes): GeneratedCard {
  // Rarity calculation (from generate-evolution-card line 56-63)
  let rarity = 'Common';
  if (stage >= 19) rarity = 'Origin';       // Stage 19-20
  else if (stage >= 16) rarity = 'Primal';  // Stage 16-18
  else if (stage >= 13) rarity = 'Celestial'; // Stage 13-15
  else if (stage >= 10) rarity = 'Mythic';  // Stage 10-12
  else if (stage >= 7) rarity = 'Legendary'; // Stage 7-9
  else if (stage >= 4) rarity = 'Epic';      // Stage 4-6
  else if (stage >= 1) rarity = 'Rare';      // Stage 1-3

  // Stats calculation (from generate-evolution-card line 66-77)
  const baseStatValue = 20 + (stage * 8);
  const avgAttribute = (userAttributes.mind + userAttributes.body + userAttributes.soul) / 3;
  
  const stats = {
    mind: Math.floor(baseStatValue + avgAttribute * 0.15),
    body: Math.floor(baseStatValue + avgAttribute * 0.15),
    soul: Math.floor(baseStatValue + avgAttribute * 0.15),
  };

  // Energy cost (from generate-evolution-card line 80)
  const energyCost = stage <= 9 ? 1 : stage <= 14 ? 2 : 3;

  // Bond level (from generate-evolution-card line 220-223)
  const totalAttributes = userAttributes.mind + userAttributes.body + userAttributes.soul;
  const bondLevel = Math.min(100, Math.floor(10 + (totalAttributes / 3) + (stage * 2)));

  return {
    stage,
    stageName: STAGE_NAMES[stage] || `Stage ${stage}`,
    rarity,
    stats,
    energyCost,
    bondLevel,
    userAttributes,
  };
}

/**
 * Generate 5 sample cards per stage with varying user attributes
 */
function generateSamples(stage: number): GeneratedCard[] {
  const samples: GeneratedCard[] = [];
  
  // Sample 1: Low attributes (beginner user)
  samples.push(generateCardStats(stage, { mind: 10, body: 10, soul: 10 }));
  
  // Sample 2: Low-medium attributes
  samples.push(generateCardStats(stage, { mind: 30, body: 30, soul: 30 }));
  
  // Sample 3: Medium attributes (balanced user)
  samples.push(generateCardStats(stage, { mind: 50, body: 50, soul: 50 }));
  
  // Sample 4: High attributes (active user)
  samples.push(generateCardStats(stage, { mind: 75, body: 75, soul: 75 }));
  
  // Sample 5: Max attributes (dedicated user)
  samples.push(generateCardStats(stage, { mind: 100, body: 100, soul: 100 }));
  
  return samples;
}

/**
 * Print formatted table of card stats
 */
function printCardTable(cards: GeneratedCard[]) {
  console.log('\n' + '='.repeat(120));
  console.log(`STAGE ${cards[0].stage}: ${cards[0].stageName} (${cards[0].rarity})`);
  console.log('='.repeat(120));
  console.log(
    '| User Attrs (M/B/S) | Card Mind | Card Body | Card Soul | Energy Cost | Bond Level | Total Power |'
  );
  console.log('|' + '-'.repeat(118) + '|');
  
  cards.forEach((card) => {
    const totalPower = card.stats.mind + card.stats.body + card.stats.soul;
    const userStr = `${card.userAttributes.mind}/${card.userAttributes.body}/${card.userAttributes.soul}`.padEnd(19);
    const mindStr = String(card.stats.mind).padStart(9);
    const bodyStr = String(card.stats.body).padStart(9);
    const soulStr = String(card.stats.soul).padStart(9);
    const energyStr = String(card.energyCost).padStart(11);
    const bondStr = String(card.bondLevel).padStart(10);
    const powerStr = String(totalPower).padStart(11);
    
    console.log(`| ${userStr} | ${mindStr} | ${bodyStr} | ${soulStr} | ${energyStr} | ${bondStr} | ${powerStr} |`);
  });
  console.log('='.repeat(120) + '\n');
}

/**
 * Main execution
 */
function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                     CARD STATS SNAPSHOT GENERATOR                                            ║');
  console.log('║                                   Testing Card Generation Formulas                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  
  const stages = [0, 5, 10, 15, 20];
  
  stages.forEach((stage) => {
    const samples = generateSamples(stage);
    printCardTable(samples);
  });
  
  // Print analysis
  console.log('\n' + '═'.repeat(120));
  console.log('ANALYSIS & OBSERVATIONS');
  console.log('═'.repeat(120));
  
  console.log('\n📊 STAT PROGRESSION:');
  console.log('  • Base stat value formula: 20 + (stage × 8)');
  console.log('  • User attribute influence: avgAttribute × 0.15');
  console.log('  • Stats are identical (mind = body = soul) - no specialization');
  
  console.log('\n⚡ ENERGY COST:');
  console.log('  • Stages 0-9:   1 energy');
  console.log('  • Stages 10-14: 2 energy');
  console.log('  • Stages 15-20: 3 energy');
  
  console.log('\n🤝 BOND LEVEL FORMULA:');
  console.log('  • Base: 10');
  console.log('  • User contribution: totalAttributes / 3');
  console.log('  • Stage contribution: stage × 2');
  console.log('  • Max: 100 (capped)');
  
  console.log('\n💎 RARITY TIERS:');
  console.log('  • Common:    Stage 0');
  console.log('  • Rare:      Stages 1-3');
  console.log('  • Epic:      Stages 4-6');
  console.log('  • Legendary: Stages 7-9');
  console.log('  • Mythic:    Stages 10-12');
  console.log('  • Celestial: Stages 13-15');
  console.log('  • Primal:    Stages 16-18');
  console.log('  • Origin:    Stages 19-20');
  console.log('\n' + '═'.repeat(120) + '\n');
}

// Run the generator
main();
