import { useState, useCallback, useEffect, useMemo } from "react";
import { EPIC_XP_REWARDS } from "@/config/xpRewards";
import { getHabitLimitForTier, DifficultyTier } from "@/config/habitLimits";
import { categorizeQuest } from "@/utils/questCategorization";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Target, Zap, Swords, Sparkles, Leaf, Sun, ChevronLeft, ChevronRight } from "lucide-react";
import { EpicHabitForm } from "@/components/EpicHabitForm";
import { EpicHabitList } from "@/components/EpicHabitList";
import { StoryTypeSelector } from "@/components/narrative/StoryTypeSelector";
import { cn } from "@/lib/utils";
import { EpicTemplate } from "@/hooks/useEpicTemplates";
import type { StoryTypeSlug } from "@/types/narrativeTypes";

type HabitCategory = 'mind' | 'body' | 'soul';

type EpicTheme = 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar';

const themeConfig: Record<EpicTheme, { icon: typeof Target; label: string; colors: string; gradient: string }> = {
  heroic: {
    icon: Target,
    label: "Heroic",
    colors: "from-epic-heroic to-purple-500",
    gradient: "bg-gradient-to-r from-epic-heroic/20 to-purple-500/20 border-epic-heroic/40"
  },
  warrior: {
    icon: Swords,
    label: "Warrior",
    colors: "from-epic-warrior to-orange-500",
    gradient: "bg-gradient-to-r from-epic-warrior/20 to-orange-500/20 border-epic-warrior/40"
  },
  mystic: {
    icon: Sparkles,
    label: "Mystic",
    colors: "from-epic-mystic to-blue-500",
    gradient: "bg-gradient-to-r from-epic-mystic/20 to-blue-500/20 border-epic-mystic/40"
  },
  nature: {
    icon: Leaf,
    label: "Nature",
    colors: "from-epic-nature to-emerald-500",
    gradient: "bg-gradient-to-r from-epic-nature/20 to-emerald-500/20 border-epic-nature/40"
  },
  solar: {
    icon: Sun,
    label: "Solar",
    colors: "from-epic-solar to-amber-500",
    gradient: "bg-gradient-to-r from-epic-solar/20 to-amber-500/20 border-epic-solar/40"
  }
};

interface NewHabit {
  title: string;
  description?: string;
  difficulty: "easy" | "medium" | "hard";
  frequency: string;
  custom_days: number[];
  preferred_time?: string;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
  category?: HabitCategory;
}

interface CreateEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEpic: (data: {
    title: string;
    description?: string;
    target_days: number;
    habits: NewHabit[];
    is_public?: boolean;
    theme_color?: EpicTheme;
    story_type_slug?: StoryTypeSlug;
  }) => void;
  isCreating: boolean;
  template?: EpicTemplate | null;
}

