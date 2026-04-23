# Cosmiq AI Companion Spec

Last updated: 2026-04-23

## Purpose

This spec defines how the AI companion and planner should work inside Cosmiq using the architecture that already exists:

- normalized domain concepts such as Campaign, Quest, and Ritual
- adapter and read-model layers
- `companion-agent` as the orchestration layer
- `companion_pending_actions` as the confirmation boundary
- Supabase as the system of record

Non-negotiable rule:

- AI proposes
- server validates
- Supabase persists

The goal is not to bolt AI onto a planner. The goal is to make Cosmiq feel like a daily ritual system that users return to automatically.

Open -> Engage -> Progress -> Feel something -> Come back

## Product Thesis

Cosmiq should feel like a calm strategist, a game master, and a coach in one system.

The companion's job is to:

- understand the reality of the user's day
- identify what matters most right now
- turn campaigns into concrete quests
- shape a realistic schedule around time, energy, and momentum
- help recover when the day goes off track
- make progress feel meaningful, visible, and personal

It should not:

- dump long generic task lists
- create fantasy schedules that ignore calendar reality
- force too many clarifying questions
- write directly to domain tables
- feel like a chatbot that happens to know about tasks

## Design Principles

1. Daily ritual beats feature breadth.
   If the user only does one thing in Cosmiq each day, that thing should be worth coming back for.

2. Meaning beats volume.
   The assistant should usually surface 3 to 5 meaningful quests, not 12 vague obligations.

3. Reality beats optimism.
   Calendar commitments, current time, energy, and historical follow-through should outweigh idealized plans.

4. Progress must feel earned and visible.
   Suggestions should connect quests to campaign progress, streaks, stats, or future identity.

5. Conversation should lead to action, not replace it.
   The companion can coach, clarify, and motivate, but it should always orient toward a useful next move.

6. User control stays intact.
   The user steers. The AI recommends. All writes flow through confirmation and server validation.

## 1. Core Assistant Behavior

### Primary role

The companion is a decision-support layer over the user's life system, not just a conversational layer over stored data.

Its core behavior should combine five jobs:

- Planner: reads time, commitments, quests, campaigns, rituals, and momentum.
- Prioritizer: decides what matters now and what should wait.
- Scheduler: proposes where work should actually fit.
- Coach: explains why a quest matters in a way that creates emotional buy-in.
- Reflector: turns check-ins and journaling into better next-day planning.

### Conversation vs action

The assistant should balance warmth and utility by using the current mode model intentionally:

| Mode | Purpose | When to use it |
| --- | --- | --- |
| `schedule_read` | Read-only planning answers | "What do I have coming up?", "When am I free?", "How packed is today?" |
| `conversation` | Coaching, guidance, sense-making | "I feel behind", "What should I focus on?", "Help me think" |
| `clarify` | Short high-value questions | Only when the answer changes the plan shape in a meaningful way |
| `pending_confirmation` | Drafted write awaiting approval | Create/update quest, campaign, ritual, reminder, journal entry |
| `receipt` | Action aftermath | After confirm/cancel/execute, plus a next-step nudge |

### Clarification policy

The assistant should ask questions sparingly. Good clarifying questions are things like:

- "Do you want a lock-in day, a balanced day, or a recovery day?"
- "Is this a must-do today or can it move?"
- "Should I tie this to your campaign or keep it standalone?"

The assistant should not ask for details it can infer from existing context unless wrong assumptions would materially harm the plan.

### Personality vs planning logic

Companion tone can vary by mode or personality, but planning logic should stay consistent. Humor, hype, or softness can change delivery. They should never obscure:

- what the assistant is recommending
- why it matters
- what requires confirmation
- what will happen if confirmed

## 2. Daily Ritual Loops

These loops should connect into one continuous system, not operate as isolated features.

### 1. Start My Day

This is the primary retention loop and should become Cosmiq's home base.

The flow:

- User opens Cosmiq and starts `Plan My Day`
- AI reads calendar, active campaigns, unfinished quests, rituals, reflection signals, planner memory, and current time
- AI returns a realistic plan for today with 3 to 5 recommended quests

Each recommended quest should answer:

- What is it?
- Why today?
- Why does it matter?
- What larger campaign, streak, stat, or future outcome does it support?

### 2. Midday Adjust

This is the rescue loop.

The flow:

- User realizes the day changed, energy crashed, or tasks slipped
- AI reads current time plus remaining load
- AI proposes what to keep, move, shrink, or drop

