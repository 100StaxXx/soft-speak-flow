import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// UUID regex for validation
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Input validation schema
const DealBossDamageSchema = z.object({
  userId: z.string().regex(uuidRegex, "Invalid userId format"),
  epicId: z.string().regex(uuidRegex, "Invalid epicId format").optional().nullable(),
  communityId: z.string().regex(uuidRegex, "Invalid communityId format").optional().nullable(),
  damageSource: z.enum(["habit_completion", "quest_completion", "streak_milestone", "blessing_attack", "critical_hit"]),
  sourceId: z.string().regex(uuidRegex, "Invalid sourceId format").optional().nullable(),
  bonusDamageMultiplier: z.number().min(0.1).max(10).default(1),
}).refine(data => data.epicId || data.communityId, {
  message: "Either epicId or communityId is required"
});

// Base damage values by source
const DAMAGE_VALUES = {
  habit_completion: 25,
  quest_completion: 50,
  streak_milestone: 100,
  blessing_attack: 75,
  critical_hit: 0, // calculated as bonus
};

// Critical hit chance (10%)
const CRIT_CHANCE = 0.10;
const CRIT_MULTIPLIER = 2.0;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate input
    const rawInput = await req.json();
    const parseResult = DealBossDamageSchema.safeParse(rawInput);
    
    if (!parseResult.success) {
      console.error("[deal-boss-damage] Validation error:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { userId, epicId, communityId, damageSource, sourceId, bonusDamageMultiplier } = parseResult.data;

    // Verify user is actually a member of the epic or community
    if (epicId) {
      const { data: membership, error: memberError } = await supabase
        .from("epic_members")
        .select("user_id")
        .eq("epic_id", epicId)
        .eq("user_id", userId)
        .maybeSingle();
      
      if (memberError) {
        console.error("[deal-boss-damage] Membership check error:", memberError);
        throw memberError;
      }
      
      if (!membership) {
        // Also check if user is the epic owner
        const { data: epic, error: epicError } = await supabase
          .from("epics")
          .select("user_id")
          .eq("id", epicId)
          .single();
        
        if (epicError || !epic || epic.user_id !== userId) {
          console.log(`[deal-boss-damage] User ${userId} is not a member of epic ${epicId}`);
          return new Response(
            JSON.stringify({ error: "Not a member of this epic" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else if (communityId) {
      const { data: membership, error: memberError } = await supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle();
      
      if (memberError) {
        console.error("[deal-boss-damage] Community membership check error:", memberError);
        throw memberError;
      }
      
      if (!membership) {
        console.log(`[deal-boss-damage] User ${userId} is not a member of community ${communityId}`);
        return new Response(
          JSON.stringify({ error: "Not a member of this community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[deal-boss-damage] User ${userId} dealing damage from ${damageSource}`);

    // Find active boss
    let bossQuery = supabase
      .from("guild_boss_encounters")
      .select("*")
      .eq("status", "active")
      .gte("expires_at", new Date().toISOString());

    if (epicId) {
      bossQuery = bossQuery.eq("epic_id", epicId);
    } else {
      bossQuery = bossQuery.eq("community_id", communityId);
    }

    const { data: bosses, error: bossError } = await bossQuery.limit(1);

    if (bossError) throw bossError;
    
    if (!bosses || bosses.length === 0) {
      console.log(`[deal-boss-damage] No active boss found`);
      return new Response(
        JSON.stringify({ success: false, message: "No active boss to damage" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const boss = bosses[0];

    // Calculate damage
    let baseDamage = DAMAGE_VALUES[damageSource as keyof typeof DAMAGE_VALUES] || 25;
    
    // Apply bonus multiplier (from blessings)
    baseDamage = Math.round(baseDamage * bonusDamageMultiplier);
    
    // Check for critical hit
    const isCritical = Math.random() < CRIT_CHANCE;
    const finalDamage = isCritical ? Math.round(baseDamage * CRIT_MULTIPLIER) : baseDamage;

    // Calculate new HP
    const newHp = Math.max(0, boss.current_hp - finalDamage);
    const isKillingBlow = newHp === 0;

    console.log(`[deal-boss-damage] Damage: ${finalDamage} (crit: ${isCritical}), Boss HP: ${boss.current_hp} -> ${newHp}`);

    // Log the damage
    const { data: damageLog, error: logError } = await supabase
      .from("guild_boss_damage_log")
      .insert({
        encounter_id: boss.id,
        user_id: userId,
        damage_amount: finalDamage,
        damage_source: isCritical ? 'critical_hit' : damageSource,
        source_id: sourceId,
        is_killing_blow: isKillingBlow,
      })
      .select()
      .single();

    if (logError) throw logError;

    // Update boss HP
    const updateData: Record<string, unknown> = {
      current_hp: newHp,
    };

    if (isKillingBlow) {
      updateData.status = "defeated";
      updateData.defeated_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("guild_boss_encounters")
      .update(updateData)
      .eq("id", boss.id);

    if (updateError) throw updateError;

    // If boss is defeated, create a legend entry and award XP
    if (isKillingBlow) {
      console.log(`[deal-boss-damage] Boss ${boss.boss_name} defeated!`);
      
      // Get all damage dealers for the legend
      const { data: allDamage } = await supabase
        .from("guild_boss_damage_log")
        .select("user_id")
        .eq("encounter_id", boss.id);

      const heroIds = [...new Set(allDamage?.map(d => d.user_id) || [])];

      // Create legend entry
      await supabase
        .from("guild_legends")
        .insert({
          community_id: boss.community_id,
          epic_id: boss.epic_id,
          legend_type: "boss_defeated",
          title: `${boss.boss_name} Vanquished!`,
          description: `The guild united to defeat ${boss.boss_name}, ${boss.boss_title}. The killing blow was struck by a brave hero!`,
          icon: "⚔️",
          hero_ids: heroIds,
          metadata: {
            boss_tier: boss.boss_tier,
            boss_name: boss.boss_name,
            total_damage: boss.max_hp,
            killing_blow_user_id: userId,
          },
        });

      // Award XP to all participants (bonus for killing blow)
      for (const heroId of heroIds) {
        const xpAmount = heroId === userId 
          ? Math.round(boss.xp_reward * 0.5) // 50% bonus for killing blow
          : Math.round(boss.xp_reward * 0.25); // Base participation reward

        // Update companion XP
        await supabase
          .from("user_companion")
          .update({ 
            current_xp: supabase.rpc('increment_xp', { amount: xpAmount }) 
          })
          .eq("user_id", heroId);

        console.log(`[deal-boss-damage] Awarded ${xpAmount} XP to ${heroId}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        damage: finalDamage,
        isCritical,
        isKillingBlow,
        newHp,
        bossDefeated: isKillingBlow,
        message: isKillingBlow 
          ? `⚔️ KILLING BLOW! ${boss.boss_name} has been defeated!`
          : isCritical 
            ? `💥 CRITICAL HIT! ${finalDamage} damage!`
            : `${finalDamage} damage dealt!`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[deal-boss-damage] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