export const CreateEpicDialog = ({
  open,
  onOpenChange,
  onCreateEpic,
  isCreating,
  template,
}: CreateEpicDialogProps) => {
  const [step, setStep] = useState<"story" | "details">("story");
  const [storyType, setStoryType] = useState<StoryTypeSlug | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDays, setTargetDays] = useState(30);
  const [themeColor, setThemeColor] = useState<EpicTheme>('heroic');
  const [difficultyTier, setDifficultyTier] = useState<DifficultyTier>("beginner");
  const [newHabits, setNewHabits] = useState<NewHabit[]>([]);
  const [currentHabitTitle, setCurrentHabitTitle] = useState("");
  const [currentHabitDescription, setCurrentHabitDescription] = useState("");
  const [currentHabitDifficulty, setCurrentHabitDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [currentHabitDays, setCurrentHabitDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [currentPreferredTime, setCurrentPreferredTime] = useState("");
  const [currentReminderEnabled, setCurrentReminderEnabled] = useState(false);
  const [currentReminderMinutes, setCurrentReminderMinutes] = useState(15);
  const [editingHabitIndex, setEditingHabitIndex] = useState<number | null>(null);

  // Dynamic habit limit based on difficulty tier
  const maxHabits = useMemo(() => getHabitLimitForTier(difficultyTier), [difficultyTier]);
  // Pre-fill from template when selected
  useEffect(() => {
    if (template && open) {
      setTitle(template.name);
      setDescription(template.description);
      setTargetDays(template.target_days);
      setThemeColor(template.theme_color as EpicTheme || 'heroic');
      
      // Set difficulty tier from template
      const tier = (template.difficulty_tier as DifficultyTier) || "beginner";
      setDifficultyTier(tier);
      const limit = getHabitLimitForTier(tier);
      
      // Convert template habits to NewHabit format (respect tier limit)
      const templateHabits: NewHabit[] = template.habits.slice(0, limit).map(h => ({
        title: h.title,
        description: h.description || undefined,
        difficulty: h.difficulty as "easy" | "medium" | "hard",
        frequency: h.frequency || 'daily',
        custom_days: h.frequency === 'daily' ? [] : [0, 1, 2, 3, 4, 5, 6],
      }));
      setNewHabits(templateHabits);
      
      // Warn if template had more habits than allowed for tier
      if (template.habits.length > limit) {
        console.info(`Template "${template.name}" has ${template.habits.length} habits, truncated to ${limit} for ${tier} tier`);
      }
    }
  }, [template, open]);

  const addHabit = useCallback(() => {
    if (!currentHabitTitle.trim()) return;
    
    // Auto-categorize based on habit title
    const autoCategory = categorizeQuest(currentHabitTitle) as HabitCategory | null;
    
    const newHabit: NewHabit = {
      title: currentHabitTitle.trim(),
      description: currentHabitDescription.trim() || undefined,
      difficulty: currentHabitDifficulty,
      frequency: currentHabitDays.length === 7 ? 'daily' : 'custom',
      custom_days: currentHabitDays.length === 7 ? [] : currentHabitDays,
      preferred_time: currentPreferredTime || undefined,
      reminder_enabled: currentReminderEnabled,
      reminder_minutes_before: currentReminderMinutes,
      category: autoCategory || 'soul', // Default to 'soul' for personal growth
    };
    
    if (editingHabitIndex !== null) {
      // Update existing habit
      setNewHabits(prev => prev.map((h, i) => i === editingHabitIndex ? newHabit : h));
      setEditingHabitIndex(null);
    } else if (newHabits.length < maxHabits) {
      // Add new habit
      setNewHabits(prev => [...prev, newHabit]);
    }
    
    // Reset form fields
    setCurrentHabitTitle("");
    setCurrentHabitDescription("");
    setCurrentHabitDifficulty("medium");
    setCurrentHabitDays([0, 1, 2, 3, 4, 5, 6]);
    setCurrentPreferredTime("");
    setCurrentReminderEnabled(false);
    setCurrentReminderMinutes(15);
  }, [currentHabitTitle, currentHabitDescription, currentHabitDifficulty, currentHabitDays, currentPreferredTime, currentReminderEnabled, currentReminderMinutes, newHabits.length, editingHabitIndex, maxHabits]);

  const editHabit = useCallback((index: number) => {
    const habit = newHabits[index];
    setCurrentHabitTitle(habit.title);
    setCurrentHabitDescription(habit.description || "");
    setCurrentHabitDifficulty(habit.difficulty);
    setCurrentHabitDays(habit.frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : habit.custom_days);
    setCurrentPreferredTime(habit.preferred_time || "");
    setCurrentReminderEnabled(habit.reminder_enabled || false);
    setCurrentReminderMinutes(habit.reminder_minutes_before || 15);
    setEditingHabitIndex(index);
  }, [newHabits]);

  const cancelEdit = useCallback(() => {
    setEditingHabitIndex(null);
    setCurrentHabitTitle("");
    setCurrentHabitDescription("");
    setCurrentHabitDifficulty("medium");
    setCurrentHabitDays([0, 1, 2, 3, 4, 5, 6]);
    setCurrentPreferredTime("");
    setCurrentReminderEnabled(false);
    setCurrentReminderMinutes(15);
  }, []);

  const removeHabit = useCallback((index: number) => {
    setNewHabits(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!title.trim() || newHabits.length === 0) return;

    onCreateEpic({
      title: title.trim(),
      description: description.trim() || undefined,
      target_days: targetDays,
      habits: newHabits,
      is_public: true,
      theme_color: themeColor,
      story_type_slug: storyType || undefined,
    });

    // Reset form
    resetForm();
  }, [title, description, targetDays, newHabits, themeColor, storyType, onCreateEpic]);

  const resetForm = () => {
    setStep("story");
    setStoryType(null);
    setTitle("");
    setDescription("");
    setTargetDays(30);
    setThemeColor('heroic');
    setDifficultyTier("beginner");
    setNewHabits([]);
    setCurrentHabitTitle("");
    setCurrentHabitDescription("");
    setCurrentHabitDifficulty("medium");
    setCurrentHabitDays([0, 1, 2, 3, 4, 5, 6]);
    setCurrentPreferredTime("");
    setCurrentReminderEnabled(false);
    setCurrentReminderMinutes(15);
    setEditingHabitIndex(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const calculateXPReward = useCallback(() => targetDays * EPIC_XP_REWARDS.XP_PER_DAY, [targetDays]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template?.badge_icon && <span className="text-xl">{template.badge_icon}</span>}
            <Target className="w-5 h-5 text-primary" />
            {template ? `Start: ${template.name}` : step === "story" ? "Choose Your Adventure" : "Create Legendary Epic"}
          </DialogTitle>
          <DialogDescription>
            {template ? (
              <span className="flex items-center gap-2">
                Starting from template
                <Badge variant="secondary" className="text-xs">
                  {template.difficulty_tier}
                </Badge>
              </span>
            ) : step === "story" ? (
              "Select the type of story you want to experience"
            ) : (
              "Create an epic and add habits to track your progress."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Story Type Selection */}
        {step === "story" && !template && (
          <div className="space-y-4">
            <StoryTypeSelector
              selectedType={storyType}
              onSelect={setStoryType}
            />

            {/* Duration Preview */}
            <div className="space-y-2">
              <Label>Epic Duration</Label>
              <div className="flex gap-2">
                {[14, 30, 45, 60].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    variant={targetDays === days ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTargetDays(days)}
                    className="flex-1"
                  >
                    {days}d
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setStep("details")}
              disabled={!storyType}
              className="w-full"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setStoryType(null);
                setStep("details");
              }}
              className="w-full text-muted-foreground"
            >
              Skip story selection
            </Button>
          </div>
        )}

        {/* Step 2: Epic Details (or direct if template) */}
        {(step === "details" || template) && (
          <div className="space-y-4">
            {/* Back button */}
            {!template && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("story")}
                className="mb-2"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Change story type
              </Button>
            )}

            {/* Epic Name */}
            <div className="space-y-2">
              <Label htmlFor="epic-title">Epic Name *</Label>
              <Input
                id="epic-title"
                placeholder="e.g., Become a Morning Warrior"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="epic-description">Epic Quest Description</Label>
              <Textarea
                id="epic-description"
                placeholder="What legendary feat will you accomplish?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={200}
                style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
              />
            </div>

            {/* Duration (if not already set in story step) */}
            {template && (
              <div className="space-y-2">
                <Label htmlFor="target-days">Epic Duration (Days)</Label>
                <div className="flex gap-2">
                  {[7, 14, 21, 30, 60].map((days) => (
                    <Button
                      key={days}
                      type="button"
                      variant={targetDays === days ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTargetDays(days)}
                      className="flex-1"
                    >
                      {days}d
                    </Button>
                  ))}
                </div>
                <Input
                  id="target-days"
                  type="number"
                  min={1}
                  max={365}
                  value={targetDays}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 1 && value <= 365) {
                      setTargetDays(value);
                    } else if (e.target.value === "") {
                      setTargetDays(1);
                    }
                  }}
                  className="mt-2"
                />
              </div>
            )}

            {/* Epic Theme Selector */}
            <div className="space-y-2">
              <Label>Epic Theme</Label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(themeConfig) as EpicTheme[]).map((theme) => {
                  const config = themeConfig[theme];
                  const Icon = config.icon;
                  return (
                    <Button
                      key={theme}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setThemeColor(theme)}
                      className={cn(
                        "flex flex-col items-center gap-1 h-auto py-3 transition-all",
                        themeColor === theme 
                          ? `${config.gradient} border-2 shadow-lg` 
                          : "hover:bg-muted"
                      )}
                    >
                      <Icon className={cn(
                        "h-5 w-5",
                        themeColor === theme && `bg-gradient-to-r ${config.colors} bg-clip-text text-transparent`
                      )} />
                      <span className="text-xs">{config.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Habits */}
            <div className="space-y-3">
              <Label>Epic Habits {template ? "(from template)" : "(Required)"}</Label>
              
              <EpicHabitList 
                habits={newHabits} 
                onRemove={removeHabit} 
                onEdit={editHabit}
              />
              
              {/* Add/Edit habit form */}
              {(newHabits.length < maxHabits || editingHabitIndex !== null) && (
                <EpicHabitForm
                  habitTitle={currentHabitTitle}
                  habitDescription={currentHabitDescription}
                  difficulty={currentHabitDifficulty}
                  selectedDays={currentHabitDays}
                  habitCount={newHabits.length}
                  maxHabits={maxHabits}
                  preferredTime={currentPreferredTime}
                  reminderEnabled={currentReminderEnabled}
                  reminderMinutesBefore={currentReminderMinutes}
                  onTitleChange={setCurrentHabitTitle}
                  onDescriptionChange={setCurrentHabitDescription}
                  onDifficultyChange={setCurrentHabitDifficulty}
                  onDaysChange={setCurrentHabitDays}
                  onPreferredTimeChange={setCurrentPreferredTime}
                  onReminderEnabledChange={setCurrentReminderEnabled}
                  onReminderMinutesChange={setCurrentReminderMinutes}
                  onAddHabit={addHabit}
                  isEditing={editingHabitIndex !== null}
                  onCancelEdit={cancelEdit}
                />
              )}
              
              <p className="text-xs text-muted-foreground">
                Add up to {maxHabits} habit{maxHabits > 1 ? 's' : ''} that contribute to this epic
                {difficultyTier === 'advanced' && ' (Advanced tier unlocks 3 habits)'}
              </p>
            </div>

            {/* XP Reward Preview */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium">Epic Completion Reward</span>
              </div>
              <span className="text-lg font-bold text-primary">
                +{calculateXPReward()} XP
              </span>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || newHabits.length === 0 || isCreating}
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              {isCreating ? "Creating Epic..." : template ? `Start ${template.name}! 🎯` : "Begin Epic Quest! 🎯"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
