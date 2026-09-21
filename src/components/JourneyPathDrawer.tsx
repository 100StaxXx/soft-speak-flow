import { memo, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Target, Flame, Map, Pencil, Plus, Repeat, Clock } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConstellationTrail } from "@/components/ConstellationTrail";
import { JourneyDetailDrawer } from "@/components/JourneyDetailDrawer";
import { EditCampaignSheet } from "@/components/EditCampaignSheet";
import { useJourneyPathImage } from "@/hooks/useJourneyPathImage";
import { usePreloadedImageUrl } from "@/hooks/usePreloadedImageUrl";
import { useMilestones } from "@/hooks/useMilestones";
import { useCompanion } from "@/hooks/useCompanion";
import { useSharedCampaignPathMarkers } from "@/hooks/useSharedCampaignPathMarkers";
import { usePlannerPathfinderAppearance } from "@/hooks/usePlannerPathfinderAppearance";
import { getCompanionFrostedThemeStyle } from "@/lib/companionFrostedTheme";
import { getJourneyPathDrawerImageUrl } from "@/utils/journeyPathUrls";
import { getEpicDaysRemaining, resolveEpicEndDate } from "@/utils/epicDates";
import { cn } from "@/lib/utils";

interface EpicHabit {
  habit_id: string;
  habits: {
    id: string;
    title: string;
    difficulty: string;
    description?: string;
    frequency?: string;
    estimated_minutes?: number;
    preferred_time?: string | null;
    custom_days?: number[] | null;
    custom_month_days?: number[] | null;
  };
}

interface JourneyPathDrawerProps {
  epic: {
    id: string;
    title: string;
    description?: string;
    progress_percentage: number;
    target_days: number;
    start_date: string;
    end_date: string | null;
    epic_habits?: EpicHabit[];
  };
  children?: React.ReactNode;
}