This keeps the system trustworthy. A great planner is not the one that makes a perfect morning plan. It is the one that recovers well at 2:40 PM.

### 3. Quest Completion

This is the reinforcement loop.

When a quest is completed, the AI should react in a way that reinforces:

- immediate progress
- why the quest mattered
- how it changes the user's day or campaign trajectory

The AI does not need to own completion writes to be part of this loop. It should contextualize the win.

### 4. Evening Reflection

This is the learning loop.

The flow:

- User reflects on wins, misses, and how the day felt
- AI extracts tomorrow-relevant insight
- Tomorrow's plan uses that signal

Reflection should influence planning, not just store text.

### 5. Weekly Realignment

This is the anti-drift loop.

Once a week, the assistant should help the user:

- review campaign movement
- spot stalled or overloaded campaigns
- identify the next meaningful step
- adjust scope or timing when reality says the original plan no longer fits

## 3. Key Surfaces

The current surfaces are directionally right. They should be refined into a tighter operating set.

| Surface | Role | Outcome |
| --- | --- | --- |
| `Plan My Day` | Main morning ritual | Daily priorities, suggested quest set, schedule shape, fallback plan |
| `What Do I Have Coming Up` | Fast situational awareness | Next event, remaining day, missed items, free windows, next best move |
| `Quest` | Fast capture | Turn natural language into a quest draft with minimal friction |
| `Adjust My Day` | Midday rescue | Reprioritize, reschedule, lighten, or make room |
| `Advance My Campaign` | Goal translation | Break a campaign into next steps, supporting ritual, or campaign adjustment |
| `Evening Reflection` | Learning + closure | Capture wins, misses, tomorrow adjustment, and emotional state |
| `Plan My Week` | Weekly realignment | Focus themes, campaign pressure, intentional scheduling for the next 7 days |

### Surface recommendations

#### `Plan My Day`

Keep this as the flagship experience.

It should return:

- a short day framing message
- one clear "today's win condition"
- 3 to 5 suggested quests
- a schedule shape, not just a list
- a backup plan if the day is overloaded or energy is low

#### `What Do I Have Coming Up`

Keep it, but make it more tactical.

It should answer:

- what is next
- what remains today
- what I already missed
- where I have room
- what the next best quest is between now and the next hard commitment

#### `Quest`

Refine this into `Capture Quest`.

This surface should excel at:

- voice or text brain dumps
- turning intent into one clean quest draft
- optionally linking to a campaign
- asking at most one follow-up if timing or campaign-link matters

#### `Adjust My Day`

This should become a first-class surface, not just a secondary action.

It maps well to existing planner intents like:

- `what_matters`
- `adjust_today`
- `low_energy_adjust`
- `make_room`

This is where the planner proves it understands reality.

#### `Advance My Campaign`

This should turn long-term goals into daily movement.

It should handle:

- "What is the next step for this campaign?"
- "Break this goal down for me."
- "I am stuck on this."
- "This campaign is slipping. Help me fix it."

#### `Evening Reflection`

This already exists conceptually and should stay connected to the planner.

Its planning job is to extract:

- energy truth
- emotional friction
- wins worth reinforcing
- tomorrow adjustments

#### `Plan My Week`

Add this as a secondary but strategic surface.

It should summarize:

- campaign pressure for the week
- major fixed commitments
- likely overload zones
- one or two weekly focus themes

## 4. Planner and Scheduler Logic

This is the core intelligence layer.

The planner should operate as a five-step loop:

### 1. Understand the day

The assistant should build a realistic picture of the user's day from:

- current date, time, and timezone
- visible date range or planning horizon
- calendar events and hard commitments
- scheduled quests and unscheduled inbox quests
- active campaigns and rituals
- reflection and check-in signals
- planner memory such as wake time, wind-down time, preferred windows, and workload tolerance
- learned AI signals such as common contexts or suggested workload
- selected entities and current thread context

### 2. Calculate real capacity

The assistant should estimate how much room actually exists.

Capacity should be shaped by:

- available minutes between wake and wind-down
- occupied time from calendar and scheduled quests
- existing conflicts or overload
- current time, not just the full day
- intensity of existing work
- recent or explicit energy signals
- user tolerance for light, normal, or heavy days

### 3. Rank what matters

Candidate work should be ranked across multiple dimensions, not just deadline urgency:

