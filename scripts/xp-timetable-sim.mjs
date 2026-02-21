#!/usr/bin/env node

/**
 * Synthetic XP timetable simulator.
 *
 * Models a 30-day local-time usage profile with cohort mix and applies the
 * same repeatable-cap math as award_xp_v2.
 *
 * Usage:
 *   node scripts/xp-timetable-sim.mjs
 *   node scripts/xp-timetable-sim.mjs --mode baseline
 *   node scripts/xp-timetable-sim.mjs --mode v1 --format json
 */

const COHORT_MIX = {
  light: 60,
  regular: 30,
  power: 10,
};

const REPEATABLE_EVENT_TYPES = new Set(["task_complete", "habit_complete", "focus_session"]);

const EVOLUTION_THRESHOLDS = {
  0: 0,
  1: 10,
  2: 100,
  3: 250,
  4: 450,
  5: 800,
  6: 1300,
  7: 2000,
  8: 2900,
  9: 4000,
  10: 5400,
  11: 7100,
  12: 9100,
  13: 11400,
  14: 14000,
  15: 17000,
  16: 20400,
  17: 24200,
  18: 28400,
  19: 33000,
  20: 38000,
};

const PROFILES = {
  baseline: {
    label: "Current Economy (Baseline)",
    habitXP: { easy: 8, medium: 12, hard: 18 },
    allHabitsBonusXP: 12,
    mainQuestMultiplier: 1.5,
    repeatableCap: 220,
    postCapMultiplier: 0.2,
  },
  v1: {
    label: "Rebalanced V1",
    habitXP: { easy: 10, medium: 14, hard: 20 },
    allHabitsBonusXP: 20,
    mainQuestMultiplier: 1.5,
    repeatableCap: 260,
    postCapMultiplier: 0.35,
  },
};

/**
 * Base synthetic schedules.
 * Raw quest/focus/mission values intentionally mirror modeled behavior.
 * Habit and all-habits values are computed from profile constants.
 */
const SCHEDULES = {
  light: [
    { hour: 7, minute: 0, source: "check_in", eventType: "check_in", kind: "fixed", value: 4 },
    { hour: 8, minute: 0, source: "pep_talk", eventType: "pep_talk_listen", kind: "fixed", value: 8 },
    { hour: 9, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 24 },
    { hour: 12, minute: 0, source: "mission", eventType: "mission_quick_win", kind: "fixed", value: 8 },
    { hour: 18, minute: 0, source: "habit", eventType: "habit_complete", kind: "habit", difficulty: "medium" },
    { hour: 21, minute: 0, source: "reflection", eventType: "evening_reflection", kind: "fixed", value: 4 },
    { hour: 22, minute: 0, source: "focus", eventType: "focus_session", kind: "fixed", value: 10 },
  ],
  regular: [
    { hour: 7, minute: 0, source: "check_in", eventType: "check_in", kind: "fixed", value: 4 },
    { hour: 8, minute: 0, source: "pep_talk", eventType: "pep_talk_listen", kind: "fixed", value: 8 },
    { hour: 9, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 30 },
    { hour: 11, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 20 },
    { hour: 13, minute: 0, source: "habit", eventType: "habit_complete", kind: "habit", difficulty: "medium", multiplier: 1.25 },
    { hour: 15, minute: 0, source: "focus", eventType: "focus_session", kind: "fixed", value: 25 },
    { hour: 17, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 28 },
    { hour: 18, minute: 0, source: "mission", eventType: "mission_identity", kind: "fixed", value: 8 },
    { hour: 19, minute: 0, source: "mission", eventType: "mission_connection", kind: "fixed", value: 10 },
    { hour: 20, minute: 0, source: "focus", eventType: "focus_session", kind: "fixed", value: 31 },
    { hour: 21, minute: 0, source: "habit", eventType: "habit_complete", kind: "habit", difficulty: "easy", multiplier: 1.25 },
    { hour: 21, minute: 30, source: "all_habits", eventType: "all_habits_complete", kind: "all_habits" },
    { hour: 22, minute: 0, source: "reflection", eventType: "evening_reflection", kind: "fixed", value: 4 },
  ],
  power: [
    { hour: 7, minute: 0, source: "check_in", eventType: "check_in", kind: "fixed", value: 4 },
    { hour: 8, minute: 0, source: "pep_talk", eventType: "pep_talk_listen", kind: "fixed", value: 8 },
    { hour: 9, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 50 },
    { hour: 10, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 33 },
    { hour: 10, minute: 30, source: "mission", eventType: "mission_growth", kind: "fixed", value: 12 },
    { hour: 11, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 24 },
    { hour: 12, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 33 },
    { hour: 13, minute: 0, source: "habit", eventType: "habit_complete", kind: "habit", difficulty: "hard", multiplier: 1.5 },
    { hour: 14, minute: 0, source: "focus", eventType: "focus_session", kind: "fixed", value: 38 },
    { hour: 14, minute: 30, source: "mission", eventType: "mission_identity", kind: "fixed", value: 12 },
    { hour: 15, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 26 },
    { hour: 16, minute: 0, source: "focus", eventType: "focus_session", kind: "fixed", value: 30 },
    { hour: 17, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 12 },
    { hour: 18, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 9 },
    { hour: 19, minute: 0, source: "focus", eventType: "focus_session", kind: "fixed", value: 38 },
    { hour: 20, minute: 0, source: "quest", eventType: "task_complete", kind: "fixed", value: 6 },
    { hour: 20, minute: 30, source: "mission", eventType: "mission_quick_win", kind: "fixed", value: 12 },
    { hour: 21, minute: 0, source: "habit", eventType: "habit_complete", kind: "habit", difficulty: "hard", multiplier: 1.0 },
    { hour: 21, minute: 30, source: "all_habits", eventType: "all_habits_complete", kind: "all_habits" },
    { hour: 22, minute: 0, source: "focus", eventType: "focus_session", kind: "fixed", value: 30 },
    { hour: 23, minute: 0, source: "reflection", eventType: "evening_reflection", kind: "fixed", value: 4 },
  ],
};

