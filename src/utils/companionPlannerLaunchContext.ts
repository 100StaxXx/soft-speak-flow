import { format, isSameDay } from "date-fns";

import { createCompanionPlannerLaunchIntentId } from "@/shared/companionPlannerSurfaceActions";
import type {
  CompanionPlannerLaunchIntent,
  PlannerBriefingContext,
} from "@/types/companionPlanner";

export interface CompanionPlannerLaunchTask {
  id: string;
  task_text: string;
  task_date?: string | null;
  completed?: boolean | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
  is_main_quest?: boolean | null;
  priority?: string | null;
  difficulty?: string | null;
}

export interface CompanionPlannerLaunchEpic {
  id: string;
  title: string;
  progress_percentage?: number | null;
}

interface CreatePlanDayLaunchIntentOptions {
  selectedDate: Date;
  tasks: readonly CompanionPlannerLaunchTask[];
  activeEpics?: readonly CompanionPlannerLaunchEpic[];
  currentTime?: Date;
  assumeTasksAreForSelectedDate?: boolean;
}

type PlannerInsightCategory =
  | "finish_scheduled"
  | "needs_schedule"
  | "campaign_opening"
  | "reschedule_overload"
  | "light_structured"
  | "empty_day"
  | "steady_progress";

const PLANNER_INSIGHT_STATEMENTS: Record<PlannerInsightCategory, string[]> = {
  finish_scheduled: [
    "Most of the day already has a time. Finish the scheduled quests before adding anything new.",
    "The structure is already there. Protect the timed quests first, then decide if anything else deserves space.",
    "You have enough on the calendar to start. Work through the scheduled list before reshuffling.",
    "The schedule has already done the first hard part. Follow the timed path before inventing a side quest.",
    "Your calendar is holding the shape of the day. Let the timed quests lead and keep extra ideas in the waiting room.",
    "This is a good follow-the-map day. Start with what already has a time and save the remix for later.",
    "Timed quests are the spine of this plan. Walk that line first, then see what still wants attention.",
    "The day is not asking for clever, just steady. Honor the timed blocks before opening another tab in your brain.",
    "Your plan already has rails. Ride those first, then decide if anything else earns a seat.",
    "The important pieces have appointments. Keep them protected and let optional work audition afterward.",
    "Do not negotiate with the schedule yet. Complete the timed quests, then review the leftovers with a cooler head.",
    "The calendar is doing useful adult supervision here. Let it boss the day around for a little while.",
    "The timed work is already standing in line. Start at the front and let the optional pieces wait.",
    "This schedule has a clear first move. Take the timed quests seriously before adding new weight.",
    "The calendar made a useful promise for you. Keep it before chasing the extra possibilities.",
    "You already have an appointment with progress. Show up for it before expanding the list.",
    "The timed blocks are doing quiet architecture. Follow them and let the rest stay simple.",
    "Today needs execution more than rearranging. Trust the schedule and move through it in order.",
    "The plan is not empty, it is assigned. Honor each timed quest before asking for more.",
    "Let the calendar be the decision maker for now. Finish what has a time, then reassess.",
    "The scheduled pieces are the cleanest path through the day. Walk that path first.",
    "Your optional quests can wait in the lobby. The timed work gets the first handshake.",
    "This is a follow-through day. Keep the schedule visible and let completion choose the next move.",
    "The day already knows where to begin. Start with the timed block and keep the promise small.",
  ],
  needs_schedule: [
    "The list needs a little shape. Give one important quest a real time so the day has an anchor.",
    "Nothing is really protected yet. Pick the next useful quest and put it somewhere specific.",
    "Start by scheduling the piece that would make the biggest difference for a bigger goal.",
    "This plan wants one anchor, not a motivational speech. Choose the quest that matters and give it a time.",
    "The day is currently a pile of good intentions. Put the sharpest one on the calendar.",
    "Pick one quest to stop floating. A real time will turn the list from fog into a route.",
    "Choose the task you would be relieved to have finished, then give it a slot before the day gets ideas.",
    "The list is asking for a first domino. Schedule one useful quest and let the rest line up behind it.",
    "Start with one clear appointment for progress. The rest of the plan can stop pretending it is abstract art.",
    "Give the day a handle. One timed quest is enough to make the whole list easier to lift.",
    "The best move is not more planning, it is one protected block. Put the next important quest somewhere real.",
    "Your quests are hovering politely. Invite one of them onto the calendar before they form a committee.",
    "The list needs a landing place. Give one quest a time and let the day stop drifting.",
    "A single anchor will help more than another scan of the list. Schedule the next useful block.",
    "Pick the quest with the most leverage and give it a protected slot.",
    "The day needs one appointment with progress. Put the best next task on the calendar.",
    "Turn one floating quest into a timed commitment before the list starts spreading out.",
    "Choose the thing that keeps returning to your mind, then schedule it somewhere honest.",
    "One block is enough to make the whole plan less slippery. Place it and begin there.",
    "Give the list a backbone. A scheduled quest will make the rest easier to sort.",
    "The next move wants a clock, not a debate. Choose one quest and assign the time.",
    "Create one protected pocket for the task that matters most.",
    "Let the day begin with a real slot. One scheduled quest beats a dozen almost-plans.",
    "Your plan needs a first stake in the ground. Put one quest on the calendar.",
  ],
  campaign_opening: [
    "The day has room. Use one clear block to move an active campaign forward before the space disappears.",
    "You have a light runway today. Choose one campaign touchpoint and make it concrete.",
    "This is a good day to get ahead on an active campaign: schedule one campaign step now.",
    "There is enough oxygen here for a campaign step. Pick the smallest useful move and give it a time.",
    "The day is leaving a door open. Walk one active campaign through it before the calendar changes its mind.",
    "Use this light day for one campaign nudge. Nothing epic, just one honest brick in the wall.",
    "A campaign can benefit from this quiet patch. Choose one touchpoint that future-you will notice.",
    "This is a good opening for strategic mischief: advance one campaign while the day is still uncluttered.",
    "The load is light enough to think bigger. Put one active campaign step on the board.",
    "An active campaign is waving from the wings. Give it one focused block so it does not have to shout later.",
    "The day has spare room, which is rare and suspiciously useful. Spend a little of it on an active campaign.",
    "Turn the open space into momentum. One campaign step is enough to make the day feel intentional.",
    "There is room for one campaign move today. Keep it small enough to actually land.",
    "A light plan is a quiet invitation. Spend one block on the campaign that matters most.",
    "This is a good opening for campaign maintenance: one clear touch, then back to the day.",
    "Use the space before it evaporates. Give one active campaign a concrete next step.",
    "The campaign does not need a parade today. It needs one useful block with a finish line.",
    "Pick the campaign step that future-you will thank you for, then make it real.",
    "There is enough daylight here for one campaign push. Choose the smallest move with teeth.",
    "Let one campaign borrow the open room, but do not let it take over the house.",
    "This is a tidy chance to advance a campaign without crowding the rest of the plan.",
    "Put one campaign touchpoint on the calendar while the day still has elbow room.",
    "The open space can become drift or campaign progress. Choose progress with a small scope.",
    "One campaign step today is plenty. Make it specific, visible, and done.",
  ],
  reschedule_overload: [
    "This is more than one day can comfortably hold. Keep the fixed commitments and move the least important work before it piles up.",
    "The load is heavy and progress is thin. Reschedule the day around what truly has to happen.",
    "Treat this as a triage day: protect the timed essentials, then push or shrink the rest.",
    "This plan is trying to wear too many hats. Keep the fixed pieces, shrink the flexible ones, and move what can wait.",
    "The day is overloaded, not morally failing. Cut it down to essentials before the schedule starts charging rent.",
    "Do the emergency edit: fixed commitments stay, low-impact work moves, oversized quests get smaller.",
    "This is a calendar traffic jam. Clear a lane for the must-do work and reroute the rest.",
    "Protect the quests that truly matter and give the extras a later landing spot. Heroics are not the plan.",
    "The load needs pruning. Keep what is fixed, trim what is vague, and let tomorrow absorb the nonessential.",
    "This is a triage board, not a productivity contest. Save the day by making it smaller.",
    "The schedule is waving a tiny red flag. Move or shrink the least important quests before momentum gets buried.",
    "Heavy days need fewer promises. Pick the essentials, reschedule the soft commitments, and call that wisdom.",
    "The day is asking for a smaller promise. Move the soft work and keep only the essentials.",
    "This load needs triage before it needs willpower. Protect the fixed pieces and shrink the rest.",
    "Heavy does not mean heroic. Reschedule what can wait and make the remaining work clean.",
    "The plan is over capacity. Move the lowest-impact quests before they steal the whole day.",
    "Treat the fixed commitments as anchors and reroute everything that does not truly belong today.",
    "This is not a day to carry extras. Keep essentials, shrink oversized work, and send the rest later.",
    "The red flag is useful information. Reschedule early so the day has a chance to breathe.",
    "Too much is trying to happen at once. Make the plan smaller before the work starts pushing back.",
    "Heavy days reward subtraction. Move one thing, shrink one thing, then start with the fixed piece.",
    "The calendar needs relief. Reroute the flexible quests and keep the must-do work visible.",
    "This is triage, not defeat. Save the essentials and give the extras a better landing.",
    "The day is crowded enough. Reschedule the soft promises before they become noise.",
  ],
  light_structured: [
    "You have a manageable list and the important pieces are timed. Follow the schedule before adding more.",
    "This is already a clean little plan. Stay with the timed quests and let the day stay light.",
    "The day has enough structure to move without overthinking it. Complete the scheduled pieces first.",
    "This plan is pleasantly unchaotic. Keep it that way by trusting the timed quests.",
    "The day is light and already wearing matching socks. Follow the schedule and resist adding sparkle chores.",
    "Nothing needs a grand redesign here. Work the timed list and let the extra space stay breathable.",
    "This is a tidy little runway. Take off with the scheduled quests, then enjoy the unused airspace.",
    "The plan has enough structure and not too much noise. That is a rare flavor, protect it.",
    "Stay simple today. The timed quests are enough to create momentum without crowding the room.",
    "This is the kind of plan that works because it does not flex in the mirror. Follow it.",
    "Keep the day light on purpose. Finish the scheduled pieces before inviting more quests to the party.",
    "The calendar is being kind. Accept the kindness, follow the timed quests, and do not overpack the bag.",
    "This light plan already has a spine. Follow the timed pieces and keep the rest airy.",
    "The schedule is doing just enough. Trust it and avoid turning a clean day into a packed one.",
    "You have structure without heaviness. Let the timed quests carry the momentum.",
    "This is a good simple plan. Work the schedule and leave the spare room unclaimed.",
    "The calendar has handed you a gentle route. Follow it without adding scenic detours.",
    "A light day can still count. Complete the scheduled pieces and let that be solid.",
    "The plan is balanced because it is not crowded. Keep it that way.",
    "There is enough structure here to begin, and enough space to stay human.",
    "The timed quests are the useful shape of the day. Let them set the pace.",
    "This schedule is small in the best way. Protect the simplicity and move through it.",
    "The day has a clean rhythm. Finish the timed work before inviting extra noise.",
    "Light structure is still structure. Use it, then enjoy what stays open.",
  ],
  empty_day: [
    "Nothing is scheduled here yet. This is a good moment to choose one useful next step before the day fills itself.",
    "The day is open. Add one clear quest if there is a goal you want to keep moving.",
    "There is room to decide what matters. Schedule one small anchor if you want the day to have direction.",
    "The page is blank in a useful way. Add one small anchor so the day has a handle.",
    "This open day does not need a full itinerary. One meaningful quest is enough to give it a pulse.",
    "You have clean open space. Put one tiny stake in the ground before random errands discover it.",
    "Nothing is demanding a slot yet. Choose one gentle win if you want the day to point somewhere.",
    "The calendar is quiet. Add one clear quest, or deliberately protect the quiet if rest is the point.",
    "A blank day is powerful and slightly slippery. Give it one anchor if momentum matters today.",
    "This is open terrain. One useful quest can turn it from empty to intentional.",
    "No schedule pressure here. If you want direction, pick one small quest and let that be enough.",
    "The day is a fresh blank sheet. Draw one line on it, not a maze.",
    "The calendar is open. Choose one anchor if you want the day to point somewhere.",
    "Nothing is claiming the day yet. Add one small quest or protect the quiet on purpose.",
    "This blank space can be rest or momentum. Decide which one you actually need.",
    "An empty plan is not a problem. It is a place to choose one honest next step.",
    "The day is quiet enough to hear a priority. Give one useful quest a soft landing.",
    "Open space works best with one intention. Pick a small anchor and stop there.",
    "Nothing is scheduled, which means the day can stay spacious or gain one clear line.",
    "A blank calendar is permission to be deliberate. One quest is enough if direction matters.",
    "This open day does not need to prove anything. Add one anchor only if it helps.",
    "The quiet is useful. Keep it, or place one small quest where it will not crowd the day.",
    "No schedule is calling the shots yet. Choose one anchor before the day chooses for you.",
    "The page is empty in a workable way. One clean mark will do.",
  ],
  steady_progress: [
    "The day is workable. Choose the next important quest, then keep the rest in a simple order.",
    "There is enough here to need a plan, but not a total rebuild. Protect the timed work and pick one clear next step.",
    "You have a steady load. Keep the order simple and avoid adding work until the current list moves.",
    "This is a normal-sized quest stack. Pick the next best move and do not let the list become a philosophy seminar.",
    "The day has weight, but it is carrying weight. Keep the timed work protected and move through one quest at a time.",
    "This plan wants sequence more than drama. Start with the most useful next quest and keep the line moving.",
    "There is enough to do, but not enough to panic about. Give the day a clean order and follow it.",
    "The load is steady. Choose the quest that unlocks the most relief, then let the rest wait its turn.",
    "You do not need a master plan, just a sane queue. Timed work first, then the next important piece.",
    "This is manageable if it stays linear. Pick the next quest and resist turning the day into a puzzle box.",
    "The plan has momentum potential. Keep the order plain, protect what is timed, and avoid bonus quests for sport.",
    "A steady day rewards boring clarity. Choose the next best action and let completion do the talking.",
    "The plan is steady enough to move. Put the timed work first and keep the queue plain.",
    "This is a progress day, not a reinvention day. Choose the next quest and continue.",
    "The load is manageable if you keep the order honest. One quest, then the next.",
    "A simple queue will beat a complicated theory today. Start with the clearest next task.",
    "The day has enough shape to trust. Protect timed work, then follow the next useful thread.",
    "Steady work wants fewer decisions. Choose an order and let completion lower the noise.",
    "This plan can move if you do not keep reopening it. Pick the next quest and go.",
    "Progress is available here, but it likes a clean line. Keep the sequence simple.",
    "The queue is real but not wild. Work it in order and avoid adding bonus weight.",
    "A manageable day still needs a lead task. Choose one and let the rest follow.",
    "The plan has enough friction to need focus, not enough to need panic. Keep the order plain.",
    "Steady progress comes from closing loops. Start with the quest that clears the most space.",
  ],
};

