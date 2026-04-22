# Cosmiq Architecture Audit

Last updated: 2026-04-22

## Summary
- This pass documents the current state only. No code, schema, naming, or behavior changes are proposed as already-implemented.
- The audit is grounded in:
  - `src/integrations/supabase/types.ts` for generated table fields and relationships
  - `src/pages`, `src/hooks`, `src/services`, `src/types`, and `supabase/functions` for current read/write ownership and naming
  - selected migrations and docs where schema drift or legacy paths are visible from the repo
- Scope includes the productivity model plus AI-facing companion surfaces.
- Scope excludes the broader companion evolution/image/story/gameplay domain unless it directly affects memory or AI activity.
- `habits` / rituals are treated as an adjacent support domain, not force-fit into the eight target buckets yet.

## Method
- Behavior-first inventory, not file-first inventory
- Focus domains:
  1. Planning / quests
  2. Campaigns
  3. Journal / reflection
  4. Calendar / scheduling
  5. Memory
  6. AI activity
  7. Adjacent rituals / habits
- Special attention to normalization hotspots:
  - `daily_tasks`
  - `epics`
  - `user_reflections` / `evening_reflections` / `daily_check_ins`
  - `external_calendar_events` plus provider link tables
  - `user_ai_*` plus `companion_*` AI surfaces
  - the dual assistant stack: `companion-chat` / legacy planner vs `companion-agent`

## Non-Goals
- No refactor
- No schema migration
- No code rename
- No endpoint consolidation
- No attempt to redesign the full companion gameplay domain

## Current-State Architecture Summary
- `profiles` (see `src/integrations/supabase/types.ts ~L5727`) is the root user record, but user-owned settings are already split across `profiles`, `daily_planning_preferences`, `calendar_user_settings`, and `user_ai_preferences`.
- Quest planning is local-first and sync-backed. Core task hooks like `useTasksQuery`, `useCalendarTasks`, `useInboxTasks`, `useEpics`, and `useSubtasks` read from the local planner store first, then refresh from Supabase. This means the effective runtime data model is not just the database schema; it is the schema plus local cache/queue semantics.
- `daily_tasks` (see `src/integrations/supabase/types.ts ~L2696`; 42 columns in `Row`) is the operational center of the quest system, but it is overloaded. One row currently mixes quest identity, inbox vs scheduled state, reminders, recurrence, habit linkage, campaign linkage, milestone linkage, AI-generated state, attachments, and timeline ordering.
- Campaigns are already a user-facing concept, but the storage and hook layer still call them `epics`. Related structures also continue the old vocabulary: `epic_habits`, `epic_milestones`, `epic_journey_paths`, `journey_phases`, `useEpics`, `epicsQuery`.
- Journal-like data is split across three different tables with different semantics and AI reply paths:
  - `user_reflections`
  - `evening_reflections`
  - `daily_check_ins`
- Calendar/scheduling is split across:
  - connection/config tables
  - mirrored provider events
  - quest-to-calendar event links
  - quest-to-Outlook To Do links
  - planner-side read models that flatten those pieces back together
- AI-facing state is also split by purpose:
  - learned profile: `user_ai_learning`, `user_ai_preferences`
  - telemetry and validation: `ai_interactions`, `ai_output_validation_log`
  - chat persistence: `companion_chats`, `companion_chat_threads`
  - pending write intent: `companion_pending_actions`
  - specialized memory: `companion_memories`
- There are two concurrent assistant stacks:
  - older `companion-chat` plus legacy planner/handoff logic
  - newer `companion-agent` with structured response and pending-action execution
- OpenAI is not the system of record today, but the storage boundary is still muddy because the AI layer spans conversation memory, learned preferences, pending mutations, telemetry, and direct execution into domain tables.

## Supabase Truth vs AI State

| Category | Current objects | What they represent now | Notes |
| --- | --- | --- | --- |
| Supabase-owned truth | `profiles`, `daily_tasks`, `subtasks`, `task_dependencies`, `epics`, `epic_habits`, `epic_milestones`, `journey_phases`, `external_calendar_events`, `user_calendar_connections`, `calendar_user_settings`, `quest_calendar_links`, `quest_outlook_task_links`, `user_reflections`, `evening_reflections`, `daily_check_ins`, `habits`, `personal_quest_templates`, `task_attachments` | Primary user/productivity data | This is the data the app ultimately acts on |
| User-owned preference truth | `daily_planning_preferences`, parts of `profiles`, parts of `calendar_user_settings` | Settings and planning preferences | Belongs to the user model, not AI telemetry |
| Learned AI profile | `user_ai_learning`, `user_ai_preferences` | Inferred patterns, preference weights, response style, companion mode | Memory-like, but not durable canonical user truth |
| AI telemetry / validation | `ai_interactions`, `ai_output_validation_log`, `daily_planning_usage` | Analytics, validation records, usage data | Should not be treated as reusable product memory |
| AI chat persistence | `companion_chats`, `companion_chat_threads` | Stored conversation turns and thread metadata | Conversation history, not domain truth |
| Pending write intent | `companion_pending_actions` | Structured AI-proposed changes awaiting confirmation or execution | This is not truth until executed |
| Specialized memory | `companion_memories` | Companion-specific remembered moments | Real memory, but narrow and companion-bound rather than generalized `memory_items` |

## Concept Duplication Map

| Product concept | Where it currently exists | What is confusing |
| --- | --- | --- |
| Campaign | UI copy says `Campaigns`; storage/hook names say `epics`; campaign visuals say `journey paths`; phases are `journey_phases` | One product noun is split across campaign/epic/journey language |
| Quest | UI says quest; storage table is `daily_tasks`; TS types include `DailyTask`, `CalendarTask`, `DragTask`, `TaskLite`; link tables say `quest_*`; endpoints say task/quest interchangeably | Quest and task are currently the same thing in some places and different things in naming only |
| Journal entry | `user_reflections`, `evening_reflections`, `daily_check_ins`, `Reflection.tsx`, `useEveningReflection` | Reflection, journal, gratitude, and check-in are overlapping but not formally separated |
| Memory | `companion_memories`, `user_ai_learning.conversation_profile`, `user_ai_preferences`, memory extraction inside `companion-chat` | “Memory” currently means at least three different storage behaviors |
| Planner | `useCompanionPlanner`, `companion-planner-chat`, `daily_planning_preferences`, `daily_plan_sessions`, `record-daily-planning-use` | Planner is both a product surface and a data/telemetry namespace |
| AI activity | `ai_interactions`, `ai_output_validation_log`, `companion_chats`, `companion_pending_actions` | Telemetry, chat persistence, learned preferences, and pending actions all live under the same broad umbrella |

## Domain Inventory

### 1. Planning / Quests

#### Persistence objects

