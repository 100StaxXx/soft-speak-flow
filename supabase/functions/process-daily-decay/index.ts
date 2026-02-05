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
  is_alive: boolean | null;
  care_score: number | null;
  recovery_progress: number | null;
  scars: Array<{ date: string; context: string }> | null;
  hunger: number | null;
  happiness: number | null;
  spirit_animal: string | null;
  core_element: string | null;
  current_stage: number | null;
  created_at: string | null;
  care_consistency: number | null;
  care_responsiveness: number | null;
  care_balance: number | null;
  care_intent: number | null;
  care_recovery: number | null;
  care_pattern: Record<string, any> | null;
  last_7_days_activity: boolean[] | null;
  evolution_path: string | null;
  evolution_path_locked: boolean | null;
  path_determination_date: string | null;
  dormant_since: string | null;
  dormancy_count: number | null;
  dormancy_recovery_days: number | null;
  bond_level: number | null;
  total_interactions: number | null;
  // 6-stat system (100-1000 scale)
  vitality: number | null;
  wisdom: number | null;
  discipline: number | null;
  resolve: number | null;
  creativity: number | null;
  alignment: number | null;
  last_weekly_maintenance_date: string | null;
}

interface BehaviorLogEntry {
  habits_completed: number;
  tasks_completed: number;
  check_ins: number;
  first_activity_time: string | null;
  last_activity_time: string | null;
  completion_velocity: number | null;
  is_binge: boolean;
}

// Thresholds
const DORMANCY_THRESHOLD_DAYS = 7;
const DEATH_THRESHOLD_DORMANCIES = 3;
const CRITICAL_THRESHOLD_DAYS = 5;
const SCAR_THRESHOLD_DAYS = 5;
const RECOVERY_PER_DAY = 25;
const DORMANCY_RECOVERY_DAYS_REQUIRED = 5;

// 6-stat system constants
const STAT_FLOOR = 100;
const STAT_MAX = 1000;
const NEW_USER_GRACE_DAYS = 7;

// Type definitions for 6-stat system
type StatAttribute = 'vitality' | 'wisdom' | 'discipline' | 'resolve' | 'creativity' | 'alignment';
type LifeStatus = 'active' | 'transition' | 'vacation' | 'sick';

const BASE_WEEKLY_MAINTENANCE: Record<StatAttribute, number> = {
  discipline: 40,
  vitality: 30,
  creativity: 25,
  resolve: 20,
  wisdom: 15,
  alignment: 15,
};