const safeFormat = (date: Date, formatString: string, fallback: string) => {
  if (Number.isNaN(date.getTime())) return fallback;
  try {
    return format(date, formatString);
  } catch {
    return fallback;
  }
};

const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return "no estimate";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  count === 1 ? singular : plural;

const formatOpenQuestPhrase = (count: number) =>
  count === 0 ? "no open quests" : `${count} open ${pluralize(count, "quest")}`;

const formatTimingPhrase = (openCount: number, scheduledCount: number) => {
  if (openCount === 0) return "nothing left to time";
  if (scheduledCount === 0) return "nothing timed yet";
  if (scheduledCount === openCount) {
    if (openCount === 1) return "already timed";
    if (openCount === 2) return "both already timed";
    return "all already timed";
  }

  const anytimeCount = openCount - scheduledCount;
  return `${scheduledCount} timed and ${anytimeCount} anytime`;
};

const formatContextPhrase = (ritualCount: number, activeCampaignCount: number) => {
  const parts = [
    ritualCount > 0
      ? `${ritualCount} ${pluralize(ritualCount, "ritual")}`
      : null,
    activeCampaignCount > 0
      ? `${activeCampaignCount} active ${pluralize(activeCampaignCount, "campaign")}`
      : null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) return "";
  if (parts.length === 1) return `, with ${parts[0]} in the mix`;
  return `, with ${parts.join(" and ")} in the mix`;
};