- hard commitments and overdue tasks
- campaign leverage: what most meaningfully moves a campaign forward
- ritual and streak protection
- effort-to-slot fit: can this actually fit where room exists
- energy fit: deep work when strong, admin when tired
- momentum recovery: what gets the user unstuck
- relationship or life-admin pressure when relevant

### 4. Shape the day

The planner should build a day with layers:

- anchors: fixed calendar events and immovable commitments
- progress moves: 1 to 2 meaningful campaign-advancing quests
- maintenance: admin, rituals, or support tasks
- recovery: breathing room, breaks, or lighter work when needed

Good daily plans should:

- cap visible recommended work at 3 to 5 quests
- avoid stacking too many hard tasks back to back
- reserve slack so one slip does not destroy the full plan
- protect the most meaningful work before filling in low-value tasks

### 5. Adapt when reality changes

When the day changes, the planner should not simply leave missed work behind.

It should intelligently choose whether to:

- keep the quest where it is
- move it later today
- move it to tomorrow
- split it into a smaller quest
- convert it into a ritual or recurring pattern
- reduce scope
- trigger a campaign adjustment suggestion if repeated misses show the campaign plan is unrealistic

### Day modes

The assistant should support three explicit planning modes:

| Mode | Use when | Planning behavior |
| --- | --- | --- |
| Lock In | High energy, important push day | Protect 1 to 2 high-value focus blocks and minimize everything else |
| Balanced | Normal day | Mix progress, maintenance, and recovery |
| Recovery | Low energy, stressed, overloaded | Preserve essentials, lighten load, reduce guilt, and prevent collapse |

These modes can be inferred or selected with a single quick question. They should influence prioritization and schedule density, not just copy.

## 5. Campaign and Quest Intelligence

### Campaign intelligence

Campaigns are the long-term guidance system. The assistant should make every active campaign feel alive.

For each active campaign, the planner should be able to infer:

- current momentum: moving, drifting, blocked, or at risk
- next meaningful step
- whether progress is best driven by a one-off quest, a ritual, or a plan adjustment
- whether the campaign is realistic relative to the user's actual time and follow-through

### Campaign breakdown behavior

The AI should turn campaigns into action by moving through this chain:

campaign -> current frontier -> next step -> schedulable quest

When useful, it should also propose:

- a supporting ritual
- a campaign update
- a campaign adjustment when the original plan is slipping

### Stagnation prevention

The assistant should proactively fight stagnation by detecting patterns such as:

- no campaign-linked progress in several days
- campaign deadline approaching with weak momentum
- repeated reschedules of the same quest
- quests that are too vague or too large to start
- too many active campaigns competing for limited capacity

When stagnation is detected, the assistant should favor:

- smaller next actions
- clearer quest wording
- scope reduction
- ritual support for consistency
- campaign adjustment over fake optimism

### Quest intelligence

The assistant should treat quests as flexible action units, not static to-dos.

It should recognize when a quest needs to be:

- created
- clarified
- linked to a campaign
- broken into subtasks
- rescheduled
- updated
- turned into a recurring ritual
- deprioritized or removed from today

One key rule:

The AI should not reward vague ambition. If a quest is too big to schedule honestly, it should propose a smaller, winnable version.

## 6. AI Interaction and Action Model

### What the AI can suggest without confirmation

These are read-only or advisory:

- daily priorities
- schedule summaries
- free-window analysis
- quest recommendations
- campaign next-step advice
- rescheduling suggestions
- lighter/heavier day recommendations
- reflection prompts
- momentum, streak, and progress framing

### What the AI can draft through `companion_pending_actions`

These should remain within the current write boundary:

- create quest
- update quest
- create campaign
- update campaign
- adjust campaign plan
- create ritual
- update ritual
- create reminder
- save journal entry

### Confirmation rules

Every domain write requires explicit confirmation.

That includes:

- creating a new quest from a suggestion
- moving or editing an existing quest
- changing a campaign
- creating or updating rituals
- saving a journal entry from conversation text

Read-only schedule answers never require confirmation.

### How `companion_pending_actions` should be used

`companion_pending_actions` should remain the single mutation boundary for AI-authored changes.

The expected behavior:

- AI produces a proposed change with a clear summary and confirmation message
- server normalizes the payload into a supported action type
- pending action is persisted for the thread
- user confirms or cancels
- server validates again at execution time
- Supabase is updated through existing server-side execution paths
- assistant returns a receipt and refreshed next-step guidance

Important UX rule:

`Plan My Day` can feel like batch planning, but the backend should stay honest. Suggested quests can be selected in bulk in the UI, yet confirmation should still serialize through existing validated quest creation or update flows. The user may experience "confirm selected", but the architecture should still respect the current action model.

## 7. Input and Output Design

### Input context

At a high level, the AI should be grounded with:

- current date and time with timezone
- selected horizon and visible date window
- current surface or starter intent
- scheduled quests and inbox quests
- active campaigns
- rituals
- calendar events
- reflection/check-in signals
- planner memory and learned preference signals
- thread history and selected entity ids
- current pending action state, if any

The model should prefer normalized read-model context, not raw storage complexity.

### Output shape

The assistant should continue returning:

- natural-language reply
- mode
- intent
- confidence
- optional structured response
- optional proposal or action hint data
- optional lightweight planner-memory updates for learned preferences
- optional pending action
- receipt after execution

### Structured output direction

The current structured output is a good base. It should stay additive and surface-oriented rather than becoming one giant opaque blob.

Recommended direction:

- `planDay`
  - day assessment
  - today's win condition
  - suggested quests
  - schedule shape
  - overload warnings
  - backup plan
- `comingUp`
  - next event
  - remaining today
  - missed items
  - free windows
  - next best quest
- future optional blocks
  - `dayAdjust`
  - `campaignMomentum`
  - `weeklyPlan`
  - `reflectionBridge`

### Proposal payload expectations

When the AI drafts action candidates, the structured payload should be concrete enough for server validation and preview.

That means including things like:

- target entity ids when updating
- title and schedule fields for quests
- cadence/time preferences for rituals
- campaign ids and adjustment intent when reshaping goals

If the UI shows XP, stat impact, or schedule placement, it should come from validated preview data or deterministic server-side logic, not hallucinated model text.

## 8. Overall System Flow

1. User enters through a surface such as `Plan My Day`, `Coming Up`, `Capture Quest`, `Adjust My Day`, or `Advance My Campaign`.
2. Client sends message, surface, time context, visible horizon, and selected entity ids to `companion-agent`.
3. Server loads normalized context from Supabase and read models: quests, campaigns, rituals, calendar, reflections, planner memory, pending action state, and recent thread messages.
4. Planner logic computes schedule insights, open slots, overload signals, and priority scores.
5. AI produces a response in the correct mode:
   - read-only guidance
   - clarification
   - draft proposal
   - confirmation state
   - receipt
6. UI renders the conversational reply plus structured planning cards.
7. If the user confirms a drafted action, the server validates the normalized payload and executes the supported write path.
8. Supabase persists the result.
9. Thread state, pending action state, and read models refresh.
10. Assistant responds with a receipt plus the next relevant suggestion so the flow continues naturally.

## 9. Recommended Product Behavior by Surface

### `Plan My Day`

Default output pattern:

- one sentence that frames the day
- one "today's win" objective
- 3 to 5 suggested quests, each with meaning and timing guidance
- a lighter fallback if the day is already overloaded

### `Coming Up`

Default output pattern:

- next hard commitment
- what fits before it
- what is at risk later today
- what the user should do next if they have room now

### `Adjust My Day`

Default output pattern:

- keep
- move
- drop or shrink
- confirmable updates for any concrete changes

### `Advance My Campaign`

Default output pattern:

- campaign status in plain English
- next meaningful step
- whether to create a quest, create a ritual, or adjust the campaign plan

### `Evening Reflection`

Default output pattern:

- acknowledge the day honestly
- capture one win, one friction point, one tomorrow adjustment
- feed tomorrow-adjustment signal back into planning

## 10. Build Priority

If this is built in stages, the recommended order is:

1. Nail the daily loop.
   `Plan My Day`, `Coming Up`, `Adjust My Day`, and per-quest confirmations should feel excellent first.

2. Make campaigns feel alive.
   Add campaign-next-step logic, stagnation detection, and campaign-adjust suggestions.

3. Tighten the learning loop.
   Make reflection signals and planner memory materially improve tomorrow's plan.

4. Add weekly realignment.
   `Plan My Week` should become the bridge between campaigns and daily execution.

## Final Product Standard

Cosmiq should feel like a system that knows:

- what the user cares about
- what today really allows
- what the next meaningful move is
- how to recover when reality changes

If the assistant consistently helps the user start the day clearly, recover gracefully, and feel progress emotionally, Cosmiq will feel less like a planner and more like a life system.
