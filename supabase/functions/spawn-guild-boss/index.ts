import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Boss name templates by tier
const BOSS_NAMES = {
  normal: [
    { name: "The Procrastination Phantom", title: "Devourer of Deadlines" },
    { name: "Sloth Specter", title: "The Comfort Zone Guardian" },
    { name: "Doubt Demon", title: "Whisper of Failure" },
    { name: "Distraction Drake", title: "Scatterer of Focus" },
    { name: "Fear Fiend", title: "The Progress Blocker" },
  ],
  elite: [
    { name: "Apathy Archon", title: "Lord of Lost Motivation" },
    { name: "Chaos Chimera", title: "Destroyer of Routines" },
    { name: "Perfectionism Phantom", title: "The Never-Enough Beast" },
    { name: "Burnout Behemoth", title: "Consumer of Will" },
    { name: "Anxiety Abomination", title: "The Endless Spiral" },
  ],
  legendary: [
    { name: "The Shadow Self", title: "Mirror of Your Fears" },
    { name: "Entropy Emperor", title: "The Final Excuse" },
    { name: "Void Sovereign", title: "Eraser of Dreams" },
    { name: "Despair Dragon", title: "The Hopelessness Incarnate" },
    { name: "Oblivion Oracle", title: "Seer of Abandonment" },
  ],
};

const BOSS_LORE = [
  "Born from the collective hesitation of a thousand abandoned goals...",
  "It feeds on broken promises and forgotten resolutions...",
  "This beast grows stronger with every 'I'll do it tomorrow'...",
  "Legends say it can only be defeated by unwavering consistency...",
  "Its presence makes even the simplest task feel insurmountable...",
];

// HP scaling by tier and member count
const getHpForTier = (tier: string, memberCount: number): number => {
  const baseHp = {
    normal: 500,
    elite: 1500,
    legendary: 5000,
  };
  
  const base = baseHp[tier as keyof typeof baseHp] || 500;
  // Scale HP with member count (min 2 members worth, max 20 members worth)
  const scaledMembers = Math.max(2, Math.min(memberCount, 20));
  return Math.round(base * (1 + (scaledMembers - 2) * 0.25));
};

// XP reward by tier
const getXpForTier = (tier: string): number => {
  const xpRewards = {
    normal: 250,
    elite: 750,
    legendary: 2000,
  };
  return xpRewards[tier as keyof typeof xpRewards] || 250;
};

// Duration by tier (in hours)
const getDurationForTier = (tier: string): number => {
  const durations = {
    normal: 24,
    elite: 48,
    legendary: 72,
  };
  return durations[tier as keyof typeof durations] || 24;
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { epicId, communityId, tier = "normal", forceSpawn = false } = await req.json();

    if (!epicId && !communityId) {
      return new Response(
        JSON.stringify({ error: "Either epicId or communityId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[spawn-guild-boss] Spawning boss for epic=${epicId}, community=${communityId}, tier=${tier}`);

    // Check for existing active boss
    if (!forceSpawn) {
      let existingQuery = supabase
        .from("guild_boss_encounters")
        .select("id")
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString());

      if (epicId) {
        existingQuery = existingQuery.eq("epic_id", epicId);
      } else {
        existingQuery = existingQuery.eq("community_id", communityId);
      }

      const { data: existing } = await existingQuery.limit(1);

      if (existing && existing.length > 0) {
        console.log(`[spawn-guild-boss] Active boss already exists: ${existing[0].id}`);
        return new Response(
          JSON.stringify({ error: "Active boss already exists", existingBossId: existing[0].id }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get member count for HP scaling
    let memberCount = 2;
    if (epicId) {
      const { count } = await supabase
        .from("epic_members")
        .select("*", { count: "exact", head: true })
        .eq("epic_id", epicId);
      memberCount = count || 2;
    } else if (communityId) {
      const { count } = await supabase
        .from("community_members")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId);
      memberCount = count || 2;
    }

    console.log(`[spawn-guild-boss] Member count: ${memberCount}`);

    // Select random boss
    const tierBosses = BOSS_NAMES[tier as keyof typeof BOSS_NAMES] || BOSS_NAMES.normal;
    const randomBoss = tierBosses[Math.floor(Math.random() * tierBosses.length)];
    const randomLore = BOSS_LORE[Math.floor(Math.random() * BOSS_LORE.length)];

    // Calculate stats
    const maxHp = getHpForTier(tier, memberCount);
    const xpReward = getXpForTier(tier);
    const durationHours = getDurationForTier(tier);
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    // Create boss encounter
    const { data: boss, error } = await supabase
      .from("guild_boss_encounters")
      .insert({
        community_id: communityId || null,
        epic_id: epicId || null,
        boss_name: randomBoss.name,
        boss_title: randomBoss.title,
        boss_lore: randomLore,
        boss_tier: tier,
        max_hp: maxHp,
        current_hp: maxHp,
        status: "active",
        expires_at: expiresAt.toISOString(),
        xp_reward: xpReward,
      })
      .select()
      .single();

    if (error) {
      console.error(`[spawn-guild-boss] Error creating boss:`, error);
      throw error;
    }

    console.log(`[spawn-guild-boss] Boss spawned successfully: ${boss.id} - ${boss.boss_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        boss,
        message: `${boss.boss_name} has appeared!`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[spawn-guild-boss] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
