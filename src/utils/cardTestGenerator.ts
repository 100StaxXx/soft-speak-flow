/**
 * Card Test Generator - Phase 2.5
 * 
 * This utility generates sample cards at different stages to validate formulas
 * and visually inspect stat ranges without needing to guess.
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

interface SampleCard {
  stage: number;
  rarity: string;
  stats: CardStats;
  energy_cost: number;
  bond_level: number;
  baseStatValue: number;
  avgAttribute: number;
}

/**
 * Generate stats based on stage and user attributes
 * This mirrors the logic in generate-evolution-card/index.ts
 */
function generateCardStats(stage: number, userAttributes: UserAttributes): SampleCard {
  // Determine rarity based on stage (21-stage system: 0-20)
  let rarity = 'Common';
  if (stage >= 19) rarity = 'Origin';       // Stage 19-20: Apex, Ultimate
  else if (stage >= 16) rarity = 'Primal';  // Stage 16-18: Regal, Eternal, Transcendent
  else if (stage >= 13) rarity = 'Celestial'; // Stage 13-15: Titan, Mythic, Prime
  else if (stage >= 10) rarity = 'Mythic';  // Stage 10-12: Champion, Ascended, Vanguard
  else if (stage >= 7) rarity = 'Legendary'; // Stage 7-9: Fledgling, Warrior, Guardian
  else if (stage >= 4) rarity = 'Epic';      // Stage 4-6: Juvenile, Apprentice, Scout
  else if (stage >= 1) rarity = 'Rare';      // Stage 1-3: Hatchling, Sproutling, Cub

  // Generate stats based on stage and average attribute (balanced)
  const baseStatValue = 20 + (stage * 8);
  const avgAttribute = (
    (userAttributes?.mind || 0) + 
    (userAttributes?.body || 0) + 
    (userAttributes?.soul || 0)
  ) / 3;
  
  const stats: CardStats = {
    mind: Math.floor(baseStatValue + avgAttribute * 0.15),
    body: Math.floor(baseStatValue + avgAttribute * 0.15),
    soul: Math.floor(baseStatValue + avgAttribute * 0.15),
  };

  // Assign energy cost based on stage (0-9: 1, 10-14: 2, 15-20: 3)
  const energyCost = stage <= 9 ? 1 : stage <= 14 ? 2 : 3;

  // Calculate bond level based on user attributes
  const totalAttributes = (userAttributes?.mind || 0) + 
                        (userAttributes?.body || 0) + 
                        (userAttributes?.soul || 0);
  const bondLevel = Math.min(100, Math.floor(10 + (totalAttributes / 3) + (stage * 2)));

  return {
    stage,
    rarity,
    stats,
    energy_cost: energyCost,
    bond_level: bondLevel,
    baseStatValue,
    avgAttribute,
  };
}

/**
 * Generate sample cards for testing
 * @param stages - Array of stages to generate cards for (default: [0, 5, 10, 15, 20])
 * @param userAttributes - Optional user attributes (default: balanced mid-range)
 */
export function generateSampleCards(
  stages: number[] = [0, 5, 10, 15, 20],
  userAttributes: UserAttributes = { mind: 50, body: 50, soul: 50 }
): SampleCard[] {
  return stages.map(stage => generateCardStats(stage, userAttributes));
}

/**
 * Format cards as a readable table string for console output
 */
export function formatCardsAsTable(cards: SampleCard[]): string {
  const header = `
╔═══════╦════════════╦══════════════════════════════╦═════════════╦════════════╦══════════════════════════════╗
║ Stage ║   Rarity   ║          Stats (M/B/S)       ║ Energy Cost ║ Bond Level ║         Formulas             ║
╠═══════╬════════════╬══════════════════════════════╬═════════════╬════════════╬══════════════════════════════╣`;

  const rows = cards.map(card => {
    const stage = card.stage.toString().padEnd(5);
    const rarity = card.rarity.padEnd(10);
    const stats = `${card.stats.mind}/${card.stats.body}/${card.stats.soul}`.padEnd(28);
    const energy = card.energy_cost.toString().padEnd(11);
    const bond = card.bond_level.toString().padEnd(10);
    const formulas = `base=${card.baseStatValue}, avg=${card.avgAttribute.toFixed(1)}`.padEnd(28);
    
    return `║ ${stage} ║ ${rarity} ║ ${stats} ║ ${energy} ║ ${bond} ║ ${formulas} ║`;
  }).join('\n');

  const footer = `╚═══════╩════════════╩══════════════════════════════╩═════════════╩════════════╩══════════════════════════════╝`;

  return `${header}\n${rows}\n${footer}`;
}

/**
 * Print sample cards to console
 */
export function printSampleCards(
  stages: number[] = [0, 5, 10, 15, 20],
  userAttributes?: UserAttributes
): void {
  console.log('\n🎴 EVOLUTION CARD TEST GENERATOR - Phase 2.5\n');
  
  if (userAttributes) {
    console.log(`User Attributes: Mind=${userAttributes.mind}, Body=${userAttributes.body}, Soul=${userAttributes.soul}\n`);
  } else {
    console.log('User Attributes: Default (Mind=50, Body=50, Soul=50)\n');
  }

  const cards = generateSampleCards(stages, userAttributes);
  console.log(formatCardsAsTable(cards));
  
  console.log('\n📊 ANALYSIS:\n');
  console.log(`• Stat Range: ${cards[0].stats.mind} (Stage 0) → ${cards[cards.length - 1].stats.mind} (Stage ${cards[cards.length - 1].stage})`);
  console.log(`• Bond Level Range: ${cards[0].bond_level} → ${cards[cards.length - 1].bond_level}`);
  console.log(`• Energy Cost Tiers: 1 (stages 0-9), 2 (stages 10-14), 3 (stages 15-20)`);
  console.log(`• Base Stat Formula: 20 + (stage × 8)`);
  console.log(`• Stat Bonus Formula: avgAttribute × 0.15`);
  console.log(`• Bond Formula: min(100, floor(10 + (totalAttributes / 3) + (stage × 2)))\n`);
}

/**
 * Generate multiple scenarios for comparison
 */
export function generateScenarios(): void {
  console.log('\n🎴 EVOLUTION CARD TEST GENERATOR - Multiple Scenarios\n');
  
  const scenarios = [
    { name: 'Balanced User (50/50/50)', attrs: { mind: 50, body: 50, soul: 50 } },
    { name: 'High Stats (80/80/80)', attrs: { mind: 80, body: 80, soul: 80 } },
    { name: 'Low Stats (20/20/20)', attrs: { mind: 20, body: 20, soul: 20 } },
    { name: 'Mind-Focused (90/30/30)', attrs: { mind: 90, body: 30, soul: 30 } },
    { name: 'Body-Focused (30/90/30)', attrs: { mind: 30, body: 90, soul: 30 } },
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`\n${index + 1}. ${scenario.name}`);
    console.log('─'.repeat(80));
    const cards = generateSampleCards([0, 5, 10, 15, 20], scenario.attrs);
    console.log(formatCardsAsTable(cards));
  });
}

// Export for use in other files
export { UserAttributes, CardStats, SampleCard };