function parseArgs() {
  const args = process.argv.slice(2);
  let mode = "both";
  let format = "text";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--mode") {
      mode = args[i + 1] ?? mode;
      i += 1;
    } else if (arg === "--format") {
      format = args[i + 1] ?? format;
      i += 1;
    }
  }

  if (!["baseline", "v1", "both"].includes(mode)) {
    throw new Error(`Invalid --mode: ${mode}`);
  }
  if (!["text", "json"].includes(format)) {
    throw new Error(`Invalid --format: ${format}`);
  }

  return { mode, format };
}

function eventRawXP(event, profile) {
  if (event.kind === "fixed") return event.value;
  if (event.kind === "habit") {
    const multiplier = event.multiplier ?? 1;
    return Math.round(profile.habitXP[event.difficulty] * multiplier);
  }
  if (event.kind === "all_habits") return profile.allHabitsBonusXP;
  return 0;
}

function applyRepeatableCap(events, profile) {
  let repeatableXPSoFar = 0;
  let firstCapHour = null;

  const awarded = events
    .slice()
    .sort((a, b) => (a.hour - b.hour) || (a.minute - b.minute))
    .map((event) => {
      const rawXP = eventRawXP(event, profile);
      let awardedXP = rawXP;
      let capApplied = false;

      if (REPEATABLE_EVENT_TYPES.has(event.eventType) && awardedXP > 0) {
        if (repeatableXPSoFar >= profile.repeatableCap) {
          awardedXP = Math.max(0, Math.round(awardedXP * profile.postCapMultiplier));
          capApplied = true;
        } else if (repeatableXPSoFar + awardedXP > profile.repeatableCap) {
          const fullXPPortion = profile.repeatableCap - repeatableXPSoFar;
          const postCapXPPortion = awardedXP - fullXPPortion;
          awardedXP = Math.max(
            0,
            fullXPPortion + Math.round(postCapXPPortion * profile.postCapMultiplier),
          );
          capApplied = true;
        }

        repeatableXPSoFar += Math.max(0, awardedXP);
      }

      if (capApplied && firstCapHour === null) {
        firstCapHour = event.hour;
      }

      return {
        ...event,
        rawXP,
        awardedXP,
        capApplied,
      };
    });

  return {
    events: awarded,
    firstCapHour,
  };
}

