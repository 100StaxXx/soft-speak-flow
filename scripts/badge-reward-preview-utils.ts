import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { BadgeCategory, BadgeTier } from "@/data/badgeCatalog";
import type { RewardRarity, RewardType } from "@/types/epicRewards";

export interface BadgeManifestItem {
  id: string;
  title: string;
  tier: BadgeTier;
  category: BadgeCategory;
  icon: string;
}

export interface RewardManifestItem {
  id: string;
  name: string;
  rarity: RewardRarity;
  reward_type: RewardType;
  icon: string;
  css_effect_keys: string[];
}

export interface EpicRewardRow {
  id: string;
  name: string;
  rarity: RewardRarity;
  reward_type: RewardType;
  css_effect: Record<string, unknown> | null;
  image_url: string | null;
}

const PROJECT_ROOT = process.cwd();
const ENV_FILES = [".env", ".env.local"];

export const BADGE_ASSET_DIR = path.join(PROJECT_ROOT, "src/assets/badges");
export const REWARD_ASSET_DIR = path.join(PROJECT_ROOT, "src/assets/rewards");
export const MANIFEST_DIR = path.join(PROJECT_ROOT, "output/badge-reward-previews/manifests");
export const LOG_DIR = path.join(PROJECT_ROOT, "output/badge-reward-previews/logs");

function parseEnvLine(rawLine: string): [string, string] | null {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex < 1) return null;
  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

export function loadEnvFromFiles(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const fileName of ENV_FILES) {
    const filePath = path.join(PROJECT_ROOT, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      env[parsed[0]] = parsed[1];
    }
  }

  return {
    ...env,
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .map(([key, value]) => [key, value]),
    ),
  };
}

export function requireEnv(env: Record<string, string>, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getRewardIcon(reward: EpicRewardRow): string {
  const cssIcon = reward.css_effect && typeof reward.css_effect.icon === "string"
    ? reward.css_effect.icon
    : null;
  if (cssIcon) return cssIcon;

  switch (reward.reward_type) {
    case "background":
      return "🌌";
    case "frame":
      return "🖼️";
    case "effect":
      return "✨";
    case "artifact":
      return "💎";
    default:
      return "⭐";
  }
}

export async function fetchEpicRewards(env: Record<string, string>, opts?: { useServiceRole?: boolean }): Promise<EpicRewardRow[]> {
  const supabaseUrl = requireEnv(env, "VITE_SUPABASE_URL");
  const key = opts?.useServiceRole
    ? requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY")
    : env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error("Missing Supabase anon/publishable key for epic reward queries.");
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false },
    global: { headers: { "x-client-info": "badge-reward-preview-scripts" } },
  });

  const { data, error } = await supabase
    .from("epic_rewards")
    .select("id,name,rarity,reward_type,css_effect,image_url")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch epic rewards: ${error.message}`);
  }

  return (data ?? []).map((reward) => ({
    id: reward.id,
    name: reward.name,
    rarity: reward.rarity,
    reward_type: reward.reward_type,
    css_effect: (reward.css_effect as Record<string, unknown> | null) ?? null,
    image_url: reward.image_url,
  })) as EpicRewardRow[];
}

export function toRewardManifestRows(rewards: EpicRewardRow[]): RewardManifestItem[] {
  return rewards.map((reward) => ({
    id: reward.id,
    name: reward.name,
    rarity: reward.rarity,
    reward_type: reward.reward_type,
    icon: getRewardIcon(reward),
    css_effect_keys: reward.css_effect ? Object.keys(reward.css_effect).sort() : [],
  }));
}