| Item | Kind | Current purpose | Key fields / contract | Primary readers | Primary writers | Dependent features | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `daily_tasks` | table (`types.ts ~L2696`) | Main quest/task record for scheduled quests, inbox items, AI-created tasks, habit-linked tasks, and milestone-linked tasks | `42-column` row including `task_text`, `task_date`, `scheduled_time`, `estimated_duration`, `completed`, `is_main_quest`, `priority`, `source`, `epic_id`, `habit_source_id`, `context_id`, `recurrence_*`, `reminder_*`, `ai_generated`, `location`, `notes`, `image_url`, `parent_template_id`, `contact_id`, `xp_reward` from `src/integrations/supabase/types.ts` and `src/services/dailyTasksRemote.ts` | `src/services/dailyTasksRemote.ts`, `src/hooks/useTasksQuery.ts`, `src/hooks/useCalendarTasks.ts`, `src/hooks/useInboxTasks.ts`, `supabase/functions/companion-agent/agent.ts`, `supabase/functions/generate-smart-daily-plan/index.ts`, calendar sync functions | `src/hooks/useTaskMutations.ts`, `src/hooks/useInboxTasks.ts`, `supabase/functions/companion-agent/executor.ts`, `supabase/functions/google-calendar-events/index.ts`, `supabase/functions/outlook-calendar-events/index.ts`, `supabase/functions/outlook-todo-tasks/index.ts` | `src/pages/Journeys.tsx`, `src/pages/Inbox.tsx`, planner surfaces, reminders, weekly recap, calendar sync | Major normalization hotspot; one row mixes quest identity, schedule, reminders, recurrence, campaign link, habit link, milestone link, and AI metadata |
| `reminders` | table (`types.ts ~L6379`) | Legacy generic reminder slots stored separately from per-quest reminder fields on `daily_tasks` | `time_of_day`, `label`, `is_active`, `user_id`, `created_at` | little/no active runtime readership in the current app surface; mainly visible through schema ownership and delete-user cleanup paths | legacy reminder flows and migration-era writers | legacy reminder model and cleanup surface | Separate from the current quest reminder implementation, which mostly lives on `daily_tasks` plus the notifications pipeline |
| `task_reminders_log` | table (`types.ts ~L6917`) | Log of sent task reminder notifications | `task_id`, `reminder_sent_at`, `notification_status`, `user_id`, `created_at` | mainly schema lifecycle and cleanup paths in the current repo | historical reminder-delivery writers; older reminder tracking flows | reminder audit trail | Overlaps with `daily_tasks.reminder_sent`, `daily_tasks.start_notification_sent`, and the newer notification queue |
| `push_notification_queue` | table (`types.ts ~L5988`) | Outbound notification queue for quest reminders, start notifications, mentor nudges, quotes, and check-in prompts | `notification_type`, `scheduled_for`, `status`, `source_table`, `source_id`, `dedupe_key`, `payload`, `context`, `priority` | `supabase/functions/notifications-dispatch-v2/index.ts`, `src/components/PushNotificationSettings.tsx` | `supabase/functions/notifications-enqueue-v2/index.ts`, `supabase/functions/generate-smart-notifications/index.ts` | scheduled quest reminders, companion nudges, push delivery visibility | Delivery infrastructure rather than quest truth, but it is part of the active scheduled-item pipeline |
| `subtasks` | table (`types.ts ~L6807`) | Child checklist items under a quest/task | `task_id`, `title`, `completed`, `sort_order`, `completed_at`, `created_at` from `src/integrations/supabase/types.ts` | `src/features/tasks/hooks/useSubtasks.ts`, `src/services/dailyTasksRemote.ts`, `src/components/TodaysAgenda.tsx`, `supabase/functions/outlook-todo-tasks/index.ts` | `src/features/tasks/hooks/useSubtasks.ts`, `src/features/tasks/lib/subtaskWrites.ts`, `src/hooks/useTaskMutations.ts` | task cards, edit quest dialog, decompose-task flows, Outlook To Do sync | Good candidate for canonical subtasks bucket; tied tightly to overloaded parent task table |
| `task_dependencies` | table | Blocker/dependency graph between tasks | `task_id`, `depends_on_task_id`, `user_id` from `src/integrations/supabase/types.ts` | `src/features/tasks/hooks/useTaskDependencies.ts` | `src/features/tasks/hooks/useTaskDependencies.ts` | dependency picker, blocked badge, enhanced task card | Narrow but stable; still uses task vocabulary rather than quest vocabulary |
| `task_contexts` | table | User-defined task/quest context taxonomy | `name`, `icon`, `color`, `is_default` from `src/integrations/supabase/types.ts` | indirectly via task records and planner surfaces | task editing/mutation paths | advanced quest editing, planner context | “Context” is domain-specific but not normalized into broader naming guidance |
| `task_attachments` | table created by migration, not present in generated frontend types | Per-quest file/image attachments | `task_id`, `file_url`, `file_path`, `file_name`, `mime_type`, `file_size_bytes`, `is_image`, `sort_order` from `supabase/migrations/20260219160000_create_task_attachments.sql` | `src/services/dailyTasksRemote.ts` | `src/hooks/useTaskMutations.ts` via `.from('task_attachments' as any)` | quest attachment picker, daily task fetch | Schema/type drift: table exists and is used, but is missing from `src/integrations/supabase/types.ts` |
| `personal_quest_templates` | table | User-saved quest templates and derived reuse templates | `title`, `normalized_title`, `difficulty`, `estimated_duration`, `notes`, `subtasks`, `source_common_template_id` from `src/integrations/supabase/types.ts` | `src/features/quests/services/personalQuestTemplates.ts`, `src/features/quests/hooks/usePersonalQuestTemplates.ts`, `src/components/AddQuestSheet.tsx` | `src/features/quests/services/personalQuestTemplates.ts` | quest template browser, Add Quest sheet | Adjacent support structure; useful for quests but not part of the core target buckets |
| `daily_planning_preferences` | table | User-owned planning preferences and planner profile payload | `preferred_work_blocks`, `wake_time`, `wind_down_time`, `default_day_shape`, `default_energy_level`, `default_flex_hours`, `cold_contact_threshold_days` from `src/integrations/supabase/types.ts` | `supabase/functions/companion-agent/agent.ts`, `src/hooks/useCompanionPlanner.ts` | `src/hooks/useCompanionPlanner.ts` | planner memory, day planning, relationship task surfacing | True preference data, not AI learning; currently split away from `profiles` |
| `daily_plan_sessions` | table | Saved record of generated daily plan sessions | `plan_date`, `day_shape`, `energy_level`, `flex_time_hours`, `generation_context`, `protected_epics`, `protected_habits`, `tasks_generated` from `src/integrations/supabase/types.ts` | planner-related reporting and session features | daily plan generation flows | planning history / generated-plan persistence | Session history exists outside the main task model and outside AI telemetry tables |
| `daily_planning_usage` | table | Planner usage telemetry | `times_used`, `last_used_at`, `user_id` from `src/integrations/supabase/types.ts` | reporting / usage checks | `supabase/functions/record-daily-planning-use/index.ts` | planner usage tracking | Operational telemetry, not quest truth |

#### Application contracts

