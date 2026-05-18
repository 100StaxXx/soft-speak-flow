import type { JourneyPathPromptContext } from "@/shared/journeyPathConfig";
import { supabase } from "@/integrations/supabase/client";

export interface EpicHabitRecord {
  habit_id: string;
  habits: {
    id: string;
    user_id?: string | null;
    title: string;
    difficulty: string;
    description?: string | null;
    frequency?: string | null;
    estimated_minutes?: number | null;
    custom_days?: number[] | null;
    custom_month_days?: number[] | null;
    preferred_time?: string | null;
    category?: string | null;
  } | null;
}

export interface EpicRecord {
  id: string;
  user_id: string;
  owner_user_id?: string | null;
  title: string;
  description: string | null;
  status: string;
  progress_percentage: number | null;
  xp_reward?: number | null;
  target_days: number;
  start_date: string;
  end_date: string | null;
  created_at?: string | null;
  story_type_slug?: string | null;
  epic_habits?: EpicHabitRecord[] | null;
  latest_journey_path_generated_at?: string | null;
  latest_journey_path_milestone_index?: number | null;
  latest_journey_path_url?: string | null;
  latest_journey_path_prompt_context?: JourneyPathPromptContext | null;
  [key: string]: unknown;
}

export const EPICS_QUERY_STALE_TIME = 3 * 60 * 1000;

export const getEpicsQueryKey = (userId: string | undefined) =>
  ["epics", userId] as const;

type EpicHabitRemoteRecord = EpicHabitRecord & {
  epic_id: string;
};

const EPIC_HABITS_SELECT = `
  epic_id,
  habit_id,
  habits(id, user_id, title, difficulty, description, frequency, estimated_minutes, custom_days, custom_month_days, preferred_time, category)
`;

const normalizeEpicForViewer = (epic: EpicRecord, viewerUserId: string): EpicRecord => ({
  ...epic,
  owner_user_id: epic.owner_user_id ?? epic.user_id,
  user_id: viewerUserId,
  epic_habits: [],
});

const normalizeEpicHabitForViewer = (link: EpicHabitRemoteRecord, viewerUserId: string): EpicHabitRecord | null => {
  if (!link.habits || link.habits.user_id !== viewerUserId) {
    return null;
  }

  const { user_id: _habitUserId, ...habit } = link.habits;
  return {
    habit_id: link.habit_id,
    habits: habit,
  };
};

export const fetchEpics = async (userId: string): Promise<EpicRecord[]> => {
  const [
    { data: ownedEpics, error: ownedEpicsError },
    { data: memberships, error: membershipsError },
  ] = await Promise.all([
    supabase
      .from("epics")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("epic_members")
      .select("epic_id")
      .eq("user_id", userId),
  ]);

  if (ownedEpicsError) {
    console.error("Failed to fetch owned epics:", ownedEpicsError);
    throw ownedEpicsError;
  }
  if (membershipsError) {
    console.error("Failed to fetch joined epic memberships:", membershipsError);
    throw membershipsError;
  }

  const joinedEpicIds = [...new Set((memberships ?? []).map((membership) => membership.epic_id))];
  const { data: joinedEpics, error: joinedEpicsError } = joinedEpicIds.length > 0
    ? await supabase
      .from("epics")
      .select("*")
      .in("id", joinedEpicIds)
    : { data: [], error: null };

  if (joinedEpicsError) {
    console.error("Failed to fetch joined epics:", joinedEpicsError);
    throw joinedEpicsError;
  }

  const epicById = new Map<string, EpicRecord>();
  [...((ownedEpics ?? []) as EpicRecord[]), ...((joinedEpics ?? []) as EpicRecord[])]
    .map((epic) => normalizeEpicForViewer(epic, userId))
    .forEach((epic) => {
      epicById.set(epic.id, epic);
    });

  const epics = [...epicById.values()];
  const epicIds = epics.map((epic) => epic.id);
  const { data: epicHabitRows, error: epicHabitsError } = epicIds.length > 0
    ? await supabase
      .from("epic_habits")
      .select(EPIC_HABITS_SELECT)
      .in("epic_id", epicIds)
    : { data: [], error: null };

  if (epicHabitsError) {
    console.error("Failed to fetch epic rituals:", epicHabitsError);
    throw epicHabitsError;
  }

  const linksByEpicId = new Map<string, EpicHabitRecord[]>();
  ((epicHabitRows ?? []) as EpicHabitRemoteRecord[]).forEach((link) => {
    const normalizedLink = normalizeEpicHabitForViewer(link, userId);
    if (!normalizedLink) return;

    if (!linksByEpicId.has(link.epic_id)) {
      linksByEpicId.set(link.epic_id, []);
    }
    linksByEpicId.get(link.epic_id)?.push(normalizedLink);
  });

  return epics
    .map((epic) => ({
      ...epic,
      epic_habits: linksByEpicId.get(epic.id) ?? [],
    }))
    .sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? ""));
};