export const JourneyPathDrawer = memo(function JourneyPathDrawer({
  epic,
  children,
}: JourneyPathDrawerProps) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStartsWithAddRitual, setEditStartsWithAddRitual] = useState(false);
  
  const { pathImageUrl } = useJourneyPathImage(epic.id);
  const drawerImageUrl = useMemo(() => getJourneyPathDrawerImageUrl(pathImageUrl), [pathImageUrl]);
  const { resolvedImageUrl: loadedDrawerImageUrl } = usePreloadedImageUrl(drawerImageUrl);
  const { milestones, totalCount } = useMilestones(epic.id);
  const { companion } = useCompanion();
  const { markers: sharedPathMarkers } = useSharedCampaignPathMarkers(epic.id);
  const { themeModeClassName } = usePlannerPathfinderAppearance();
  const companionFrostedThemeStyle = useMemo(
    () => getCompanionFrostedThemeStyle(companion?.favorite_color),
    [companion?.favorite_color],
  );
  const resolvedEndDate = useMemo(() => resolveEpicEndDate(epic), [epic]);

  const daysRemaining = useMemo(() => {
    return getEpicDaysRemaining({
      start_date: epic.start_date,
      target_days: epic.target_days,
      end_date: resolvedEndDate,
    });
  }, [epic.start_date, epic.target_days, resolvedEndDate]);

  const rituals = useMemo(
    () => (epic.epic_habits ?? [])
      .map((link) => link.habits)
      .filter((habit): habit is NonNullable<EpicHabit["habits"]> => Boolean(habit)),
    [epic.epic_habits],
  );

  const timedRituals = useMemo(
    () => rituals
      .filter((ritual) => !!ritual.preferred_time)
      .slice()
      .sort((a, b) => (a.preferred_time ?? "").localeCompare(b.preferred_time ?? "")),
    [rituals],
  );

  const nextRitual = timedRituals[0] ?? rituals[0] ?? null;
  const ritualCount = rituals.length;
  const timedRitualCount = timedRituals.length;

  const formatRitualTime = (time?: string | null) => {
    if (!time) return "Time not set";
    const [hours, minutes = "00"] = time.split(":");
    const hour = Number.parseInt(hours, 10);
    if (!Number.isFinite(hour)) return time;
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  };

  const openEditCampaign = () => {
    setEditStartsWithAddRitual(false);
    setEditOpen(true);
  };

  const openAddRitual = () => {
    setEditStartsWithAddRitual(true);
    setEditOpen(true);
  };

  // Convert milestones to trail format
  const trailMilestones = useMemo(() => {
    return milestones.map(m => ({
      id: m.id,
      title: m.title,
      milestone_percent: m.milestone_percent,
      is_postcard_milestone: m.is_postcard_milestone,
      completed_at: m.completed_at,
      description: m.description,
      phase_name: m.phase_name,
      target_date: m.target_date,
      chapter_number: m.chapter_number,
    }));
  }, [milestones]);
  const trailCompanionMarkers = useMemo(
    () => sharedPathMarkers.length > 0 ? sharedPathMarkers : undefined,
    [sharedPathMarkers],
  );

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false} handleOnly={true}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent
        className={cn(themeModeClassName, "max-h-[85vh]")}
        style={companionFrostedThemeStyle}
        data-testid="journey-path-drawer-content"
      >
        <DrawerHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <DrawerTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              {epic.title}
            </DrawerTitle>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={openEditCampaign}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
          
          {/* Progress bar with stats */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-primary">
                {Math.round(epic.progress_percentage)}% Complete
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                {daysRemaining === null ? "Timeline pending" : `${daysRemaining}d left`}
              </span>
            </div>
            <Progress value={epic.progress_percentage} className="h-2" />
          </div>
        </DrawerHeader>

        <div 
          className="flex-1 px-4 pb-6 max-h-[60vh] overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          data-vaul-no-drag
        >
          {/* Journey Path Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <div className="rounded-xl overflow-hidden border border-border/30 bg-card/30 backdrop-blur-sm">
              {/* Combined Journey Visualization */}
              <div className="relative h-56 w-full overflow-hidden">
                {/* AI-Generated Path Image Background */}
                {loadedDrawerImageUrl && (
                  <>
                    <img
                      src={loadedDrawerImageUrl}
                      alt=""
                      aria-hidden="true"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
                  </>
                )}
                
                {/* Constellation Trail Overlay */}
                <ConstellationTrail
                  progress={epic.progress_percentage}
                  targetDays={epic.target_days}
                  companionImageUrl={companion?.current_image_url}
                  companionImageFocalX={companion?.current_image_focal_x ?? null}
                  companionImageFocalY={companion?.current_image_focal_y ?? null}
                  companionMood={companion?.current_mood}
                  showCompanion={true}
                  companionMarkers={trailCompanionMarkers}
                  milestones={trailMilestones}
                  epicId={epic.id}
                  transparentBackground={!!loadedDrawerImageUrl}
                  className="absolute inset-0"
                />
              </div>

            </div>
          </motion.div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/40 bg-card/50 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Milestones</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{totalCount}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/50 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Journey</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{epic.target_days}d</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/50 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Rhythms</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{ritualCount}</p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Repeat className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Next rhythm</p>
                {nextRitual ? (
                  <>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{nextRitual.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRitualTime(nextRitual.preferred_time)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No rhythms linked yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-border/35 bg-card/35 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">This week</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {ritualCount === 0
                    ? "No commitment rhythms yet"
                    : `${ritualCount} rhythm${ritualCount === 1 ? "" : "s"} attached`}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {timedRitualCount}/{ritualCount || 0} timed
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" className="gap-2" onClick={openEditCampaign}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={openAddRitual}>
              <Plus className="h-4 w-4" />
              Add rhythm
            </Button>
            <JourneyDetailDrawer
              epicId={epic.id}
              epicTitle={epic.title}
              epicGoal={epic.description}
              currentDeadline={resolvedEndDate ?? undefined}
              companionFrostedThemeStyle={companionFrostedThemeStyle}
            >
              <Button variant="outline" className="gap-2">
                <Map className="w-4 h-4" />
                Milestones
              </Button>
            </JourneyDetailDrawer>
          </div>
        </div>
      </DrawerContent>
      <EditCampaignSheet
        epic={epic}
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen);
          if (!nextOpen) {
            setEditStartsWithAddRitual(false);
          }
        }}
        startWithAddRitual={editStartsWithAddRitual}
        companionFrostedThemeStyle={companionFrostedThemeStyle}
        onDeleted={() => {
          setEditOpen(false);
          setOpen(false);
        }}
      />
    </Drawer>
  );
});
