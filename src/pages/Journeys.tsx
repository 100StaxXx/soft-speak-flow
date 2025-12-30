import { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Compass, 
  Trophy, 
  Plus, 
  Sparkles, 
  Wand2,
  Target,
  Mic,
  Send,
  Clock
} from "lucide-react";
import { HourlyViewModal } from "@/components/HourlyViewModal";
import { PageTransition } from "@/components/PageTransition";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { JourneyCard } from "@/components/JourneyCard";
import { TodaysAgenda } from "@/components/TodaysAgenda";
import { Pathfinder } from "@/components/Pathfinder";
import { DatePillsScroller } from "@/components/DatePillsScroller";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { JourneysTutorialModal } from "@/components/JourneysTutorialModal";
import { useEpics } from "@/hooks/useEpics";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import type { StoryTypeSlug } from "@/types/narrativeTypes";
import { cn } from "@/lib/utils";

const MAX_JOURNEYS = 2;

const Journeys = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [smartWizardOpen, setSmartWizardOpen] = useState(false);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showHourlyModal, setShowHourlyModal] = useState(false);
  
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal("journeys");
  
  const { currentStreak } = useStreakMultiplier();
  
  const {
    activeEpics: activeJourneys,
    completedEpics: completedJourneys,
    isLoading: journeysLoading,
    createEpic: createJourney,
    isCreating,
    updateEpicStatus: updateJourneyStatus,
  } = useEpics();

  const { 
    tasks: dailyTasks,
    addTask,
    toggleTask,
    completedCount,
    totalCount,
    isAdding
  } = useDailyTasks(selectedDate);
  
  const { tasks: allCalendarTasks } = useCalendarTasks(selectedDate, "month");
  
  // Habit surfacing - auto-surface active epic habits as daily tasks
  const { surfaceAllEpicHabits, unsurfacedEpicHabitsCount } = useHabitSurfacing(selectedDate);
  
  // Auto-surface habits when there are unsurfaced ones (with ref to prevent infinite loop)
  const hasSurfacedRef = useRef(false);
  const dateKeyRef = useRef(format(selectedDate, 'yyyy-MM-dd'));

  useEffect(() => {
    const currentDateKey = format(selectedDate, 'yyyy-MM-dd');
    
    // Reset if date changed
    if (dateKeyRef.current !== currentDateKey) {
      dateKeyRef.current = currentDateKey;
      hasSurfacedRef.current = false;
    }
    
    // Only surface once per date
    if (unsurfacedEpicHabitsCount > 0 && !hasSurfacedRef.current) {
      hasSurfacedRef.current = true;
      surfaceAllEpicHabits();
    }
  }, [unsurfacedEpicHabitsCount, selectedDate, surfaceAllEpicHabits]);
  
  const tasksPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    allCalendarTasks.forEach((task: any) => {
      const dateKey = task.task_date;
      map[dateKey] = (map[dateKey] || 0) + 1;
    });
    return map;
  }, [allCalendarTasks]);

  const hasReachedLimit = activeJourneys.length >= MAX_JOURNEYS;

  const handleCreateJourney = (data: {
    title: string;
    description?: string;
    target_days: number;
    story_type_slug?: StoryTypeSlug;
    habits: Array<{
      title: string;
      difficulty: string;
      frequency: string;
      custom_days: number[];
    }>;
  }) => {
    createJourney(data);
    setSmartWizardOpen(false);
  };

  const handleAddQuest = async (data: AddQuestData) => {
    const taskDate = format(selectedDate, 'yyyy-MM-dd');
    await addTask({
      taskText: data.text,
      difficulty: data.difficulty,
      taskDate,
      isMainQuest: false,
      scheduledTime: data.scheduledTime,
      estimatedDuration: data.estimatedDuration,
      recurrencePattern: data.recurrencePattern,
      recurrenceDays: data.recurrenceDays,
      reminderEnabled: data.reminderEnabled,
      reminderMinutesBefore: data.reminderMinutesBefore,
    });
    setShowAddSheet(false);
  };

  const handleToggleTask = (taskId: string, completed: boolean, xpReward: number) => {
    toggleTask({ taskId, completed, xpReward });
  };

  return (
    <PageTransition>
      <div className="min-h-screen pb-nav-safe pt-6 safe-area-top px-4">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center relative"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHourlyModal(true)}
            className="absolute left-0 top-0 h-10 w-10 text-sky-400 hover:text-sky-300 hover:bg-sky-400/10"
            aria-label="Open day view"
          >
            <Clock className="h-6 w-6" />
          </Button>
          <PageInfoButton 
            onClick={() => setShowPageInfo(true)} 
            className="absolute right-0 top-0"
          />
          <div className="inline-flex items-center gap-2 mb-3 bg-gradient-to-r from-primary/20 to-purple-500/20 px-4 py-2 rounded-full">
            <Compass className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Your Path</span>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Quests & Campaigns
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Daily quests. Epic campaigns. All in one place.
          </p>
        </motion.div>

        {/* Date Selector */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <DatePillsScroller
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            tasksPerDay={tasksPerDay}
          />
        </motion.div>

        {/* Quick Input Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <div 
            onClick={() => setShowAddSheet(true)}
            className="flex items-center gap-3 bg-secondary/40 border border-border/50 rounded-xl px-4 py-3 cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <div className="flex-1 text-muted-foreground text-sm">
              Add a quest or ask me anything...
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
                <Mic className="w-4 h-4 text-primary" />
              </button>
              <button className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
                <Send className="w-4 h-4 text-primary" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Today's Agenda Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <TodaysAgenda
            tasks={dailyTasks}
            selectedDate={selectedDate}
            onToggle={handleToggleTask}
            onAddQuest={() => setShowAddSheet(true)}
            completedCount={completedCount}
            totalCount={totalCount}
            currentStreak={currentStreak}
            activeJourneys={activeJourneys}
          />
        </motion.div>

        {/* Active Journeys Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 mb-8"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Active Campaigns
            </h2>
          </div>
          
          {journeysLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : activeJourneys.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-gradient-to-br from-primary/10 via-purple-500/10 to-primary/5 rounded-2xl border-2 border-primary/30 relative overflow-hidden"
            >
              {/* Animated sparkles background */}
              <div className="absolute inset-0 pointer-events-none">
                <Sparkles className="absolute top-4 left-8 w-4 h-4 text-primary/40 animate-pulse" />
                <Sparkles className="absolute top-8 right-12 w-3 h-3 text-purple-400/40 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute bottom-6 left-16 w-3 h-3 text-primary/30 animate-pulse" style={{ animationDelay: '1s' }} />
                <Sparkles className="absolute bottom-10 right-8 w-4 h-4 text-purple-400/30 animate-pulse" style={{ animationDelay: '0.3s' }} />
              </div>
              
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Wand2 className="w-16 h-16 text-primary mx-auto mb-4" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2">Begin Your Journey</h3>
              <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
                Create a campaign with personalized rituals and milestones
              </p>
              
              {/* Hero CTA Button */}
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative inline-block"
              >
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-xl blur-lg opacity-50 animate-pulse" />
                <Button
                  onClick={() => setSmartWizardOpen(true)}
                  size="lg"
                  className="relative h-14 px-8 text-lg font-semibold bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_100%] hover:bg-[length:100%_100%] transition-all duration-500 shadow-lg hover:shadow-primary/25"
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  Start a Campaign
                  <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {activeJourneys.map((journey) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  onComplete={() =>
                    updateJourneyStatus({ epicId: journey.id, status: "completed" })
                  }
                  onAbandon={() =>
                    updateJourneyStatus({ epicId: journey.id, status: "abandoned" })
                  }
                />
              ))}
              
              {/* Subtle add campaign button */}
              {!hasReachedLimit && (
                <div className="flex justify-center pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSmartWizardOpen(true)}
                    className="h-7 w-7 rounded-full opacity-30 hover:opacity-60 text-muted-foreground p-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {hasReachedLimit && (
            <p className="text-xs text-amber-500 text-center">
              Max {MAX_JOURNEYS} active campaigns. Complete one to start another.
            </p>
          )}
        </motion.div>

        {/* Legendary Journeys */}
        {completedJourneys.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Legendary Campaigns
            </h2>
            <div className="space-y-4">
              {completedJourneys.map((journey) => (
                <JourneyCard key={journey.id} journey={journey} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Pathfinder */}
        <Pathfinder
          open={smartWizardOpen}
          onOpenChange={setSmartWizardOpen}
          onCreateEpic={handleCreateJourney}
          isCreating={isCreating}
        />

        
        {/* Add Quest Sheet */}
        <AddQuestSheet
          open={showAddSheet}
          onOpenChange={setShowAddSheet}
          selectedDate={selectedDate}
          onAdd={handleAddQuest}
          isAdding={isAdding}
          prefilledTime={null}
        />

        <PageInfoModal
          open={showPageInfo}
          onClose={() => setShowPageInfo(false)}
          title="About Quests & Campaigns"
          icon={Compass}
          description="Quests and Campaigns unite your daily tasks and recurring rituals into one powerful view."
          features={[
            "Complete daily quests to earn XP",
            "Rituals repeat automatically to build habits",
            "Link rituals to campaigns for bonus progress",
            "Track your streak and maintain momentum",
            "Join guilds to campaign with others"
          ]}
          tip="Create campaigns to link your daily rituals to bigger goals!"
        />

        <HourlyViewModal
          open={showHourlyModal}
          onOpenChange={setShowHourlyModal}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          tasks={allCalendarTasks.map(task => ({
            id: task.id,
            task_text: task.task_text,
            completed: task.completed || false,
            scheduled_time: task.scheduled_time,
            estimated_duration: task.estimated_duration,
            task_date: task.task_date,
            difficulty: task.difficulty,
            xp_reward: task.xp_reward,
            is_main_quest: task.is_main_quest || false,
          }))}
          onTaskDrop={() => {}}
        />
        <JourneysTutorialModal 
          open={showTutorial} 
          onClose={dismissTutorial} 
        />
      </div>


      <BottomNav />
    </PageTransition>
  );
};

export default Journeys;