| Item | Kind | Current role | Key contract | Primary readers / dependents | Primary writers / producers | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- |
| `DailyTask` in `src/services/dailyTasksRemote.ts` | TS interface | Main frontend task/quest DTO | Mirrors `daily_tasks` plus joined `epic_title`, `contact`, `subtasks`, `attachments` | task cards, Journeys, planner, calendar list surfaces | produced by `fetchDailyTasksRemote` | Uses task vocabulary for a UI that often says quest |
| `CalendarTask`, `ScheduleTask`, `DragTask` in `src/types/quest.ts` | TS interfaces | Task read models for scheduling, drag/drop, calendar display | `task_text`, `task_date`, `scheduled_time`, `is_main_quest`, `xp_reward`, etc. | calendar and drag/drop components | derived from task data | “Quest/Task system” file still exports `Task*` names rather than `Quest*` names |
| `useTasksQuery` / `useDailyTasks` | hooks | Local-first quest reads plus mutation façade | returns `tasks`, `taskDate`, counts, and mutation helpers | `src/pages/Journeys.tsx`, planner and task components | hydrates from `plannerSync` remote refresh | Hook name hides that it is the de facto quest repository |
| `useTaskMutations` | hook | Main quest writer | create/update/toggle/delete/reorder/move/restore tasks; persists subtasks and attachments | Journeys, Add/Edit quest flows | writes `daily_tasks`, `subtasks`, `task_attachments`; queues offline work | Central write path knows about attachments, recurrence, schedule rules, XP, local queueing, and sync failure handling |
| `useInboxTasks` | hook | Inbox read/write view over `daily_tasks` where `task_date` is null | `fetchInboxTasks`, schedule/toggle/delete inbox items | `src/pages/Inbox.tsx`, Journeys inbox section | updates `daily_tasks` | “Inbox quest” is an interpretation of `daily_tasks`, not a separate object |
| `useCalendarTasks` | hook | Calendar view read model over dated tasks | date-range filtered task list for week/month/list | month/week planner views | remote hydration from `daily_tasks` into local store | Calendar item view is still task-based and separate from external calendar events |
| `useSubtasks` and `subtaskWrites` | hook + helper | Subtask CRUD and replace/append logic | `Subtask` DTO and title-plan operations | edit quest dialog, enhanced task card, decompose dialog | writes `subtasks` and offline queue | Stable sub-bucket, but still named from task parent concept |
| `useTaskDependencies` | hook | Dependency graph CRUD | `TaskDependency`, blockers/dependents | dependency picker and blocked UI | writes `task_dependencies` | Uses task vocabulary in a quest surface |

#### Key surfaces and endpoints
- Surfaces:
  - `src/pages/Journeys.tsx`
  - `src/pages/Inbox.tsx`
  - `src/components/TodaysAgenda.tsx`
  - `src/components/SmartDayPlanner/*`
  - `src/features/tasks/components/*`
- Endpoints:
  - `supabase/functions/companion-agent/index.ts`
  - `supabase/functions/companion-planner-chat/*` via `supabase/functions/companion-agent/plannerBridge.ts`
  - `supabase/functions/decompose-task/index.ts`
  - `supabase/functions/classify-task-intent/index.ts`
  - `supabase/functions/suggest-task-times/index.ts`
  - `supabase/functions/generate-smart-daily-plan/index.ts`
  - `supabase/functions/record-daily-planning-use/index.ts`

#### Planning / quest audit notes
- `daily_tasks` is the most overloaded table in the whole productivity model.
- The UI already distinguishes “quest”, “inbox quest”, “main quest”, “regular quest”, “ritual-linked quest”, and “campaign-linked quest”, but storage does not.
- Quest attachments and Outlook To Do quest links both exist in schema/migrations but are missing from the generated frontend Supabase types, forcing `as any` access in active code paths.

### 2. Campaigns

#### Persistence objects

| Item | Kind | Current purpose | Key fields / contract | Primary readers | Primary writers | Dependent features | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `epics` | table | Main campaign record | `title`, `description`, `status`, `progress_percentage`, `target_days`, `start_date`, `end_date`, `story_type_slug`, `theme_color`, `xp_reward` from `src/integrations/supabase/types.ts` | `src/hooks/epicsQuery.ts`, `src/hooks/useEpics.ts`, `supabase/functions/companion-agent/agent.ts`, `generate-smart-daily-plan`, `generate-journey-path` | `src/hooks/useEpics.ts`, `supabase/functions/companion-agent/executor.ts` | `src/pages/Campaigns.tsx`, `src/pages/Journeys.tsx`, Pathfinder, milestone/calendar views | Major naming hotspot: user-facing concept is campaign, storage concept is epic |
| `epic_habits` | table | Link table between campaigns and rituals | `epic_id`, `habit_id` | `src/hooks/epicsQuery.ts`, `src/hooks/useEpics.ts` | `src/hooks/useEpics.ts` | Pathfinder-generated campaign rituals | Campaign model is partly stored in a differently named ritual domain |
| `epic_milestones` | table | Campaign milestone structure and optional task linkage | `title`, `description`, `target_date`, `milestone_percent`, `phase_name`, `phase_order`, `task_id`, `is_postcard_milestone`, `completed_at` | `src/hooks/useCalendarMilestones.ts`, `src/hooks/useMilestones.ts`, `src/hooks/useEpics.ts`, `generate-smart-daily-plan`, `adjust-epic-plan`, `apply-epic-adjustments` | `src/hooks/useEpics.ts`, campaign adjustment functions | calendar milestones, campaign progress, postcards | Milestones belong to campaigns but use epic naming; can also point back into `daily_tasks` |
| `journey_phases` | table | Campaign phase breakdown | `name`, `description`, `start_date`, `end_date`, `phase_order`, `epic_id` | `src/hooks/useEpics.ts`, offline queue flows | `src/hooks/useEpics.ts` | Pathfinder campaign structure | Campaign phases are stored as “journey phases,” continuing the campaign/epic/journey naming split |
| `epic_journey_paths` | table | Generated campaign visual path / image artifact | `epic_id`, `image_url`, `milestone_index`, `prompt_context`, `generated_at` | `supabase/functions/generate-journey-path/index.ts`, `src/hooks/useEpics.ts` | `generate-journey-path` | Journey path drawer, campaign visuals | AI-generated campaign artifact uses journey naming and sits beside campaign truth |

#### Application contracts

| Item | Kind | Current role | Key contract | Primary readers / dependents | Primary writers / producers | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- |
| `EpicRecord` in `src/hooks/epicsQuery.ts` | TS interface | Main frontend campaign DTO | campaign core fields plus joined `epic_habits` and latest journey path metadata | `useEpics`, Campaigns page, Pathfinder | produced by `fetchEpics` | Public hook contract still exports `Epic*` names |
| `useEpics` | hook | Main campaign repository and mutation layer | returns `epics`, `activeEpics`, `completedEpics`, `createEpic`, `renameEpic`, `updateEpicStatus`, plus ritual creation helpers | `src/pages/Campaigns.tsx`, `src/pages/Journeys.tsx`, Pathfinder, campaign cards | writes `epics`, `habits`, `epic_habits`, `journey_phases`, `epic_milestones` | Hook name and payload names are epic-based even though product copy is campaign-based |
| `Campaigns.tsx` | page | Dedicated campaign UI surface | uses `useEpics` but labels everything “Campaigns” | user-facing campaign management | consumes hook outputs | Page copy and hook/storage names diverge |
| Pathfinder flow | feature | Campaign creation UX | builds campaign title, rituals, phases, milestones | `src/components/Pathfinder/*` | writes through `useEpics.createEpic` | Builder output is campaign-shaped, write path is epic-shaped |

#### Key surfaces and endpoints
- Surfaces:
  - `src/pages/Campaigns.tsx`
  - `src/features/epics/components/EpicsTab.tsx`
  - `src/components/CampaignCard.tsx`
  - `src/components/Pathfinder/*`
