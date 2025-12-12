import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserCompanion {
  id: string;
  user_id: string;
  inactive_days: number;
  last_activity_date: string | null;
  current_mood: string | null;
  body: number | null;
  mind: number | null;
  soul: number | null;
  neglected_image_url: string | null;
  current_image_url: string | null;
}

interface UserProfile {
  id: string;
  current_habit_streak: number | null;
  streak_freezes_available: number | null;
  streak_freezes_reset_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    console.log(`[Daily Decay] Processing for date: ${today}`);

    // Get all users with companions
    const { data: companions, error: companionsError } = await supabase
      .from("user_companion")
      .select("id, user_id, inactive_days, last_activity_date, current_mood, body, mind, soul, neglected_image_url, current_image_url");

    if (companionsError) {
      console.error("Error fetching companions:", companionsError);
      throw companionsError;
    }

    console.log(`[Daily Decay] Found ${companions?.length || 0} companions to process`);

    let processedCount = 0;
    let decayedCount = 0;
    let recoveredCount = 0;
    let freezesUsed = 0;
    let neglectedImageTriggered = 0;

    for (const companion of (companions as UserCompanion[]) || []) {
      try {
        // Check if user had any activity yesterday
        const hadActivity = await checkUserActivity(supabase, companion.user_id, yesterday);

        if (hadActivity) {
          // User was active - reset decay
          if (companion.inactive_days > 0) {
            console.log(`[Recovery] User ${companion.user_id} was active, resetting decay`);
            
            // Recovery bonus: +10 to each stat
            const newBody = Math.min(100, (companion.body ?? 100) + 10);
            const newMind = Math.min(100, (companion.mind ?? 0) + 10);
            const newSoul = Math.min(100, (companion.soul ?? 0) + 10);

            await supabase
              .from("user_companion")
              .update({
                inactive_days: 0,
                last_activity_date: yesterday,
                current_mood: "happy",
                body: newBody,
                mind: newMind,
                soul: newSoul,
              })
              .eq("id", companion.id);

            recoveredCount++;
          }
        } else {
          // User was inactive - apply decay
          const newInactiveDays = (companion.inactive_days ?? 0) + 1;
          
          console.log(`[Decay] User ${companion.user_id} inactive for ${newInactiveDays} days`);

          // Apply stat decay: -5 per stat per day (minimum 0)
          const newBody = Math.max(0, (companion.body ?? 100) - 5);
          const newMind = Math.max(0, (companion.mind ?? 0) - 5);
          const newSoul = Math.max(0, (companion.soul ?? 0) - 5);

          // Determine mood based on inactive days
          let newMood = "neutral";
          if (newInactiveDays === 1) newMood = "neutral";
          else if (newInactiveDays === 2) newMood = "worried";
          else if (newInactiveDays >= 3 && newInactiveDays < 5) newMood = "sad";
          else if (newInactiveDays >= 5) newMood = "sick";

          await supabase
            .from("user_companion")
            .update({
              inactive_days: newInactiveDays,
              current_mood: newMood,
              body: newBody,
              mind: newMind,
              soul: newSoul,
            })
            .eq("id", companion.id);

          decayedCount++;

          // Trigger neglected image generation at 3 days if not already generated
          if (newInactiveDays === 3 && !companion.neglected_image_url && companion.current_image_url) {
            console.log(`[Neglected Image] Triggering generation for user ${companion.user_id}`);
            
            // Call the generate-neglected-companion-image function in background
            try {
              await supabase.functions.invoke("generate-neglected-companion-image", {
                body: {
                  companionId: companion.id,
                  userId: companion.user_id,
                },
              });
              neglectedImageTriggered++;
            } catch (imageError) {
              console.error(`Failed to trigger neglected image for user ${companion.user_id}:`, imageError);
            }
          }

          // Handle streak freeze logic
          await handleStreakFreeze(supabase, companion.user_id);
          freezesUsed++;
        }

        processedCount++;
      } catch (userError) {
        console.error(`Error processing user ${companion.user_id}:`, userError);
      }
    }

