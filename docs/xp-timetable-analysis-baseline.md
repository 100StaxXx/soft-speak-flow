# XP Timetable Analysis (Synthetic Baseline)

This report documents the synthetic baseline before the V1 rebalance.

## Scope
- Data source: synthetic modeled users (no production telemetry)
- Window: 30 days
- Local timetable granularity: hourly
- Cohort mix: 60% light / 30% regular / 10% power
- Repeatable-cap behavior: mirrors `award_xp_v2` (`cap=220`, `post-cap=0.2`)

## Repro
```bash
node scripts/xp-timetable-sim.mjs --mode baseline
```

## Baseline Outputs

### Daily XP per user
- Light: `70.0`
- Regular: `205.0`
- Power: `315.0`
- Blended average: `135.0`

### Stage pacing (days to threshold)
- Light: S5 `11.4`, S10 `77.1`, S15 `242.9`, S20 `542.9`
- Regular: S5 `3.9`, S10 `26.3`, S15 `82.9`, S20 `185.4`
- Power: S5 `2.5`, S10 `17.1`, S15 `54.0`, S20 `120.6`
- Blended: S5 `5.9`, S10 `40.0`, S15 `125.9`, S20 `281.5`

### Cap-loss diagnostics
- Light: raw repeatable `46`, awarded `46`, loss `0` (`0.0%`)
- Regular: raw repeatable `159`, awarded `159`, loss `0` (`0.0%`)
- Power: raw repeatable `374`, awarded `251`, loss `123` (`32.9%`), first capped hour `15:00`

### Hourly concentration (top 8)
- `09:00` -> `21.0%`
- `20:00` -> `7.9%`
- `21:00` -> `7.9%`
- `18:00` -> `7.3%`
- `15:00` -> `6.8%`
- `17:00` -> `6.4%`
- `11:00` -> `6.2%`
- `12:00` -> `6.0%`

### Source distribution
- Quests: `40.0%`
- Focus: `21.2%`
- Habits: `13.2%`
- Missions: `10.2%`
- Pep Talk: `5.9%`
- All Habits bonus: `3.6%`
- Check-in: `3.0%`
- Reflection: `3.0%`

## Interpretation
- XP is concentrated around a morning quest spike (`09:00`) with secondary evening bursts.
- Habit contribution is lower than the retention goal for consistency-oriented progression.
- Power-user sessions are materially penalized after mid-afternoon due to repeatable-cap truncation.