const LIFE_STATUS_MULTIPLIERS: Record<LifeStatus, number> = {
  active: 1,
  transition: 0.5,
  vacation: 0.25,
  sick: 0.1,
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scaledMaintenance(current: number, base: number): number {
  const above = Math.max(0, current - STAT_FLOOR);
  const factor = clamp(above / 600, 0.35, 1.25);
  return Math.round(base * factor);
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
    // TODO: For MVP, we use UTC Sunday. Future: use user-local timezone from profiles.timezone
    const isSunday = new Date().getDay() === 0;

    console.log(`[Daily Processing] Date: ${today}, Sunday: ${isSunday}`);

    // Get all ALIVE (and non-dormant) user companions
    const { data: companions, error: companionsError } = await supabase
      .from("user_companion")
      .select("*")
      .or("is_alive.is.null,is_alive.eq.true");

    if (companionsError) {
      console.error("Error fetching companions:", companionsError);
      throw companionsError;
    }

    console.log(`[Daily Processing] Found ${companions?.length || 0} alive companions to process`);

    let processedCount = 0;
    let decayedCount = 0;
    let recoveredCount = 0;
    let dormanciesTriggered = 0;
    let deathsCount = 0;
    let scarsAdded = 0;
    let pathsUpdated = 0;
    let consequencesQueued = 0;
    let maintenanceApplied = 0;
    let maintenanceSkipped = 0;

    for (const companion of (companions as UserCompanion[]) || []) {
      try {
        // Handle dormant companions separately
        if (companion.dormant_since) {
          await handleDormantCompanion(supabase, companion, today, yesterday);
          processedCount++;
          continue;
        }

        // Check if user had any activity yesterday
        const activityData = await getDetailedActivityData(supabase, companion.user_id, yesterday);
        const hadActivity = activityData.totalActivity > 0;

        // Log behavior for care signal calculation
        await logBehavior(supabase, companion.user_id, yesterday, activityData);

        // Calculate updated care signals
        const newCareSignals = await calculateCareSignals(supabase, companion, hadActivity, activityData);

        // ALWAYS rotate last_7_days_activity first (before any Sunday logic)
        const last7Days = companion.last_7_days_activity ?? [];
        const updated7Days = [hadActivity, ...last7Days.slice(0, 6)];
        const activeDays = updated7Days.filter(Boolean).length;

        if (hadActivity) {
          // User was active - apply recovery and care improvements
          await handleActiveDay(supabase, companion, newCareSignals, today, updated7Days);
          recoveredCount++;
          
          // Check for evolution path update (weekly)
          if (shouldUpdateEvolutionPath(companion)) {
            const newPath = determineEvolutionPath(newCareSignals);
            if (newPath !== companion.evolution_path) {
              await updateEvolutionPath(supabase, companion.id, newPath, today);
              pathsUpdated++;
            }
          }
        } else {
          // User was inactive - handle decay
          const result = await handleInactiveDay(supabase, companion, newCareSignals, today, updated7Days);
          
          if (result.becameDormant) {
            dormanciesTriggered++;
          } else if (result.died) {
            deathsCount++;
          } else {
            decayedCount++;
          }
          
          if (result.scarAdded) {
            scarsAdded++;
          }
          
          consequencesQueued += result.consequencesQueued;
        }

        // SUNDAY: Weekly maintenance check (Engagement Gate)
        if (isSunday) {
          const maintenanceResult = await handleSundayMaintenance(
            supabase, 
            companion, 
            activeDays, 
            today
          );
          if (maintenanceResult.applied) {
            maintenanceApplied++;
          } else {
            maintenanceSkipped++;
          }
        }

        processedCount++;
      } catch (userError) {
        console.error(`Error processing user ${companion.user_id}:`, userError);
      }
    }

    // Process any pending consequences that are due today
    const consequencesProcessed = await processPendingConsequences(supabase, today);

    // Reset streak freezes for users whose reset date has passed
    await resetExpiredStreakFreezes(supabase, today);

    console.log(`[Daily Processing] Complete: ${processedCount} processed, ${decayedCount} decayed, ${recoveredCount} recovered, ${dormanciesTriggered} dormancies, ${deathsCount} deaths, ${scarsAdded} scars, ${pathsUpdated} paths updated, ${consequencesProcessed} consequences processed`);
    if (isSunday) {
      console.log(`[Sunday Maintenance] Applied: ${maintenanceApplied}, Skipped: ${maintenanceSkipped}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        decayed: decayedCount,
        recovered: recoveredCount,
        dormancies: dormanciesTriggered,
        deaths: deathsCount,
        scarsAdded,
        pathsUpdated,
        consequencesProcessed,
        maintenanceApplied,
        maintenanceSkipped,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Daily Processing] Error:", error);
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

// =============================================
// ENGAGEMENT GATE & WEEKLY MAINTENANCE (NEW)
// =============================================

interface EngagementStatus {
  isEngaged: boolean;
  resistDays: number;
  ritualDays: number;
  statMode: 'casual' | 'rpg';
  statsEnabled: boolean;
  lifeStatus: LifeStatus;
}

async function isNewUser(supabase: any, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();
    
  // If no profile or no created_at, treat as new user (safe default)
  if (!profile?.created_at) return true;
  
  const accountAge = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  return accountAge < NEW_USER_GRACE_DAYS;
}

async function getEngagementStatus(supabase: any, userId: string): Promise<EngagementStatus> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString();
  const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

  // Get profile settings (including life_status_expires_at for auto-expiry)
  const { data: profile } = await supabase
    .from('profiles')
    .select('stat_mode, stats_enabled, life_status, life_status_expires_at')
    .eq('id', userId)
    .single();

  const statMode = (profile?.stat_mode ?? 'casual') as 'casual' | 'rpg';
  const statsEnabled = profile?.stats_enabled ?? true;
  let lifeStatus: LifeStatus = (profile?.life_status ?? 'active') as LifeStatus;

  // Auto-expire life status if past expiry date
  if (profile?.life_status_expires_at && 
      new Date(profile.life_status_expires_at) < new Date()) {
    lifeStatus = 'active';
    // Update profile to reset expired status
    await supabase
      .from('profiles')
      .update({ life_status: 'active', life_status_expires_at: null })
      .eq('id', userId);
  }

  // If stats disabled, never engaged
  if (!statsEnabled) {
    return { isEngaged: false, resistDays: 0, ritualDays: 0, statMode, statsEnabled, lifeStatus };
  }

  // Count DISTINCT DAYS with successful resist wins in last 7 days
  const { data: resistLogs } = await supabase
    .from('resist_log')
    .select('created_at')
    .eq('user_id', userId)
    .neq('result', 'fail')
    .gte('created_at', cutoff);

  const resistDays = new Set(
    (resistLogs ?? []).map((r: any) => r.created_at?.split('T')[0])
  ).size;

  // Count DISTINCT DAYS with ritual completions in last 7 days
  const { data: ritualCompletions } = await supabase
    .from('habit_completions')
    .select('date')
    .eq('user_id', userId)
    .gte('date', cutoffDate);

  const ritualDays = new Set(
    (ritualCompletions ?? []).map((r: any) => r.date)
  ).size;

  // Engagement thresholds based on mode
  let isEngaged = false;
  if (statMode === 'rpg') {
    // Lower threshold for RPG mode
    isEngaged = resistDays >= 1 || ritualDays >= 1;
  } else {
    // Standard threshold for casual mode
    isEngaged = resistDays >= 1 || ritualDays >= 2;
  }

  return { isEngaged, resistDays, ritualDays, statMode, statsEnabled, lifeStatus };
}

interface MaintenanceResult {
  applied: boolean;
  reason: string;
}

async function handleSundayMaintenance(
  supabase: any,
  companion: UserCompanion,
  activeDays: number,
  todayISO: string
): Promise<MaintenanceResult> {
  // Already processed today?
  if (companion.last_weekly_maintenance_date === todayISO) {
    return { applied: false, reason: 'already_processed' };
  }

  // Get engagement status
  const engagement = await getEngagementStatus(supabase, companion.user_id);

  // Silent exit for stats-disabled users (no logs, no messages)
  if (!engagement.statsEnabled) {
    return { applied: false, reason: 'stats_disabled' };
  }

  // New user grace period
  if (await isNewUser(supabase, companion.user_id)) {
    console.log(`[Maintenance] User ${companion.user_id} in grace period. Stats held steady.`);
    await updateMaintenanceRecord(supabase, companion.id, todayISO);
    return { applied: false, reason: 'grace_period' };
  }

  // Check engagement gate
  if (!engagement.isEngaged) {
    console.log(`[Maintenance] User ${companion.user_id} not engaged (resist days: ${engagement.resistDays}, ritual days: ${engagement.ritualDays}). Stats held steady.`);
    await updateMaintenanceRecord(supabase, companion.id, todayISO);
    return { applied: false, reason: 'not_engaged' };
  }

  // Apply maintenance based on activity tier and life status
  await applyWeeklyMaintenance(supabase, companion, activeDays, engagement, todayISO);
  return { applied: true, reason: 'maintenance_applied' };
}

async function updateMaintenanceRecord(
  supabase: any, 
  companionId: string, 
  todayISO: string,
  summary: string = 'Maintenance Check: Stats held steady this week.'
) {
  await supabase
    .from("user_companion")
    .update({
      last_weekly_maintenance_date: todayISO,
      last_7_days_activity: [false, false, false, false, false, false, false],
      last_maintenance_summary: summary,
      last_maintenance_at: new Date().toISOString(),
    })
    .eq("id", companionId);
}

async function applyWeeklyMaintenance(
  supabase: any,
  companion: UserCompanion,
  activeDays: number,
  engagement: EngagementStatus,
  todayISO: string
) {
  // Activity tier multiplier
  let activityMult = 1;
  if (activeDays >= 4) {
    activityMult = 0; // No maintenance needed for good training week
    console.log(`[Maintenance] User ${companion.user_id} trained ${activeDays} days. Great week! No maintenance needed.`);
  } else if (activeDays >= 2) {
    activityMult = 0.5; // 50% maintenance
    console.log(`[Maintenance] User ${companion.user_id} trained ${activeDays} days. Partial maintenance applied.`);
  } else {
    console.log(`[Maintenance] User ${companion.user_id} trained ${activeDays} days. Full maintenance applied.`);
  }

  // Life status multiplier
  const statusMult = LIFE_STATUS_MULTIPLIERS[engagement.lifeStatus] ?? 1;
  const finalMult = activityMult * statusMult;

  // Determine maintenance summary message
  let summary = '';
  if (finalMult === 0) {
    summary = 'Maintenance Check: Great training week! No maintenance needed.';
  } else if (activeDays >= 2) {
    summary = `Maintenance Check: You trained ${activeDays} days. Some skills need attention.`;
  } else {
    summary = 'Maintenance Check: Low training week. Skills need attention.';
  }

  // Build update object
  const updates: Record<string, any> = {
    last_weekly_maintenance_date: todayISO,
    last_7_days_activity: [false, false, false, false, false, false, false],
    last_maintenance_summary: summary,
    last_maintenance_at: new Date().toISOString(),
  };

  // If no maintenance needed
  if (finalMult === 0) {
    await supabase
      .from("user_companion")
      .update(updates)
      .eq("id", companion.id);
    return;
  }

  // Apply scaled maintenance to 6 stats
  for (const [stat, base] of Object.entries(BASE_WEEKLY_MAINTENANCE)) {
    const current = (companion as any)[stat] ?? 300;
    const maintenance = Math.round(scaledMaintenance(current, base) * finalMult);
    updates[stat] = clamp(current - maintenance, STAT_FLOOR, STAT_MAX);
  }

  await supabase
    .from("user_companion")
    .update(updates)
    .eq("id", companion.id);
}

// =============================================
// CARE SIGNAL CALCULATION
// =============================================

interface ActivityData {
  totalActivity: number;
  habitsCompleted: number;
  tasksCompleted: number;
  checkIns: number;
  firstActivityTime: string | null;
  lastActivityTime: string | null;
  completionTimestamps: string[];
}

async function getDetailedActivityData(supabase: any, userId: string, date: string): Promise<ActivityData> {
  const [tasks, habits, checkIns] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("id, completed_at")
      .eq("user_id", userId)
      .eq("task_date", date)
      .eq("completed", true),
    supabase
      .from("habit_completions")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("date", date),
    supabase
      .from("daily_check_ins")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("check_in_date", date),
  ]);

  const completionTimestamps: string[] = [];
  
  for (const task of tasks.data || []) {
    if (task.completed_at) completionTimestamps.push(task.completed_at);
  }
  for (const habit of habits.data || []) {
    if (habit.created_at) completionTimestamps.push(habit.created_at);
  }
  for (const checkIn of checkIns.data || []) {
    if (checkIn.created_at) completionTimestamps.push(checkIn.created_at);
  }

  completionTimestamps.sort();

  return {
    totalActivity: (tasks.data?.length || 0) + (habits.data?.length || 0) + (checkIns.data?.length || 0),
    habitsCompleted: habits.data?.length || 0,
    tasksCompleted: tasks.data?.length || 0,
    checkIns: checkIns.data?.length || 0,
    firstActivityTime: completionTimestamps[0] || null,
    lastActivityTime: completionTimestamps[completionTimestamps.length - 1] || null,
    completionTimestamps,
  };
}

async function logBehavior(supabase: any, userId: string, date: string, activity: ActivityData) {
  let velocity: number | null = null;
  if (activity.completionTimestamps.length > 1) {
    const timestamps = activity.completionTimestamps.map(t => new Date(t).getTime());
    let totalGap = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalGap += (timestamps[i] - timestamps[i - 1]) / 1000;
    }
    velocity = totalGap / (timestamps.length - 1);
  }

  const isBinge = activity.totalActivity >= 10 && velocity !== null && velocity < 30;

  await supabase
    .from("companion_behavior_log")
    .upsert({
      user_id: userId,
      behavior_date: date,
      habits_completed: activity.habitsCompleted,
      tasks_completed: activity.tasksCompleted,
      check_ins: activity.checkIns,
      first_activity_time: activity.firstActivityTime ? new Date(activity.firstActivityTime).toTimeString().split(" ")[0] : null,
      last_activity_time: activity.lastActivityTime ? new Date(activity.lastActivityTime).toTimeString().split(" ")[0] : null,
      completion_velocity: velocity,
      is_binge: isBinge,
    }, { onConflict: "user_id,behavior_date" });
}

interface CareSignals {
  consistency: number;
  responsiveness: number;
  balance: number;
  intent: number;
  recovery: number;
}

async function calculateCareSignals(
  supabase: any,
  companion: UserCompanion,
  wasActive: boolean,
  activity: ActivityData
): Promise<CareSignals> {
  const { data: behaviorLogs } = await supabase
    .from("companion_behavior_log")
    .select("*")
    .eq("user_id", companion.user_id)
    .order("behavior_date", { ascending: false })
    .limit(14);

  const logs = (behaviorLogs || []) as BehaviorLogEntry[];
  
  const currentConsistency = companion.care_consistency ?? 0.5;
  const currentResponsiveness = companion.care_responsiveness ?? 0.5;
  const currentBalance = companion.care_balance ?? 0.5;
  const currentIntent = companion.care_intent ?? 0.5;
  const currentRecovery = companion.care_recovery ?? 0.5;

  // CONSISTENCY
  let consistencyScore = currentConsistency;
  if (logs.length > 0) {
    const weights = logs.map((_, i) => 1 + (0.1 * (logs.length - i)));
    let weightedSum = 0;
    let totalWeight = 0;
    logs.forEach((log, i) => {
      const isActive = (log.habits_completed + log.tasks_completed + log.check_ins) > 0;
      weightedSum += isActive ? weights[i] : 0;
      totalWeight += weights[i];
    });
    const targetConsistency = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    consistencyScore = currentConsistency * 0.7 + targetConsistency * 0.3;
  }
  if (wasActive) {
    consistencyScore = Math.min(1, consistencyScore + 0.05);
  } else {
    consistencyScore = Math.max(0, consistencyScore - 0.08);
  }

  // RESPONSIVENESS
  let responsivenessScore = currentResponsiveness;
  if (wasActive && activity.firstActivityTime) {
    const hour = parseInt(activity.firstActivityTime.split(":")[0]);
    if (hour >= 5 && hour < 12) {
      responsivenessScore = Math.min(1, responsivenessScore + 0.1);
    } else if (hour >= 12 && hour < 18) {
      responsivenessScore = Math.min(1, responsivenessScore + 0.03);
    } else {
      responsivenessScore = Math.max(0, responsivenessScore - 0.02);
    }
  } else if (!wasActive) {
    responsivenessScore = Math.max(0, responsivenessScore - 0.05);
  }

  // BALANCE
  let balanceScore = currentBalance;
  if (logs.length >= 3) {
    const recentActivity = logs.slice(0, 3).map(l => l.tasks_completed + l.habits_completed);
    const avg = recentActivity.reduce((a, b) => a + b, 0) / recentActivity.length;
    const variance = recentActivity.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentActivity.length;
    
    if (variance < 5 && avg >= 2 && avg <= 10) {
      balanceScore = Math.min(1, balanceScore + 0.05);
    } else if (variance > 20 || avg > 15 || avg < 1) {
      balanceScore = Math.max(0, balanceScore - 0.08);
    }
  }

  // INTENT
  let intentScore = currentIntent;
  if (wasActive && activity.completionTimestamps.length > 1) {
    const timestamps = activity.completionTimestamps.map(t => new Date(t).getTime());
    let rapidCount = 0;
    for (let i = 1; i < timestamps.length; i++) {
      const gap = (timestamps[i] - timestamps[i - 1]) / 1000;
      if (gap < 5) rapidCount++;
    }
    const rapidRatio = rapidCount / (timestamps.length - 1);
    
    if (rapidRatio > 0.5) {
      intentScore = Math.max(0.1, intentScore - 0.15);
    } else if (rapidRatio < 0.2) {
      intentScore = Math.min(1, intentScore + 0.05);
    }
  }

  // RECOVERY
  let recoveryScore = currentRecovery;
  if (!wasActive && companion.inactive_days === 0) {
    recoveryScore = currentRecovery;
  } else if (wasActive && (companion.inactive_days ?? 0) > 0) {
    const daysAway = companion.inactive_days ?? 0;
    if (daysAway === 1) {
      recoveryScore = Math.min(1, recoveryScore + 0.1);
    } else if (daysAway === 2) {
      recoveryScore = Math.min(1, recoveryScore + 0.05);
    } else {
      recoveryScore = Math.max(0, recoveryScore - 0.05);
    }
  } else if (!wasActive && (companion.inactive_days ?? 0) >= 2) {
    recoveryScore = Math.max(0, recoveryScore - 0.05);
  }

  return {
    consistency: Math.max(0, Math.min(1, consistencyScore)),
    responsiveness: Math.max(0, Math.min(1, responsivenessScore)),
    balance: Math.max(0, Math.min(1, balanceScore)),
    intent: Math.max(0, Math.min(1, intentScore)),
    recovery: Math.max(0, Math.min(1, recoveryScore)),
  };
}

// =============================================
// EVOLUTION PATH DETERMINATION
// =============================================

function shouldUpdateEvolutionPath(companion: UserCompanion): boolean {
  if (companion.evolution_path_locked) return false;
  
  if (!companion.path_determination_date) return true;
  
  const lastDetermination = new Date(companion.path_determination_date);
  const daysSince = Math.floor((Date.now() - lastDetermination.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= 7;
}

function determineEvolutionPath(careSignals: CareSignals): string {
  const { consistency, responsiveness, balance, intent, recovery } = careSignals;
  
  if (consistency > 0.75 && responsiveness > 0.75 && balance > 0.75 && intent > 0.75 && recovery > 0.75) {
    return "balanced_architect";
  }
  
  if (consistency > 0.65 && balance > 0.6 && recovery > 0.55) {
    return "steady_guardian";
  }
  
  if (intent > 0.5 && (consistency < 0.4 || balance < 0.35)) {
    return "volatile_ascendant";
  }
  
  return "neglected_wanderer";
}

async function updateEvolutionPath(supabase: any, companionId: string, newPath: string, today: string) {
  console.log(`[Evolution Path] Updating companion ${companionId} to path: ${newPath}`);
  
  await supabase
    .from("user_companion")
    .update({
      evolution_path: newPath,
      path_determination_date: today,
    })
    .eq("id", companionId);
}

// =============================================
// ACTIVE DAY HANDLING
// =============================================

async function handleActiveDay(
  supabase: any,
  companion: UserCompanion,
  careSignals: CareSignals,
  today: string,
  updated7Days: boolean[]
) {
  const currentRecovery = companion.recovery_progress ?? 100;
  const currentCareScore = companion.care_score ?? 100;
  const currentHunger = companion.hunger ?? 100;
  const currentHappiness = companion.happiness ?? 100;
  const currentBond = companion.bond_level ?? 0;

  const newRecovery = Math.min(100, currentRecovery + RECOVERY_PER_DAY);
  const newCareScore = Math.min(100, currentCareScore + 5);
  const newHunger = Math.min(100, currentHunger + 30);
  const newHappiness = Math.min(100, currentHappiness + 20);
  const newBond = currentBond + 2;

  const overallCare = (careSignals.consistency + careSignals.responsiveness + careSignals.balance + careSignals.intent + careSignals.recovery) / 5;
  let newMood = "happy";
  if (overallCare < 0.3) {
    newMood = "worried";
  } else if (overallCare < 0.5) {
    newMood = "neutral";
  } else if (overallCare < 0.7) {
    newMood = "content";
  }

  const newBody = Math.min(100, (companion.body ?? 100) + 10);
  const newMind = Math.min(100, (companion.mind ?? 0) + 10);
  const newSoul = Math.min(100, (companion.soul ?? 0) + 10);

  console.log(`[Recovery] User ${companion.user_id} was active. Recovery: ${currentRecovery}% -> ${newRecovery}%, Care signals updated`);

  await supabase
    .from("user_companion")
    .update({
      inactive_days: 0,
      last_activity_date: today,
      current_mood: newMood,
      body: newBody,
      mind: newMind,
      soul: newSoul,
      recovery_progress: newRecovery,
      care_score: newCareScore,
      hunger: newHunger,
      happiness: newHappiness,
      bond_level: newBond,
      total_interactions: (companion.total_interactions ?? 0) + 1,
      last_interaction_at: new Date().toISOString(),
      care_consistency: careSignals.consistency,
      care_responsiveness: careSignals.responsiveness,
      care_balance: careSignals.balance,
      care_intent: careSignals.intent,
      care_recovery: careSignals.recovery,
      last_7_days_activity: updated7Days,
    })
    .eq("id", companion.id);

  return { recovered: true };
}

// =============================================
// INACTIVE DAY HANDLING
// =============================================

interface InactiveDayResult {
  becameDormant: boolean;
  died: boolean;
  scarAdded: boolean;
  consequencesQueued: number;
}

async function handleInactiveDay(
  supabase: any,
  companion: UserCompanion,
  careSignals: CareSignals,
  today: string,
  updated7Days: boolean[]
): Promise<InactiveDayResult> {
  const newInactiveDays = (companion.inactive_days ?? 0) + 1;
  const currentCareScore = companion.care_score ?? 100;
  const currentHunger = companion.hunger ?? 100;
  const currentHappiness = companion.happiness ?? 100;
  const currentScars = companion.scars ?? [];
  const dormancyCount = companion.dormancy_count ?? 0;

  console.log(`[Inactive] User ${companion.user_id} inactive for ${newInactiveDays} days`);

  let result: InactiveDayResult = {
    becameDormant: false,
    died: false,
    scarAdded: false,
    consequencesQueued: 0,
  };

  // Check for DORMANCY or DEATH at 7 days
  if (newInactiveDays >= DORMANCY_THRESHOLD_DAYS) {
    if (dormancyCount >= DEATH_THRESHOLD_DORMANCIES - 1) {
      console.log(`[DEATH] Companion for user ${companion.user_id} has died after ${dormancyCount + 1} dormancies`);
      
      await triggerCompanionDeath(supabase, companion, today);
      result.died = true;
      return result;
    } else {
      console.log(`[DORMANCY] Companion for user ${companion.user_id} entering dormancy (count: ${dormancyCount + 1})`);
      
      await enterDormancy(supabase, companion, today, dormancyCount);
      result.becameDormant = true;
      
      await addScar(supabase, companion.id, today, `Fell into dormancy after ${newInactiveDays} days of absence`);
      result.scarAdded = true;
      
      return result;
    }
  }

  // Check for SCAR at 5-6 days
  const hasScarForThisPeriod = currentScars.some(scar => {
    const scarDate = new Date(scar.date);
    const daysSinceScar = Math.floor((Date.now() - scarDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceScar < 7;
  });

  if (newInactiveDays >= SCAR_THRESHOLD_DAYS && !hasScarForThisPeriod) {
    console.log(`[SCAR] Adding scar for user ${companion.user_id} at ${newInactiveDays} days inactive`);
    await addScar(supabase, companion.id, today, `Nearly lost after ${newInactiveDays} days of absence`);
    result.scarAdded = true;
  }

  // Queue delayed consequences
  if (newInactiveDays === 2) {
    await queueConsequence(supabase, companion, "mood_shift", 2, { new_mood: "worried", reason: "absence" });
    result.consequencesQueued++;
  }
  
  if (newInactiveDays === 4) {
    await queueConsequence(supabase, companion, "dialogue_change", 1, { tone: "reserved", reason: "prolonged_absence" });
    result.consequencesQueued++;
  }

  if (newInactiveDays === 5) {
    await queueConsequence(supabase, companion, "dormancy_warning", 1, { days_until_dormancy: 2 });
    result.consequencesQueued++;
  }

  // Apply stat decay (care-related, not RPG stats)
  const newCareScore = Math.max(0, currentCareScore - 10);
  const newHunger = Math.max(0, currentHunger - 15);
  const newHappiness = Math.max(0, currentHappiness - 20);
  const newBody = Math.max(0, (companion.body ?? 100) - 5);
  const newMind = Math.max(0, (companion.mind ?? 0) - 5);
  const newSoul = Math.max(0, (companion.soul ?? 0) - 5);

  // Determine mood based on inactive days
  let newMood = "neutral";
  if (newInactiveDays === 1) newMood = "neutral";
  else if (newInactiveDays === 2) newMood = "worried";
  else if (newInactiveDays >= 3 && newInactiveDays < 5) newMood = "sad";
  else if (newInactiveDays >= 5) newMood = "sick";

  // Recovery decline
  const currentRecovery = companion.recovery_progress ?? 100;
  const newRecovery = newInactiveDays >= 3 ? Math.max(0, currentRecovery - 25) : currentRecovery;

  await supabase
    .from("user_companion")
    .update({
      inactive_days: newInactiveDays,
      current_mood: newMood,
      body: newBody,
      mind: newMind,
      soul: newSoul,
      care_score: newCareScore,
      recovery_progress: newRecovery,
      hunger: newHunger,
      happiness: newHappiness,
      care_consistency: careSignals.consistency,
      care_responsiveness: careSignals.responsiveness,
      care_balance: careSignals.balance,
      care_intent: careSignals.intent,
      care_recovery: careSignals.recovery,
      last_7_days_activity: updated7Days,
    })
    .eq("id", companion.id);

  // Trigger neglected image at 3 days
  if (newInactiveDays === 3 && !companion.neglected_image_url && companion.current_image_url) {
    try {
      await supabase.functions.invoke("generate-neglected-companion-image", {
        body: { companionId: companion.id, userId: companion.user_id },
      });
    } catch (e) {
      console.error(`Failed to trigger neglected image:`, e);
    }
  }

  // Handle streak freeze
  await handleStreakFreeze(supabase, companion.user_id);

  return result;
}

// =============================================
// DORMANCY SYSTEM
// =============================================

async function enterDormancy(supabase: any, companion: UserCompanion, today: string, currentCount: number) {
  await supabase
    .from("user_companion")
    .update({
      dormant_since: today,
      dormancy_count: currentCount + 1,
      dormancy_recovery_days: 0,
      current_mood: "dormant",
      evolution_path: "neglected_wanderer",
      evolution_path_locked: true,
    })
    .eq("id", companion.id);

  try {
    await supabase.functions.invoke("generate-dormant-companion-image", {
      body: { companionId: companion.id, userId: companion.user_id },
    });
  } catch (e) {
    console.error(`Failed to trigger dormant image:`, e);
  }
}

async function handleDormantCompanion(supabase: any, companion: UserCompanion, today: string, yesterday: string) {
  const activityData = await getDetailedActivityData(supabase, companion.user_id, yesterday);
  const hadActivity = activityData.totalActivity > 0;

  if (hadActivity) {
    const recoveryDays = (companion.dormancy_recovery_days ?? 0) + 1;
    
    console.log(`[Dormancy Recovery] User ${companion.user_id} active while dormant. Recovery day ${recoveryDays}/${DORMANCY_RECOVERY_DAYS_REQUIRED}`);

    if (recoveryDays >= DORMANCY_RECOVERY_DAYS_REQUIRED) {
      console.log(`[Dormancy Recovery] Companion ${companion.id} waking up after ${recoveryDays} consecutive active days`);
      
      await supabase
        .from("user_companion")
        .update({
          dormant_since: null,
          dormancy_recovery_days: 0,
          current_mood: "neutral",
          inactive_days: 0,
          last_activity_date: today,
        })
        .eq("id", companion.id);

      await supabase.from("companion_memories").insert({
        user_id: companion.user_id,
        companion_id: companion.id,
        memory_type: "dormancy_recovery",
        memory_date: today,
        memory_context: { dormancy_count: companion.dormancy_count },
      });
    } else {
      await supabase
        .from("user_companion")
        .update({ dormancy_recovery_days: recoveryDays })
        .eq("id", companion.id);
    }
  } else {
    if ((companion.dormancy_recovery_days ?? 0) > 0) {
      console.log(`[Dormancy Recovery] User ${companion.user_id} missed a day, resetting recovery progress`);
      await supabase
        .from("user_companion")
        .update({ dormancy_recovery_days: 0 })
        .eq("id", companion.id);
    }
  }
}

// =============================================
// DEATH SYSTEM
// =============================================

async function triggerCompanionDeath(supabase: any, companion: UserCompanion, today: string) {
  const createdAt = companion.created_at ? new Date(companion.created_at) : new Date();
  const daysTogether = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  await supabase.from("companion_memorials").insert({
    user_id: companion.user_id,
    companion_name: `The ${companion.spirit_animal || "Companion"}`,
    spirit_animal: companion.spirit_animal || "Unknown",
    core_element: companion.core_element,
    days_together: daysTogether,
    death_date: today,
    death_cause: `Passed away after repeated neglect (${(companion.dormancy_count ?? 0) + 1} dormancies)`,
    final_evolution_stage: companion.current_stage ?? 1,
    final_image_url: companion.current_image_url,
  });

  await supabase
    .from("user_companion")
    .update({
      is_alive: false,
      current_mood: "dead",
      dormant_since: null,
    })
    .eq("id", companion.id);
}

// =============================================
// SCAR SYSTEM
// =============================================

async function addScar(supabase: any, companionId: string, date: string, context: string) {
  const { data: companion } = await supabase
    .from("user_companion")
    .select("scars, scar_history")
    .eq("id", companionId)
    .single();

  const currentScars = companion?.scars ?? [];
  const scarHistory = companion?.scar_history ?? [];

  const newScar = { date, context };
  
  await supabase
    .from("user_companion")
    .update({
      scars: [...currentScars, newScar],
      scar_history: [...scarHistory, { ...newScar, added_at: new Date().toISOString() }],
    })
    .eq("id", companionId);

  try {
    await supabase.functions.invoke("generate-companion-scar", {
      body: { companionId, scarContext: context },
    });
  } catch (e) {
    console.error(`Failed to trigger scar image:`, e);
  }
}

// =============================================
// DELAYED CONSEQUENCES
// =============================================

async function queueConsequence(
  supabase: any,
  companion: UserCompanion,
  type: string,
  daysFromNow: number,
  payload: Record<string, any>
) {
  const triggerDate = new Date();
  triggerDate.setDate(triggerDate.getDate() + daysFromNow);

  await supabase.from("companion_pending_consequences").insert({
    user_id: companion.user_id,
    companion_id: companion.id,
    consequence_type: type,
    trigger_date: triggerDate.toISOString().split("T")[0],
    payload,
  });

  console.log(`[Consequence] Queued ${type} for user ${companion.user_id} to trigger on ${triggerDate.toISOString().split("T")[0]}`);
}

async function processPendingConsequences(supabase: any, today: string): Promise<number> {
  const { data: consequences } = await supabase
    .from("companion_pending_consequences")
    .select("*")
    .lte("trigger_date", today)
    .eq("processed", false);

  let processed = 0;

  for (const consequence of consequences || []) {
    try {
      console.log(`[Consequence] Processing ${consequence.consequence_type} for user ${consequence.user_id}`);

      switch (consequence.consequence_type) {
        case "mood_shift":
          await supabase
            .from("user_companion")
            .update({ current_mood: consequence.payload.new_mood })
            .eq("id", consequence.companion_id);
          break;

        case "dialogue_change":
          const { data: comp } = await supabase
            .from("user_companion")
            .select("care_pattern")
            .eq("id", consequence.companion_id)
            .single();
          
          await supabase
            .from("user_companion")
            .update({
              care_pattern: {
                ...(comp?.care_pattern ?? {}),
                dialogue_tone: consequence.payload.tone,
              },
            })
            .eq("id", consequence.companion_id);
          break;

        case "evolution_branch":
          await supabase
            .from("user_companion")
            .update({
              evolution_path: consequence.payload.path,
              evolution_path_locked: true,
            })
            .eq("id", consequence.companion_id);
          break;

        case "dormancy_warning":
          const { data: comp2 } = await supabase
            .from("user_companion")
            .select("care_pattern")
            .eq("id", consequence.companion_id)
            .single();
          
          await supabase
            .from("user_companion")
            .update({
              care_pattern: {
                ...(comp2?.care_pattern ?? {}),
                dormancy_warning: true,
                days_until_dormancy: consequence.payload.days_until_dormancy,
              },
            })
            .eq("id", consequence.companion_id);
          break;
      }

      await supabase
        .from("companion_pending_consequences")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("id", consequence.id);

      processed++;
    } catch (e) {
      console.error(`Failed to process consequence ${consequence.id}:`, e);
    }
  }

  return processed;
}

// =============================================
// STREAK FREEZE
// =============================================

async function handleStreakFreeze(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("current_habit_streak, streak_freezes_available, streak_at_risk, streak_at_risk_since")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) return;
  if ((profile.current_habit_streak ?? 0) <= 0) return;

  if (profile.streak_at_risk && profile.streak_at_risk_since) {
    const riskSince = new Date(profile.streak_at_risk_since);
    const hoursSinceRisk = (Date.now() - riskSince.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceRisk >= 24) {
      if ((profile.streak_freezes_available ?? 0) > 0) {
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
    return;
  }

  await supabase
    .from("profiles")
    .update({
      streak_at_risk: true,
      streak_at_risk_since: new Date().toISOString(),
    })
    .eq("id", userId);
}

async function resetExpiredStreakFreezes(supabase: any, today: string) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, streak_freezes_reset_at")
    .lt("streak_freezes_reset_at", today);

  for (const profile of profiles || []) {
    const nextReset = new Date();
    nextReset.setDate(nextReset.getDate() + 7);
    
    await supabase
      .from("profiles")
      .update({
        streak_freezes_available: 1,
        streak_freezes_reset_at: nextReset.toISOString().split("T")[0],
      })
      .eq("id", profile.id);
  }
}
