# XP Timetable Analysis (Synthetic V1 Rebalance)

This report evaluates the V1 rebalance against the synthetic baseline.

## V1 Parameters
- Habit XP: `8/12/18 -> 10/14/20`
- All-habits bonus: `12 -> 20`
- Repeatable cap: `220 -> 260`
- Post-cap multiplier: `0.2 -> 0.35`
- Quest base rewards unchanged: `12/16/22`
- Focus-session reward structure unchanged

## Repro
```bash
node scripts/xp-timetable-sim.mjs --mode v1
```

## V1 Outputs

### Daily XP per user
- Light: `72.0`
- Regular: `219.0`
- Power: `373.0`
- Blended average: `146.2`

### Stage pacing (days to threshold)
- Light: S5 `11.1`, S10 `75.0`, S15 `236.1`, S20 `527.8`
- Regular: S5 `3.7`, S10 `24.7`, S15 `77.6`, S20 `173.5`
- Power: S5 `2.1`, S10 `14.5`, S15 `45.6`, S20 `101.9`
- Blended: S5 `5.5`, S10 `36.9`, S15 `116.3`, S20 `259.9`

### Cap-loss diagnostics
- Light: raw repeatable `48`, awarded `48`, loss `0` (`0.0%`)
- Regular: raw repeatable `165`, awarded `165`, loss `0` (`0.0%`)
- Power: raw repeatable `379`, awarded `301`, loss `78` (`20.6%`), first capped hour `16:00`

### Hourly concentration (top 8)
- `09:00` -> `19.4%`
- `21:00` -> `10.3%`
- `18:00` -> `7.6%`
- `20:00` -> `7.3%`
- `15:00` -> `6.9%`
- `17:00` -> `6.0%`
- `11:00` -> `5.7%`
- `13:00` -> `5.7%`

### Source distribution
- Quests: `37.8%`
- Focus: `21.7%`
- Habits: `14.6%`
- Missions: `9.4%`
- Pep Talk: `5.5%`
- All Habits bonus: `5.5%`
- Check-in: `2.7%`
- Reflection: `2.7%`

## Delta vs Baseline
- Blended daily XP: `135.0 -> 146.2` (`+8.3%`)
- Blended Stage 10 pacing: `40.0d -> 36.9d`
- Blended Stage 20 pacing: `281.5d -> 259.9d`
- Power-user cap loss: `123 -> 78` (`-36.6%`)
- Quest share: `40.0% -> 37.8%`
- Habit share: `13.2% -> 14.6%`
- `all_habits` share: `3.6% -> 5.5%`

## Interpretation
- Progression pacing improves while preserving quest as the largest XP source.
- Consistency incentives (habits + all-habits) become materially stronger.
- Late-day truncation pressure drops for high-usage behavior, reducing discouraging post-cap rewards.