function simulateCohortDay(cohortName, profile) {
  const schedule = SCHEDULES[cohortName];
  const { events, firstCapHour } = applyRepeatableCap(schedule, profile);

  const totalsBySource = {};
  let totalXP = 0;
  let rawRepeatable = 0;
  let awardedRepeatable = 0;
  let capEvents = 0;

  for (const event of events) {
    totalsBySource[event.source] = (totalsBySource[event.source] ?? 0) + event.awardedXP;
    totalXP += event.awardedXP;

    if (REPEATABLE_EVENT_TYPES.has(event.eventType)) {
      rawRepeatable += event.rawXP;
      awardedRepeatable += event.awardedXP;
    }

    if (event.capApplied) {
      capEvents += 1;
    }
  }

  return {
    totalXP,
    totalsBySource,
    hourlyXP: events.reduce((acc, event) => {
      acc[event.hour] = (acc[event.hour] ?? 0) + event.awardedXP;
      return acc;
    }, {}),
    capDiagnostics: {
      rawRepeatable,
      awardedRepeatable,
      capLoss: rawRepeatable - awardedRepeatable,
      capLossPct: rawRepeatable > 0 ? ((rawRepeatable - awardedRepeatable) / rawRepeatable) * 100 : 0,
      capEvents,
      firstCapHour,
    },
  };
}

function stageProjection(dailyXP) {
  const checkpoints = [5, 10, 15, 20];
  const out = {};
  for (const stage of checkpoints) {
    const threshold = EVOLUTION_THRESHOLDS[stage];
    out[`stage${stage}`] = threshold / dailyXP;
  }
  return out;
}

function simulatePopulation(profileKey) {
  const profile = PROFILES[profileKey];
  const cohortResults = {
    light: simulateCohortDay("light", profile),
    regular: simulateCohortDay("regular", profile),
    power: simulateCohortDay("power", profile),
  };

  const weightedHourly = Array.from({ length: 24 }, (_, hour) => ({ hour, xp: 0 }));
  const weightedSources = {};
  let weightedDailyTotal = 0;

  for (const [cohort, weight] of Object.entries(COHORT_MIX)) {
    const result = cohortResults[cohort];
    weightedDailyTotal += result.totalXP * weight;

    for (const [source, xp] of Object.entries(result.totalsBySource)) {
      weightedSources[source] = (weightedSources[source] ?? 0) + xp * weight;
    }

    for (const [hourString, xp] of Object.entries(result.hourlyXP)) {
      const hour = Number(hourString);
      weightedHourly[hour].xp += xp * weight;
    }
  }

  const populationSize = Object.values(COHORT_MIX).reduce((acc, x) => acc + x, 0);
  const avgDailyXPPerUser = weightedDailyTotal / populationSize;

  const sourceDistribution = Object.entries(weightedSources)
    .map(([source, xp]) => ({
      source,
      xp,
      pct: (xp / weightedDailyTotal) * 100,
    }))
    .sort((a, b) => b.xp - a.xp);

  const hourlyDistribution = weightedHourly
    .filter((item) => item.xp > 0)
    .map((item) => ({
      ...item,
      pct: (item.xp / weightedDailyTotal) * 100,
    }))
    .sort((a, b) => a.hour - b.hour);

  const topHours = [...hourlyDistribution]
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 8);

  return {
    profileKey,
    label: profile.label,
    assumptions: {
      days: 30,
      cohortMix: COHORT_MIX,
      repeatableCap: profile.repeatableCap,
      postCapMultiplier: profile.postCapMultiplier,
      habitXP: profile.habitXP,
      allHabitsBonusXP: profile.allHabitsBonusXP,
    },
    dailyXP: {
      light: cohortResults.light.totalXP,
      regular: cohortResults.regular.totalXP,
      power: cohortResults.power.totalXP,
      blended: avgDailyXPPerUser,
    },
    stageProjectionDays: {
      light: stageProjection(cohortResults.light.totalXP),
      regular: stageProjection(cohortResults.regular.totalXP),
      power: stageProjection(cohortResults.power.totalXP),
      blended: stageProjection(avgDailyXPPerUser),
    },
    capDiagnostics: {
      light: cohortResults.light.capDiagnostics,
      regular: cohortResults.regular.capDiagnostics,
      power: cohortResults.power.capDiagnostics,
    },
    hourlyDistribution,
    topHours,
    sourceDistribution,
    totals: {
      dailyPopulationXP: weightedDailyTotal,
      dailyAvgPerUser: avgDailyXPPerUser,
      total30dPopulationXP: weightedDailyTotal * 30,
      total30dAvgPerUser: avgDailyXPPerUser * 30,
    },
  };
}