const choosePlannerInsightCategory = ({
  openQuestCount,
  scheduledQuestCount,
  completedQuestCount,
  totalQuestCount,
  estimatedMinutes,
  activeCampaignCount,
}: {
  openQuestCount: number;
  scheduledQuestCount: number;
  completedQuestCount: number;
  totalQuestCount: number;
  estimatedMinutes: number;
  activeCampaignCount: number;
}): PlannerInsightCategory => {
  const completionRatio = totalQuestCount > 0
    ? completedQuestCount / totalQuestCount
    : 0;
  const lowCompletion = totalQuestCount > 0 && completionRatio < 0.35;
  const heavyLoad = openQuestCount >= 8 || estimatedMinutes >= 420;
  const lightlyScheduled =
    openQuestCount > 0 &&
    (scheduledQuestCount === 0 ||
      (openQuestCount >= 3 && scheduledQuestCount <= 1));

  if (heavyLoad && lowCompletion) return "reschedule_overload";
  if (scheduledQuestCount >= 2 && lowCompletion) return "finish_scheduled";
  if (openQuestCount <= 2 && activeCampaignCount > 0 && scheduledQuestCount <= 1) {
    return "campaign_opening";
  }
  if (openQuestCount === 0) return "empty_day";
  if (lightlyScheduled) return "needs_schedule";
  if (openQuestCount <= 2 && scheduledQuestCount > 0) return "light_structured";
  return "steady_progress";
};