- Endpoints:
  - `supabase/functions/generate-journey-path/index.ts`
  - `supabase/functions/generate-campaign-welcome-image/index.ts`
  - `supabase/functions/adjust-epic-plan/index.ts`
  - `supabase/functions/apply-epic-adjustments/index.ts`
  - campaign-aware reads inside `supabase/functions/companion-agent/agent.ts`

#### Campaign audit notes
- Campaign semantics are already first-class in the UI, but not in the storage vocabulary.
- Campaign structure is spread across `epics`, `epic_habits`, `epic_milestones`, `journey_phases`, and generated journey-path artifacts.
- This is a clean rename candidate at the domain-model level first, and only later at the physical schema level.

### 3. Journal / Reflection

#### Persistence objects

| Item | Kind | Current purpose | Key fields / contract | Primary readers | Primary writers | Dependent features | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `user_reflections` | table | Main simple reflection / gratitude journal entry | `mood`, `note`, `reflection_date`, `ai_reply` from `src/integrations/supabase/types.ts` | `src/pages/Reflection.tsx`, `supabase/functions/companion-agent/agent.ts` | `src/pages/Reflection.tsx`, `supabase/functions/companion-agent/executor.ts`, `generate-reflection-reply` | Reflection page, agent journal entry action | This is the closest thing to a generic journal entry table, but it coexists with two other daily reflection tables |
| `evening_reflections` | table | Structured end-of-day reflection | `mood`, `wins`, `additional_reflection`, `tomorrow_adjustment`, `gratitude`, `mentor_response`, `reflection_date` | `src/hooks/useEveningReflection.ts`, `src/hooks/useCompanionPlanner.ts`, recap/stat-analysis/notification functions | `src/hooks/useEveningReflection.ts`, `generate-evening-response` | evening reflection drawer/banner, recap/stat analysis | Another journal-like table with a different schema and AI reply field |
| `daily_check_ins` | table | Structured morning/daily check-in record | `check_in_type`, `check_in_date`, `mood`, `reflection`, `intention`, `mentor_response`, `completed_at` | `supabase/functions/companion-agent/agent.ts`, `src/hooks/useCompanionPlanner.ts`, `src/hooks/useCompanionMoodSignal.ts`, weekly recap/stat analysis/notifications | morning check-in flows and check-in related UI | morning check-in, mood signal, weekly recap | This is also journal-like, but named and shaped differently from reflections |
| `morning_briefings` | table (`types.ts ~L5287`) | AI-generated morning briefing snapshot for a day, optionally tied to a mentor persona | `briefing_date`, `content`, `action_prompt`, `todays_focus`, `inferred_goals`, `mentor_id`, `data_snapshot`, `viewed_at`, `dismissed_at` | `src/hooks/useMorningBriefing.ts` | `supabase/functions/generate-morning-briefing/index.ts` | morning briefing card/surface | AI-generated summary artifact adjacent to journal/planning data rather than a user-authored journal entry |
| `weekly_recaps` | table (`types.ts ~L8245`) | Weekly AI-generated summary of reflections, tasks, and mood trends | `week_start_date`, `week_end_date`, `mood_data`, `stats`, `gratitude_themes`, `win_highlights`, `mentor_insight`, `mentor_story`, `viewed_at` | `src/hooks/useWeeklyRecap.ts`, `src/pages/Recaps.tsx`, weekly recap card/modal | `supabase/functions/generate-weekly-recap/index.ts` | weekly recap modal, card, and history list | Derived summary artifact built from journal/task/mood data rather than a raw journal entry |

#### Application contracts

| Item | Kind | Current role | Key contract | Primary readers / dependents | Primary writers / producers | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- |
| `Reflection.tsx` | page | Simple gratitude journal page over `user_reflections` | loads/upserts today’s `user_reflections` row and backgrounds `generate-reflection-reply` | reflection route | direct page writes | Page title says “Gratitude Journal”, route is Reflection, storage is `user_reflections` |
| `useEveningReflection` | hook | Evening reflection read/write contract | reads today’s `evening_reflections`, inserts new row, invokes `generate-evening-response` | evening banner/drawer | writes `evening_reflections` | Separate journal contract from `Reflection.tsx` |
| `PlannerReflectionSignal` in `src/types/companionPlanner.ts` | TS interface | Normalized planner read model for reflection-like signals | `source: "check_in" | "reflection"`, `mood`, `wins`, `tomorrowAdjustment` | companion planner | derived from `daily_check_ins` and `evening_reflections` | Planner already needs a normalized read model because storage is split |

#### Key surfaces and endpoints
- Surfaces:
  - `src/pages/Reflection.tsx`
  - evening reflection UI via `useEveningReflection`
  - planner and weekly recap consumers
- Endpoints:
  - `supabase/functions/generate-reflection-reply/index.ts`
  - `supabase/functions/generate-evening-response/index.ts`
  - `supabase/functions/generate-weekly-recap/index.ts`
  - `supabase/functions/generate-weekly-insights/index.ts`

#### Journal / reflection audit notes
- Journal data is currently subtype-split before there is any canonical shared `journal_entries` concept.
- The split is partially temporal and partially UX-driven, but not formalized as a single typed journal model.
- AI response storage is inconsistent:
  - `user_reflections.ai_reply`
  - `evening_reflections.mentor_response`
  - `daily_check_ins.mentor_response`

### 4. Calendar / Scheduling

#### Persistence objects

| Item | Kind | Current purpose | Key fields / contract | Primary readers | Primary writers | Dependent features | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `external_calendar_events` | table | Mirrored provider events used as read-only scheduling context | `title`, `start_time`, `end_time`, `is_all_day`, `location`, `description`, `source`, `connection_id` | `src/hooks/useExternalCalendarEvents.ts`, `supabase/functions/companion-agent/agent.ts` | `google-calendar-events`, `outlook-calendar-events` | planner context, coming-up reads, day load calculations | Calendar item truth is split between provider mirrors and quest link tables |
| `focus_sessions` | table (`types.ts ~L3628`) | Logged focus/pomodoro work sessions optionally linked to a quest | `task_id`, `started_at`, `completed_at`, `planned_duration`, `actual_duration`, `duration_type`, `status`, `distractions_count`, `xp_earned` | `src/features/tasks/hooks/useFocusSession.ts`, `src/features/tasks/hooks/useProductivityStats.ts` | `src/features/tasks/hooks/useFocusSession.ts` | focus timer, productivity stats, quest-linked deep-work tracking | Time-accounting record adjacent to planning/scheduling, but not itself a calendar item |
| `user_calendar_connections` | table | Provider auth and sync configuration | `provider`, `platform`, `calendar_email`, `primary_calendar_id`, `primary_calendar_name`, `sync_mode`, `sync_enabled`, tokens and sync metadata from `src/integrations/supabase/types.ts` | `src/hooks/useCalendarIntegrations.ts`, provider event/auth functions | `google-calendar-auth`, `outlook-calendar-auth`, Apple native flows | profile settings, calendar auth, sync routing | Provider auth, sync config, and primary list/calendar settings all live in one table |
| `calendar_user_settings` | table | Calendar integration UI settings | `integration_visible`, `default_provider`, `nudge_dismissed_at` | `src/hooks/useCalendarIntegrations.ts` | `src/hooks/useCalendarIntegrations.ts` | calendar settings UI | Separate user settings table just for calendar UI state |
| `quest_calendar_links` | table | Link between `daily_tasks` and provider calendar events | `task_id`, `connection_id`, `provider`, `external_calendar_id`, `external_event_id`, `sync_mode`, `last_*_sync_at` | `src/hooks/useQuestCalendarSync.ts`, provider event functions | `google-calendar-events`, `outlook-calendar-events` | send quest to calendar, sync timed quests | Uses quest vocabulary, but parent object is still `daily_tasks` |
| `quest_outlook_task_links` | table created by migration, not present in generated frontend types | Link between `daily_tasks` and Microsoft To Do tasks for date-only/inbox items | `task_id`, `connection_id`, `external_task_list_id`, `external_task_id`, `sync_mode`, `last_*_sync_at` from `supabase/migrations/20260227200000_create_quest_outlook_task_links.sql` | `src/hooks/useQuestCalendarSync.ts` via `.from('quest_outlook_task_links' as any)` and `outlook-todo-tasks` | `outlook-todo-tasks` | Outlook full-sync for date-only or inbox quests | Another schema/type drift table; exists in migrations and runtime code, but not in generated frontend types |