    // Reset streak freezes for users whose reset date has passed
    await resetExpiredStreakFreezes(supabase, today);

    console.log(`[Daily Decay] Complete: ${processedCount} processed, ${decayedCount} decayed, ${recoveredCount} recovered, ${neglectedImageTriggered} neglected images triggered`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        decayed: decayedCount,
        recovered: recoveredCount,
        freezesUsed,
        neglectedImageTriggered,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Daily Decay] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function checkUserActivity(supabase: any, userId: string, date: string): Promise<boolean> {
  // Check for quest completions
  const { data: tasks } = await supabase
    .from("daily_tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("task_date", date)
    .eq("completed", true)
    .limit(1);

  if (tasks && tasks.length > 0) return true;

  // Check for habit completions
  const { data: habits } = await supabase
    .from("habit_completions")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .limit(1);

  if (habits && habits.length > 0) return true;

  // Check for check-ins
  const { data: checkIns } = await supabase
    .from("daily_check_ins")
    .select("id")
    .eq("user_id", userId)
    .eq("check_in_date", date)
    .limit(1);

  if (checkIns && checkIns.length > 0) return true;

  return false;
}

async function handleStreakFreeze(supabase: any, userId: string) {
  // Get user profile with streak info
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("current_habit_streak, streak_freezes_available, streak_at_risk, streak_at_risk_since")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) return;

  // If user has no streak, nothing to protect
  if ((profile.current_habit_streak ?? 0) <= 0) return;

  // Check if streak_at_risk was set more than 24 hours ago (auto-resolve)
  if (profile.streak_at_risk && profile.streak_at_risk_since) {
    const riskSince = new Date(profile.streak_at_risk_since);
    const hoursSinceRisk = (Date.now() - riskSince.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceRisk >= 24) {
      // User didn't decide within 24 hours - auto-consume freeze if available, else reset
      if ((profile.streak_freezes_available ?? 0) > 0) {
        console.log(`[Streak Freeze] Auto-consuming freeze for user ${userId} (24h timeout)`);
        await supabase
          .from("profiles")
          .update({
            streak_at_risk: false,
            streak_at_risk_since: null,
            streak_freezes_available: Math.max(0, (profile.streak_freezes_available ?? 1) - 1),
            last_streak_freeze_used: new Date().toISOString(),
          })
          .eq("id", userId);
      } else {
        console.log(`[Streak Freeze] Auto-resetting streak for user ${userId} (24h timeout, no freezes)`);
        await supabase
          .from("profiles")
          .update({
            streak_at_risk: false,
            streak_at_risk_since: null,
            current_habit_streak: 0,
          })
          .eq("id", userId);
      }
      return;
    }
    
    // Streak is already at risk, user hasn't decided yet - don't do anything more
    return;
  }

  // First miss: set streak_at_risk instead of auto-consuming freeze
  // This gives user a chance to decide when they return
  console.log(`[Streak Freeze] Setting streak at risk for user ${userId} (${profile.current_habit_streak} day streak)`);
  
  await supabase
    .from("profiles")
    .update({
      streak_at_risk: true,
      streak_at_risk_since: new Date().toISOString(),
    })
    .eq("id", userId);
}

async function resetExpiredStreakFreezes(supabase: any, today: string) {
  // Get all profiles where streak_freezes_reset_at has passed
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, streak_freezes_reset_at")
    .lt("streak_freezes_reset_at", new Date().toISOString());

  if (error) {
    console.error("Error fetching expired freezes:", error);
    return;
  }

  for (const profile of profiles || []) {
    // Reset freezes and set next reset date to 7 days from now
    const nextReset = new Date();
    nextReset.setDate(nextReset.getDate() + 7);

    await supabase
      .from("profiles")
      .update({
        streak_freezes_available: 1,
        streak_freezes_reset_at: nextReset.toISOString(),
      })
      .eq("id", profile.id);

    console.log(`[Freeze Reset] Reset freeze for user ${profile.id}`);
  }
}
