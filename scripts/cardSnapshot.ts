#!/usr/bin/env tsx
import {
  AttributeInput,
  calculateBondLevel,
  calculateEnergyCost,
  calculateStats,
} from "../supabase/functions/_shared/cardMath.ts";

const stages = [0, 5, 10, 15, 20];

const attributeProfiles: { label: string; attributes: AttributeInput }[] = [
  { label: "Baseline (30/30/30)", attributes: { mind: 30, body: 30, soul: 30 } },
  { label: "Mind Scholar (70/30/30)", attributes: { mind: 70, body: 30, soul: 30 } },
  { label: "Body Brawler (30/70/30)", attributes: { mind: 30, body: 70, soul: 30 } },
  { label: "Soul Sage (30/30/70)", attributes: { mind: 30, body: 30, soul: 70 } },
  { label: "Ascended (85/85/85)", attributes: { mind: 85, body: 85, soul: 85 } },
];

const formatRow = (label: string, stage: number, attributes: AttributeInput) => {
  const stats = calculateStats(stage, attributes);
  const bondLevel = calculateBondLevel(stage, attributes);
  const energyCost = calculateEnergyCost(stage);

  return {
    Profile: label,
    Mind: stats.mind,
    Body: stats.body,
    Soul: stats.soul,
    "Energy Cost": energyCost,
    "Bond Level": bondLevel,
  };
};

const run = () => {
  console.log("=== Card Snapshot Generator ===");
  console.log("Shows five sample attribute spreads per requested stage.\n");

  stages.forEach((stage) => {
    console.log(`Stage ${stage}`);
    const rows = attributeProfiles.map(({ label, attributes }) =>
      formatRow(label, stage, attributes)
    );
    console.table(rows);
  });
};

run();