#### Application contracts

| Item | Kind | Current role | Key contract | Primary readers / dependents | Primary writers / producers | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- |
| `useCalendarIntegrations` | hook | Main calendar connection/settings contract | returns `connections`, `connectedByProvider`, `defaultProvider`, settings mutations, OAuth flows | profile/calendar settings, quest sync, planner | writes `calendar_user_settings`, reads/writes `user_calendar_connections`, invokes auth functions | Calendar and Outlook To Do setup share one hook |
| `useExternalCalendarEvents` | hook | Planner read model for external events | returns `PlannerContextCalendarEvent[]` | companion planner, schedule-read surfaces | reads `external_calendar_events` | Good normalized read model over provider mirrors |
| `useQuestCalendarSync` | hook | Main send/sync contract between quests and provider calendars/tasks | exposes `QuestCalendarLink`, `QuestOutlookTaskLink`, provider routing, send/delete/sync helpers | Journeys, Inbox, planner, calendar settings | reads/writes link tables, updates `daily_tasks`, invokes provider functions | Timed event sync and Outlook To Do sync are unified in one hook but backed by different storage tables |
| `PlannerContextCalendarEvent` in `src/types/companionPlanner.ts` | TS interface | Normalized read-only calendar item for AI/planner context | `id`, `title`, `start`, `end`, `isAllDay`, `provider`, `readOnly` | planner context and assistant surfaces | produced by external calendar read hook and sync merge | This is the right shape for future `calendar_items` read models |

#### Key surfaces and endpoints
- Surfaces:
  - `src/components/CalendarIntegrationsSettings.tsx`
  - `src/pages/CalendarOAuthCallback.tsx`
  - calendar-aware planner and Journeys surfaces
- Endpoints:
  - `supabase/functions/google-calendar-auth/index.ts`
  - `supabase/functions/google-calendar-events/index.ts`
  - `supabase/functions/outlook-calendar-auth/index.ts`
  - `supabase/functions/outlook-calendar-events/index.ts`
  - `supabase/functions/outlook-todo-tasks/index.ts`

#### Calendar audit notes
- Calendar items are not a single domain object today.
- There are at least four different calendar-related object classes:
  - provider connections/config
  - mirrored external events
  - quest-to-calendar event links
  - quest-to-Outlook task links
- Calendar sync is a major migration risk because provider logic can create, update, or delete quest records as part of sync resolution.

### 5. Memory

#### Persistence objects

| Item | Kind | Current purpose | Key fields / contract | Primary readers | Primary writers | Dependent features | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `companion_memories` | table | Companion-specific remembered moments | `memory_type`, `memory_date`, `memory_context`, `referenced_count`, `last_referenced_at`, `companion_id`, `user_id` from `src/integrations/supabase/types.ts` | `src/hooks/useCompanionMemories.ts`, `supabase/functions/companion-agent/agent.ts`, `supabase/functions/companion-chat/index.ts` | `src/hooks/useCompanionMemories.ts`, `supabase/functions/companion-chat/index.ts`, `supabase/functions/process-daily-decay/index.ts`, onboarding/evolution listeners | companion memory whispers, bond displays, agent context | This is the only true “memory” table, but it is companion-bound and event-flavored rather than a generalized memory bucket |

#### Application contracts

| Item | Kind | Current role | Key contract | Primary readers / dependents | Primary writers / producers | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- |
| `CompanionMemory` in `src/hooks/useCompanionMemories.ts` | TS interface | Frontend memory DTO | typed `memory_type`, `memory_context`, bond-milestone helpers | memory whisper UI, bond UI | produced by memory hook | Memory type list is companion-specific and not aligned to a broader user-memory model |
| `useCompanionMemories` | hook | Main companion memory query/mutation layer | fetches memories, references memories, creates memories, derives bond milestones | companion tab, memory whisper, bond badge | writes `companion_memories` directly | Blends memory browsing with bond-level gameplay concerns |

#### Memory audit notes
- There is no generalized `memory_items` table today.
- `companion_memories` is real memory, but only for companion experiences.
- `user_ai_learning` and `user_ai_preferences` should not be reclassified as memory by default; they are learned profile state.

### 6. AI Activity

#### Persistence objects

