import { useState, useMemo } from "react";
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
  Send
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { JourneyCard } from "@/components/JourneyCard";
import { TodaysAgenda } from "@/components/TodaysAgenda";
import { SmartEpicWizard } from "@/components/SmartEpicWizard";
import { DatePillsScroller } from "@/components/DatePillsScroller";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { useEpics } from "@/hooks/useEpics";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import type { StoryTypeSlug } from "@/types/narrativeTypes";
import { cn } from "@/lib/utils";

const MAX_JOURNEYS = 2;

const Journeys = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [smartWizardOpen, setSmartWizardOpen] = useState(false);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  
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
            {!hasReachedLimit && (
              <Button
                onClick={() => setSmartWizardOpen(true)}
                size="sm"
                className="bg-gradient-to-r from-primary to-purple-600"
              >
                <Wand2 className="w-4 h-4 mr-1" />
                New
              </Button>
            )}
          </div>
          
          {journeysLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : activeJourneys.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 bg-secondary/20 rounded-xl border-2 border-dashed border-primary/20"
            >
              <Wand2 className="w-12 h-12 text-primary mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold mb-1">No Active Campaigns</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                Use Pathfinder to create a personalized campaign with daily rituals
              </p>
              <Button
                onClick={() => setSmartWizardOpen(true)}
                className="bg-gradient-to-r from-primary to-purple-600"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Start a Campaign
              </Button>
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

        {/* Smart Journey Wizard */}
        <SmartEpicWizard
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
          description="Quests & Campaigns unite your daily tasks and recurring rituals into one powerful view."
          features={[
            "Complete daily quests to earn XP",
            "Rituals repeat automatically to build habits",
            "Link rituals to campaigns for bonus progress",
            "Track your streak and maintain momentum",
            "Use Pathfinder to create personalized campaigns"
          ]}
          tip="Use Pathfinder to create a campaign with rituals pre-configured for your goal!"
        />
      </div>

      {/* Floating Add Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: "spring" }}
        className="fixed bottom-24 right-4 z-40"
      >
        <Button
          onClick={() => setShowAddSheet(true)}
          size="lg"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg",
            "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          )}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </motion.div>

      <BottomNav />
    </PageTransition>
  );
};

export default Journeys;