const getDeterministicStatement = (
  category: PlannerInsightCategory,
  seed: string,
) => {
  const statements = PLANNER_INSIGHT_STATEMENTS[category];
  const hash = Array.from(seed).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  return statements[hash % statements.length] ?? statements[0] ?? "";
};

const summarizeTask = (task: CompanionPlannerLaunchTask) => {
  const details = [
    task.scheduled_time ? `at ${task.scheduled_time.slice(0, 5)}` : null,
    task.estimated_duration ? formatMinutes(task.estimated_duration) : null,
    task.priority ? `${task.priority} priority` : null,
    task.epic_title ? `campaign: ${task.epic_title}` : null,
  ].filter(Boolean);

  return details.length > 0
    ? `${task.task_text} (${details.join(", ")})`
    : task.task_text;
};

export const createPlanDayBriefingContext = ({
  selectedDate,
  tasks,
  activeEpics = [],
  currentTime = new Date(),
  assumeTasksAreForSelectedDate = false,
}: CreatePlanDayLaunchIntentOptions): PlannerBriefingContext => {
  const selectedDateKey = safeFormat(selectedDate, "yyyy-MM-dd", "");
  const dateLabel = safeFormat(selectedDate, "EEEE, MMMM d", "this day");
  const tasksForDate = assumeTasksAreForSelectedDate
    ? tasks
    : tasks.filter((task) => task.task_date === selectedDateKey);
  const completedTasks = tasksForDate.filter((task) => Boolean(task.completed));
  const openTasks = tasksForDate.filter((task) => !task.completed);
  const scheduledTasks = openTasks.filter((task) => Boolean(task.scheduled_time));
  const anytimeTasks = openTasks.length - scheduledTasks.length;
  const ritualTasks = openTasks.filter((task) => Boolean(task.habit_source_id));
  const mainQuests = openTasks.filter((task) => Boolean(task.is_main_quest));
  const estimatedMinutes = openTasks.reduce((total, task) => {
    const minutes = task.estimated_duration ?? 0;
    return Number.isFinite(minutes) && minutes > 0 ? total + minutes : total;
  }, 0);
  const activeCampaignTitles = activeEpics
    .map((epic) => epic.title.trim())
    .filter(Boolean)
    .slice(0, 4);
  const loadSignal =
    openTasks.length >= 8 || estimatedMinutes >= 420
      ? "heavy"
      : openTasks.length <= 2 && estimatedMinutes <= 90
        ? "light"
        : "steady";

  const insightCategory = choosePlannerInsightCategory({
    openQuestCount: openTasks.length,
    scheduledQuestCount: scheduledTasks.length,
    completedQuestCount: completedTasks.length,
    totalQuestCount: tasksForDate.length,
    estimatedMinutes,
    activeCampaignCount: activeEpics.length,
  });
  const statementSeed = [
    selectedDateKey,
    insightCategory,
    openTasks.length,
    scheduledTasks.length,
    completedTasks.length,
    activeEpics.length,
  ].join(":");
  const plannerInsightStatement = getDeterministicStatement(
    insightCategory,
    statementSeed,
  );
  const estimatePhrase = estimatedMinutes > 0
    ? `with about ${formatMinutes(estimatedMinutes)} planned`
    : "with no time estimate yet";
  const progressSentence = tasksForDate.length > 0
    ? `You're ${completedTasks.length} of ${tasksForDate.length} complete${
      formatContextPhrase(ritualTasks.length, activeEpics.length)
    }.`
    : activeEpics.length > 0
      ? `No quests are scheduled here yet, with ${activeEpics.length} active ${
        pluralize(activeEpics.length, "campaign")
      } waiting for a next step.`
      : "No quests are scheduled here yet.";

  const content = [
    `${dateLabel} looks ${loadSignal}: ${formatOpenQuestPhrase(openTasks.length)}, ${formatTimingPhrase(openTasks.length, scheduledTasks.length)}, ${estimatePhrase}.`,
    progressSentence,
  ].join(" ");

  const todayGuardrail = isSameDay(selectedDate, currentTime)
    ? " Because this is today, avoid proposing times that have already passed."
    : "";

  return {
    content,
    focus:
      loadSignal === "heavy"
        ? "Keep this day realistic and offer a lighter version."
        : "Turn the current quest load into a useful plan.",
    actionPrompt:
      `Preserve timed quests, avoid overload, cap the plan to the quests that matter, and explain why the order makes sense.${todayGuardrail}`,
    inferredGoals: activeCampaignTitles,
    dataSnapshot: {
      selectedDate: selectedDateKey,
      dateLabel,
      openQuestCount: openTasks.length,
      scheduledQuestCount: scheduledTasks.length,
      anytimeQuestCount: anytimeTasks,
      ritualQuestCount: ritualTasks.length,
      mainQuestCount: mainQuests.length,
      completedQuestCount: completedTasks.length,
      totalQuestCount: tasksForDate.length,
      estimatedMinutes,
      estimatedLoadLabel: formatMinutes(estimatedMinutes),
      loadSignal,
      plannerInsightCategory: insightCategory,
      plannerInsightStatement,
      activeCampaignCount: activeEpics.length,
      activeCampaignTitles,
      activeCampaigns: activeEpics.slice(0, 8).map((epic) => ({
        id: epic.id,
        title: epic.title,
        progress_percentage: epic.progress_percentage ?? null,
      })),
      topOpenQuests: openTasks.slice(0, 6).map(summarizeTask),
      visibleQuests: openTasks.slice(0, 12).map((task) => ({
        id: task.id,
        task_text: task.task_text,
        task_date: task.task_date ?? null,
        completed: task.completed ?? false,
        scheduled_time: task.scheduled_time ?? null,
        estimated_duration: task.estimated_duration ?? null,
        habit_source_id: task.habit_source_id ?? null,
        epic_id: task.epic_id ?? null,
        epic_title: task.epic_title ?? null,
        is_main_quest: task.is_main_quest ?? false,
        priority: task.priority ?? null,
      })),
    },
  };
};

export const createPlanDayCompanionLaunchIntent = (
  options: CreatePlanDayLaunchIntentOptions,
): CompanionPlannerLaunchIntent => {
  const currentTime = options.currentTime ?? new Date();
  const selectedDateKey = safeFormat(options.selectedDate, "yyyy-MM-dd", "");
  const dateLabel = safeFormat(options.selectedDate, "EEEE, MMMM d", "this day");
  const isSelectedToday = isSameDay(options.selectedDate, currentTime);

  return {
    id: createCompanionPlannerLaunchIntentId(),
    message: isSelectedToday ? "Plan my day" : `Plan my day for ${dateLabel}`,
    starterIntent: "plan_day",
    target: "planner",
    selectedDate: selectedDateKey || null,
    briefingContext: createPlanDayBriefingContext({
      ...options,
      currentTime,
    }),
  };
};