| Item | Kind | Current purpose | Key fields / contract | Primary readers | Primary writers | Dependent features | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ai_interactions` | table | AI interaction telemetry and user action feedback | `interaction_type`, `input_text`, `detected_intent`, `ai_response`, `modifications`, `user_action`, `response_time_ms`, `session_id` from `src/integrations/supabase/types.ts` | reporting and AI learning flows | `supabase/functions/record-ai-interaction/index.ts`, `generate-companion-tts` | AI analytics, learning feedback | Telemetry, not domain truth |
| `ai_output_validation_log` | table | AI output validation records | `template_key`, `model_used`, `input_data`, `output_data`, `validation_passed`, `validation_errors`, `tokens_used` from `src/integrations/supabase/types.ts` | validation/rate-limiter logic | `generate-daily-missions`, `_shared/rateLimiter.ts` | output validation and operational safety | Operational AI validation, not user activity history |
| `user_ai_learning` | table (`types.ts ~L6952`) | Learned profile and behavior model | `conversation_profile`, `common_contexts`, `peak_productivity_times`, `preference_weights`, `successful_patterns`, `failed_patterns`, `energy_by_hour`, `day_of_week_patterns`, `preferred_*` from `src/integrations/supabase/types.ts` | `companion-chat`, `companion-agent`, `generate-smart-daily-plan`, `useCompanionPlanner` | `record-ai-interaction`, `companion-chat` memory extraction | planner memory, personalized prompting | Learned profile state is mixed with what could later become reusable memory |
| `user_ai_preferences` | table (`types.ts ~L7050`) | Explicit AI preference and companion mode settings | `response_style`, `tone_preference`, `detail_level`, `prefers_direct_answers`, `companion_mode`, `companion_mode_adaptation_enabled` | `supabase/functions/companion-agent/agent.ts`, `src/hooks/useCompanionModeSettings.ts` | `src/hooks/useCompanionModeSettings.ts` | companion mode/personality settings | True user preference state, not learned memory and not chat history |
| `mentors` | table (`types.ts ~L5182`) | Canonical mentor/persona catalog used by briefings, mentor chat, recaps, nudges, and tone selection | `name`, `mentor_type`, `slug`, `description`, `archetype`, `intensity_level`, `tone_description`, `voice_style`, `avatar_url`, `themes` | `src/pages/Profile.tsx`, `src/pages/MentorSelection.tsx`, `src/hooks/useMentorPersonality.ts`, `supabase/functions/generate-weekly-recap/index.ts`, `supabase/functions/generate-morning-briefing/index.ts`, `supabase/functions/generate-smart-notifications/index.ts` | admin/catalog management surfaces and canonical roster migrations | mentor selection, morning briefings, weekly recaps, pep talks, notification voice selection | Persona catalog rather than user-specific AI activity, but it shapes multiple AI-facing surfaces and outputs |
| `companion_chats` | table | Persisted assistant/user turns | `role`, `content`, `input_mode`, `source`, `surface`, `session_id`, `companion_id` | `src/hooks/useCompanionChat.ts`, `src/services/companionChatThreads.ts`, `companion-chat`, `companion-agent` persistence | `companion-chat`, `companion-agent` persistence, frontend history loads | companion talk, journeys companion threads, agent history | One table stores both legacy and newer assistant flows |
| `companion_chat_threads` | table | Thread/session metadata for companion chat | `session_id`, `surface`, `title`, `preview_text`, `message_count`, `openai_conversation_id`, `last_openai_response_id`, `archived_at` | `src/services/companionChatThreads.ts`, `useCompanionAssistant`, `companion-agent` persistence | `companion-chat` thread persistence, `companion-agent` persistence | thread history, journeys thread list | Thread identity is `session_id`; other rows refer to that session identifier rather than a separate numeric/thread id |
| `companion_pending_actions` | table | Structured AI-proposed writes awaiting confirmation or execution | `action_type`, `intent`, `normalized_payload`, `summary`, `confirmation_message`, `status`, `execution_result`, `execution_error`, `thread_id`, `session_id`, `idempotency_key` | `src/services/companionChatThreads.ts`, `companion-agent` persistence/executor | `companion-agent` | pending confirmation UI, agent receipts | Pending intent is mixed into the same companion namespace as chat persistence |

#### Application contracts

| Item | Kind | Current role | Key contract | Primary readers / dependents | Primary writers / producers | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- |
| `CompanionChatRequest` / `CompanionChatResponse` in `src/types/companionConversation.ts` | TS contract | Older chat endpoint request/response | free-form reply, speech text, handoff flag, optional journeys context | `useCompanionChat`, `useJourneysCompanionConversation` | `companion-chat` endpoint | Older surface relies on handoff rather than structured action payloads |
| `CompanionAgentRequest` / `CompanionAgentResponse` in `src/types/companionAgent.ts` | TS contract | Newer structured agent endpoint contract | `surface`, `sessionId`, `message`, date range, entity selection, `structuredResponse`, pending action, receipt, thread state | `useCompanionAssistant` | `companion-agent` endpoint | Best current base for normalized AI write orchestration |
| `CompanionStructuredResponse` in `src/shared/companionStructuredOutput.ts` | shared TS contract | Structured response for plan-day and coming-up reads | `intent`, `planDay`, `comingUp` | `companion-agent`, planner, UI rendering | planner bridge and agent outputs | Currently narrower than the long-term target response contract |
| `useCompanionAssistant` | hook | Main new assistant shell with fallback handling | unified message list, thread state, structured response, pending action handling, speech | journeys and companion planner panels | invokes `companion-agent`; falls back to legacy adapter | New and legacy assistant stacks coexist here |
| `useLegacyCompanionAssistantAdapter` | hook | Compatibility adapter that combines legacy chat and planner flows | merges `useCompanionChat` and `useCompanionPlanner`, maps planner proposals into pending-action-like UI | `useCompanionAssistant` fallback path | reads legacy planner/chat outputs | Key migration artifact; keeps old and new assistant stacks alive at once |
| `useCompanionChat` | hook | Old talk-mode assistant | loads/persists `companion_chats`, invokes `companion-chat`, tracks interaction telemetry | companion tab | `companion-chat` | Conversation-oriented, not structured-write oriented |
| `useJourneysCompanionConversation` | hook | Old journeys-side companion chat | invokes `companion-chat` with journeys context and planner handoff behavior | journeys surface | `companion-chat` | Separate pre-agent journeys conversation path |
| `useCompanionPlanner` | hook | Legacy planner/proposal engine and read model assembler | returns `messages`, `questions`, `proposals`, `pendingProposals`, `sessionState`, `plannerContext`, `plannerMemory`, `structuredResponse`, submit/confirm APIs | legacy adapter, journeys planner modal | invokes planner endpoint/orchestrator, writes planning prefs, creates tasks/campaigns/rituals through other hooks | Still a substantial product surface even after `companion-agent` exists |

#### Key endpoints
- `supabase/functions/companion-chat/index.ts`
- `supabase/functions/companion-agent/index.ts`
- `supabase/functions/companion-agent/persistence.ts`
- `supabase/functions/companion-agent/executor.ts`
- `supabase/functions/record-ai-interaction/index.ts`
- `supabase/functions/generate-companion-tts/index.ts`

#### AI activity audit notes
- The newer `companion-agent` path is already closer to the desired architecture:
  - structured request
  - structured response
  - persisted thread state
  - persisted pending actions
  - confirmed execution into Supabase
- The older `companion-chat` path still handles free-form conversation and planning handoff, and still updates AI learning/memory state.
- `user_ai_learning` and `user_ai_preferences` should be treated as distinct from chat persistence and distinct from domain truth.

### 7. Adjacent Rituals / Habits

#### Persistence objects

| Item | Kind | Current purpose | Key fields / contract | Primary readers | Primary writers | Dependent features | Overlap / confusion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `habits` | table | Ritual/habit records used by campaigns, planner, reminders, and companion systems | `title`, `frequency`, `preferred_time`, `estimated_minutes`, `description`, `category`, `difficulty`, `current_streak`, `longest_streak`, `reminder_*`, `custom_days`, `custom_month_days` from `src/integrations/supabase/types.ts` | `useHabits`, `useEpics`, `useCompanionPlanner`, `companion-agent`, mission/notification functions | `useHabits`, `useEpics`, `companion-agent/executor` | rituals, campaign rituals, reminders, missions | Habits are clearly first-class today, but they are not represented in the target bucket list |

#### Audit notes
- Rituals are functionally important and campaign-linked, but they should be kept as an adjacent domain during the first cleanup pass.
- The main overlap is with quests and scheduling:
  - a habit can generate or influence a quest
  - campaign creation creates both `epics` and `habits`
  - the agent can create either a task/quest or a ritual depending on user intent

## Current to Target Bucket Mapping

| Target bucket | Current source(s) | Already exists? | Current gaps / overlaps | Recommendation |
| --- | --- | --- | --- | --- |
| User profiles | `profiles` plus user-owned settings in `daily_planning_preferences`, `calendar_user_settings`, `user_ai_preferences` | Partially | Core profile exists, but settings are fragmented across multiple tables | Keep `profiles` as root. Do not merge immediately. First define a normalized profile/settings read model and explicit ownership boundaries |
| Memory items | `companion_memories`; memory-like signals also appear in `user_ai_learning.conversation_profile` and `user_ai_preferences` | Not as a generalized bucket | Only companion-specific memory exists today; learned profile and preferences are not true memory items | Do not rename anything yet. Treat `companion_memories` as specialized memory and add a future generalized `memory_items` model later |
| Campaigns | `epics`, `epic_habits`, `epic_milestones`, `journey_phases`, `epic_journey_paths` | Yes, under legacy names | Product says campaign; storage says epic/journey | Rename at the domain-model level first. Keep physical tables for now, but introduce `Campaign` DTOs/adapters and plan a later schema rename or compatibility view |
| Quests | `daily_tasks`, `task_attachments`, `personal_quest_templates` | Yes, under overloaded task model | Quest identity is overloaded with schedule/reminder/habit/milestone/AI concerns; storage says task | Keep `daily_tasks` short-term. Introduce a canonical `Quest` read/write adapter layer, then split fields later if needed |
| Subtasks | `subtasks` | Yes | Parent still depends on overloaded `daily_tasks` semantics | Keep as-is. Rename only at interface level if needed after quest normalization lands |
| Journal entries | `user_reflections`, `evening_reflections`, `daily_check_ins` | Partially and redundantly | Three different journal-like tables with different schemas and AI reply fields | Do not merge immediately. First define canonical journal entry types and map each current table to an explicit subtype |
| Calendar items | `external_calendar_events`, `user_calendar_connections`, `calendar_user_settings`, `quest_calendar_links`, `quest_outlook_task_links` | Partially | Read-only provider mirrors and user-owned scheduled quests are separate concepts mixed under “calendar” | Keep split storage for now. Add a normalized `CalendarItem` read model before any schema move |
| AI activity | `ai_interactions`, `ai_output_validation_log`, `user_ai_learning`, `user_ai_preferences`, `companion_chats`, `companion_chat_threads`, `companion_pending_actions` | Yes, but fragmented by concern | Telemetry, learned profile, chat persistence, and pending writes are adjacent but not cleanly named as distinct categories | Keep separate storage classes. Standardize the vocabulary and make `companion-agent` the canonical orchestration layer |

## Recommended Naming Standard

### Canonical nouns
- `user profile`
  - Canonical product/domain term for the user record and owned settings
  - Storage can remain `profiles` short-term
- `campaign`
  - Canonical product/domain term for long-running goal containers
  - `epic` becomes a legacy storage alias only
- `quest`
  - Canonical product/domain term for actionable units currently stored in `daily_tasks`
  - `task` becomes an internal/storage alias only unless a deliberately broader generic abstraction is needed
- `subtask`
  - Keep as-is
- `journal entry`
  - Canonical umbrella for reflection/check-in/end-of-day writing
  - `reflection` should be used as a subtype or prompt style, not the top-level bucket name
- `calendar item`
  - Canonical umbrella read-model term for external events plus scheduled quest projections
- `memory item`
  - Reserve for durable reusable memory
  - Do not use for learned preference weights or telemetry
- `AI activity`
  - Canonical umbrella for telemetry, chat persistence, pending actions, validation logs, and learned profile state
- `planner`
  - Reserve for orchestration, heuristics, and schedule read models
  - Do not use as a base noun for stored domain truth
- `companion`
  - Reserve for the AI persona/channel and companion-specific data
  - Do not use as a substitute for generic AI activity naming

### Database conventions
- Tables: plural `snake_case`
- Columns: singular `snake_case`
- New canonical table direction for future migrations:
  - `campaigns`
  - `quests`
  - `subtasks`
  - `journal_entries`
  - `calendar_items` only if it becomes a persisted canonical store rather than a read model
  - `memory_items`
  - `ai_chat_threads`
  - `ai_chat_messages`
  - `ai_pending_actions`
  - `ai_interactions`
  - `ai_learning_profiles`
  - `ai_preferences`
- Until migration, treat these as logical target names, not implemented names.

### TypeScript conventions
- Public domain types should use canonical nouns:
  - `Campaign`
  - `Quest`
  - `JournalEntry`
  - `CalendarItem`
  - `MemoryItem`
- Storage adapters can keep legacy names:
  - `EpicRecord`
  - `DailyTask`
- Do not introduce new public interfaces named `Epic*` or `Task*` unless they are intentionally storage-bound or generic infrastructure types.

### Hook conventions
- Prefer canonical names at the hook boundary:
  - future: `useCampaigns`, `useQuests`, `useJournalEntries`, `useCalendarItems`
- Existing hooks like `useEpics` and `useDailyTasks` should be wrapped or renamed only after adapter layers exist.

### Service and endpoint conventions
- Service names should align to canonical domain nouns where possible:
  - future: `quests.ts`, `campaigns.ts`, `journalEntries.ts`, `calendarItems.ts`
- Endpoint/action payloads should use canonical product nouns even if storage tables lag behind:
  - `create_quest`, `update_quest`, `create_campaign`, `journal_entry`
- Avoid mixing `quest`, `task`, `item`, `todo`, and `planner entry` for the same concept.

## Recommended Cleanup / Refactor Plan

### Phase 0: This audit
- Deliver and review this document before any migration work.
- Freeze major naming churn until canonical vocabulary is agreed.

### Phase 1: Canonical vocabulary and alias map
- Define the approved product/domain vocabulary:
  - campaign = current epic
  - quest = current daily task
  - journal entry = current reflection/check-in family
  - calendar item = current normalized schedule read model
- Add a repo-level alias map to guide developers and AI prompts.
- Start using canonical nouns in new docs, API proposals, and product copy first.
- Leave physical tables and existing hooks alone in this phase.

### Phase 2: Read-model normalization and shared naming adapters
- Introduce normalized domain DTOs at the app boundary:
  - `Campaign`
  - `Quest`
  - `JournalEntry`
  - `CalendarItem`
  - `MemoryItem` only if generalized memory is introduced
- Add storage adapters that translate:
  - `EpicRecord` -> `Campaign`
  - `DailyTask` -> `Quest`
  - reflection/check-in tables -> `JournalEntry` variants
  - calendar mirrors/link tables -> `CalendarItem`
- Update pages and newer hooks to consume normalized DTOs rather than raw storage names.
- Keep storage schema untouched in this phase.

### Phase 3: Unified AI write contract and storage-boundary cleanup
- Make `companion-agent` the canonical AI interpretation/write orchestration endpoint.
- Treat `companion-chat` as legacy conversational infrastructure that either:
  - becomes read-only conversation
  - or is folded behind the agent path
- Standardize AI output categories:
  - assistant reply
  - suggested mutations
  - memory candidates
  - learned preference updates
  - telemetry
- Ensure AI writes only through validated server-side execution into Supabase-owned truth.
- Stop using AI-learned profile tables as if they were equivalent to user memory items.

### Phase 4: Compatibility-first schema cleanup
- Fix generated schema drift first:
  - add `task_attachments` to generated frontend types
  - add `quest_outlook_task_links` to generated frontend types
- Add compatibility views or adapter services before any rename:
  - `campaigns` view over `epics`
  - `quests` view/service over `daily_tasks`
  - typed journal-entry compatibility layer over the three reflection tables
- Only after adapters are live should any table split/rename/backfill begin.
- Prefer dual-read or dual-write transitions over destructive cutovers.

### Phase 5: Legacy path removal after cutover
- Remove `Epic`/`Task` naming from public hook boundaries.
- Retire legacy planner/chat adapter flows once the agent path fully covers them.
- Remove `as any` access for missing tables after generated types are fixed.
- Remove or archive obsolete compatibility shims only after the UI, agent layer, and sync flows are cut over.

## Risk Register Before Any Migration

| Risk | Why it matters | Migration implication |
| --- | --- | --- |
| Local-first planner store and offline queue | Tasks, subtasks, epics, habits, and planner sync all use local persistence plus queued writes | Any schema rename/split must update local store schemas, queue payloads, and remote hydration paths, not just SQL |
| `daily_tasks` overload | Quest identity, schedule, reminder, recurrence, habit link, milestone link, AI-generated state, and attachments all sit on one row | Blindly renaming the table to `quests` would not solve the underlying modeling overlap |
| Campaign naming drift | UI says campaign; hooks/types/storage say epic; related structures say journey | Need adapters and vocabulary alignment before schema churn |
| Reflection table split | `user_reflections`, `evening_reflections`, and `daily_check_ins` all hold journal-like data | Merging without subtype rules risks data loss and broken features |
| Calendar provider split | Timed calendar events and Outlook To Do links use different storage and sync paths | Calendar migration must preserve provider-specific behavior and delete/update semantics |
| Generated schema drift | `task_attachments` and `quest_outlook_task_links` are runtime tables but missing from generated frontend types | Fix type generation before deeper normalization work so runtime code stops depending on `as any` |
| Dual assistant stack | `companion-chat`, `useCompanionPlanner`, legacy adapter, and `companion-agent` all coexist | Migration order should consolidate orchestration before touching domain storage boundaries |
| AI boundary confusion | Learned profile, telemetry, memory, chat persistence, and pending writes are adjacent but not clearly separated | Future AI write logic will stay messy unless each storage class gets a distinct role |
| Thread/session identity coupling | `companion_pending_actions.thread_id` points at thread `session_id` rather than a separate thread primary key | Thread migrations must preserve session-based lookup semantics |
| Scheduled jobs and downstream analytics | Notifications, recap/stat-analysis, planning telemetry, and sync flows read these tables | Schema changes must audit background jobs and derived views, not just UI calls |

## What Can Stay, What Should Be Renamed, What Should Be Deferred

### Can stay for now
- `profiles` as the root user table
- `subtasks` as its own table
- split storage for provider connection/config vs mirrored external events
- `companion_pending_actions` as the confirmation gate for AI writes

### Should be renamed at the domain-model level first
- `epics` -> campaigns
- `daily_tasks` -> quests
- reflection/check-in family -> journal entries

### Should be explicitly classified, not renamed blindly
- `user_ai_learning`
- `user_ai_preferences`
- `ai_interactions`
- `ai_output_validation_log`
- `companion_memories`

### Should be deferred until after adapters and compatibility layers exist
- physical table renames such as `epics` -> `campaigns` and `daily_tasks` -> `quests`
- splitting `daily_tasks` into separate quest, scheduling, and reminder stores
- collapsing the three journal-like tables into one physical table
- replacing provider-specific calendar link tables with one unified storage abstraction
- introducing a generalized `memory_items` table before the meaning of memory is agreed

## Public Interface Watchlist

| Interface area | Current contract(s) | Why it matters later | Recommended direction |
| --- | --- | --- | --- |
| AI agent request/response | `src/types/companionAgent.ts`, `supabase/functions/companion-agent/types.ts`, `src/shared/companionStructuredOutput.ts` | This is the clearest current contract for surface-aware AI interpretation and structured replies | Keep as the base. Expand into the future normalized response contract rather than inventing parallel endpoint shapes |
| Pending AI actions | `companion_pending_actions.normalized_payload`, executor payloads in `supabase/functions/companion-agent/executor.ts` | This is the server-side handoff point between AI proposals and Supabase writes | Preserve this boundary. Normalize action nouns around `quest`, `campaign`, `journal_entry`, and `calendar_item` later |
| Legacy assistant chat | `src/types/companionConversation.ts`, `supabase/functions/companion-chat/index.ts` | Still powers conversation flows and learning updates in parts of the app | Treat as legacy. Either fold behind `companion-agent` or keep only as a conversation transport |
| Planner hook surface | `src/hooks/useCompanionPlanner.ts`, `src/types/companionPlanner.ts` | Still exposes proposals, questions, planner context, reflection signals, and generated structure | Use as a source for normalized read-model design, but avoid expanding it as the long-term canonical write contract |
| Quest mutation surface | `src/hooks/useTaskMutations.ts`, `src/hooks/useInboxTasks.ts`, `src/hooks/useQuestCalendarSync.ts` | These are the main ways UI and sync flows mutate `daily_tasks`, `subtasks`, attachments, and calendar links | Add `Quest` adapters first, then migrate callers behind them before touching storage names |
| Campaign mutation surface | `src/hooks/useEpics.ts` | Campaign creation and update flows are already centralized here, but under `epic` naming | Introduce a `Campaign`-named boundary on top of this before any schema rename |
| Reflection / journal writes | `src/pages/Reflection.tsx`, `src/hooks/useEveningReflection.ts`, daily check-in flows, `companion-agent/executor.ts` journal actions | Three write paths already exist with different fields and AI reply columns | Define canonical journal entry subtypes first, then normalize API payloads before any merge |
| Calendar sync writes | `src/hooks/useQuestCalendarSync.ts`, provider functions, link-table writes | Provider behavior differs between timed events and Outlook To Do sync | Preserve provider-specific write logic even if read models become unified |

## Proposed Future Normalized Contract Direction

This section is proposed only. It is not implemented.

- One canonical AI orchestration endpoint:
  - `companion-agent`
- One canonical structured AI response envelope:
  - `assistantMessage`
  - `intent`
  - `needsClarification`
  - `clarifyingQuestion`
  - `suggestedQuests`
  - `suggestedCampaigns`
  - `suggestedJournalEntries`
  - `suggestedScheduleChanges`
  - `memoryCandidates`
  - `learnedPreferenceUpdates`
  - `summaryForStorage`
- One canonical write boundary:
  - AI proposes
  - server validates
  - Supabase-owned tables persist approved truth
- One canonical read-model vocabulary at the UI boundary:
  - `UserProfile`
  - `Quest`
  - `Campaign`
  - `Subtask`
  - `JournalEntry`
  - `CalendarItem`
  - `MemoryItem`
  - `AiActivity`

## Immediate Recommendation

- Review and approve the canonical vocabulary first.
- Fix schema/type drift for `task_attachments` and `quest_outlook_task_links` before deeper cleanup.
- Introduce normalized read-model adapters for campaigns, quests, journal entries, and calendar items before touching physical schema names.
- Consolidate AI orchestration around `companion-agent` before expanding AI write behavior.
- Do not start a broad rename/refactor until the alias map, adapter boundaries, and AI write contract are agreed.

## Short Version
- Supabase already owns the truth, but the truth is named inconsistently and spread across overloaded tables.
- The highest-value cleanup is not a rewrite; it is a vocabulary and boundary cleanup:
  - campaigns vs epics
  - quests vs tasks
  - journal entries vs reflections/check-ins
  - memory vs learned profile vs telemetry
  - AI orchestration vs domain persistence
- The safest path is:
  1. canonical names
  2. adapter layer
  3. unified AI write contract
  4. compatibility-first schema cleanup
  5. legacy removal