function formatNumber(value, digits = 1) {
  return Number(value).toFixed(digits);
}

function renderText(report) {
  const lines = [];
  lines.push(`# ${report.label}`);
  lines.push("");
  lines.push("## Assumptions");
  lines.push(`- Days modeled: ${report.assumptions.days}`);
  lines.push(`- Cohort mix (light/regular/power): ${report.assumptions.cohortMix.light}/${report.assumptions.cohortMix.regular}/${report.assumptions.cohortMix.power}`);
  lines.push(`- Repeatable cap: ${report.assumptions.repeatableCap}`);
  lines.push(`- Post-cap multiplier: ${report.assumptions.postCapMultiplier}`);
  lines.push(`- Habit XP (easy/medium/hard): ${report.assumptions.habitXP.easy}/${report.assumptions.habitXP.medium}/${report.assumptions.habitXP.hard}`);
  lines.push(`- All-habits bonus XP: ${report.assumptions.allHabitsBonusXP}`);
  lines.push("");

  lines.push("## Daily XP Per User");
  lines.push(`- Light: ${formatNumber(report.dailyXP.light, 1)}`);
  lines.push(`- Regular: ${formatNumber(report.dailyXP.regular, 1)}`);
  lines.push(`- Power: ${formatNumber(report.dailyXP.power, 1)}`);
  lines.push(`- Blended average: ${formatNumber(report.dailyXP.blended, 1)}`);
  lines.push("");

  lines.push("## Stage Pacing (Days to Reach Threshold)");
  for (const cohort of ["light", "regular", "power", "blended"]) {
    const row = report.stageProjectionDays[cohort];
    lines.push(`- ${cohort}: S5=${formatNumber(row.stage5, 1)} S10=${formatNumber(row.stage10, 1)} S15=${formatNumber(row.stage15, 1)} S20=${formatNumber(row.stage20, 1)}`);
  }
  lines.push("");

  lines.push("## Cap-Loss Diagnostics");
  for (const cohort of ["light", "regular", "power"]) {
    const diag = report.capDiagnostics[cohort];
    lines.push(`- ${cohort}: raw_repeatable=${diag.rawRepeatable} awarded_repeatable=${diag.awardedRepeatable} cap_loss=${diag.capLoss} (${formatNumber(diag.capLossPct, 1)}%) first_cap_hour=${diag.firstCapHour ?? "none"} cap_events=${diag.capEvents}`);
  }
  lines.push("");

  lines.push("## Hourly Distribution (Local Time)");
  for (const row of report.hourlyDistribution) {
    const hourLabel = String(row.hour).padStart(2, "0");
    lines.push(`- ${hourLabel}:00 -> ${formatNumber(row.xp, 0)} XP (${formatNumber(row.pct, 1)}%)`);
  }
  lines.push("");

  lines.push("## Top Hours");
  for (const row of report.topHours) {
    const hourLabel = String(row.hour).padStart(2, "0");
    lines.push(`- ${hourLabel}:00 -> ${formatNumber(row.pct, 1)}%`);
  }
  lines.push("");

  lines.push("## Source Distribution");
  for (const row of report.sourceDistribution) {
    lines.push(`- ${row.source}: ${formatNumber(row.xp, 0)} XP (${formatNumber(row.pct, 1)}%)`);
  }
  lines.push("");

  lines.push("## 30-Day Totals");
  lines.push(`- Population total XP (100 synthetic users): ${formatNumber(report.totals.total30dPopulationXP, 0)}`);
  lines.push(`- Avg XP per user over 30 days: ${formatNumber(report.totals.total30dAvgPerUser, 1)}`);

  return lines.join("\n");
}

function main() {
  const { mode, format } = parseArgs();

  const keys = mode === "both" ? ["baseline", "v1"] : [mode];
  const reports = keys.map(simulatePopulation);

  if (format === "json") {
    console.log(JSON.stringify({ reports }, null, 2));
    return;
  }

  const blocks = reports.map(renderText);
  console.log(blocks.join("\n\n---\n\n"));
}

main();
