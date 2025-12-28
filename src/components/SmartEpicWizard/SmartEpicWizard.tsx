import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Wand2,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Target,
  Plus,
  Mic,
  Calendar,
  Zap,
  Repeat,
  Flag,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEpicSuggestions, type EpicSuggestion } from '@/hooks/useEpicSuggestions';
import { useEpicTemplates, EpicTemplate } from '@/hooks/useEpicTemplates';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { SuggestionCard } from './SuggestionCard';
import { StoryStep, themeColors } from './StoryStep';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { EPIC_XP_REWARDS } from '@/config/xpRewards';
import type { StoryTypeSlug } from '@/types/narrativeTypes';

type WizardStep = 'goal' | 'suggestions' | 'story' | 'review';

interface SmartEpicWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEpic: (data: {
    title: string;
    description?: string;
    target_days: number;
    habits: Array<{
      title: string;
      difficulty: string;
      frequency: string;
      custom_days: number[];
    }>;
    is_public?: boolean;
    story_type_slug?: StoryTypeSlug;
    theme_color?: string;
  }) => void;
  isCreating: boolean;
  initialGoal?: string;
  initialTargetDays?: number;
  template?: EpicTemplate | null;
  showTemplatesFirst?: boolean;
}

export function SmartEpicWizard({
  open,
  onOpenChange,
  onCreateEpic,
  isCreating,
  initialGoal = '',
  initialTargetDays,
  template,
  showTemplatesFirst = false,
}: SmartEpicWizardProps) {
  const [step, setStep] = useState<WizardStep>('goal');
  const [goalMode, setGoalMode] = useState<'custom' | 'template'>(showTemplatesFirst ? 'template' : 'custom');
  const [goalInput, setGoalInput] = useState(initialGoal);
  const [targetDays, setTargetDays] = useState(initialTargetDays || 30);
  const [epicTitle, setEpicTitle] = useState('');
  const [epicDescription, setEpicDescription] = useState('');
  const [customHabits, setCustomHabits] = useState<EpicSuggestion[]>([]);
  const [storyType, setStoryType] = useState<StoryTypeSlug | null>(null);
  const [themeColor, setThemeColor] = useState(themeColors[0].value);
  const [selectedTemplate, setSelectedTemplate] = useState<EpicTemplate | null>(template || null);
  const { medium, success, light, tap } = useHapticFeedback();
  const { templates, featuredTemplates, isLoading: templatesLoading, incrementPopularity } = useEpicTemplates();
  const {
    suggestions,
    isLoading: isGenerating,
    error,
    generateSuggestions,
    toggleSuggestion,
    selectAll,
    deselectAll,
    getSelectedSuggestions,
    reset: resetSuggestions,
  } = useEpicSuggestions();

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate && open) {
      setEpicTitle(selectedTemplate.name);
      setEpicDescription(selectedTemplate.description);
      setTargetDays(selectedTemplate.target_days);
      setThemeColor(selectedTemplate.theme_color || themeColors[0].value);
      
      // Convert template habits to suggestions format
      const templateSuggestions: EpicSuggestion[] = selectedTemplate.habits.map((h, idx) => ({
        id: `template-${idx}`,
        type: 'habit' as const,
        title: h.title,
        description: '',
        difficulty: (h.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        frequency: (h.frequency === 'weekly' ? 'weekly' : h.frequency === 'custom' ? 'custom' : 'daily') as 'daily' | 'weekly' | 'custom',
        isSelected: true,
      }));
      setCustomHabits(templateSuggestions);
      setStep('story');
    }
  }, [selectedTemplate, open]);

  // Apply initial template prop
  useEffect(() => {
    if (template && open) {
      setSelectedTemplate(template);
    }
  }, [template, open]);

  const [interimText, setInterimText] = useState('');
  
  const {
    isRecording,
    isAutoStopping,
    startRecording,
    stopRecording,
  } = useVoiceInput({
    onInterimResult: (text) => setInterimText(text),
    onFinalResult: (text) => {
      setGoalInput((prev) => (prev ? prev + ' ' + text : text).trim());
      setInterimText('');
      success();
    },
    autoStopOnSilence: true,
    silenceTimeoutMs: 2000,
  });

  const selectedSuggestions = useMemo(() => getSelectedSuggestions(), [getSelectedSuggestions]);
  const selectedHabits = useMemo(
    () => [...selectedSuggestions.filter((s) => s.type === 'habit'), ...customHabits],
    [selectedSuggestions, customHabits]
  );
  const selectedMilestones = useMemo(
    () => selectedSuggestions.filter((s) => s.type === 'milestone'),
    [selectedSuggestions]
  );

  const calculateXP = useMemo(() => targetDays * EPIC_XP_REWARDS.XP_PER_DAY, [targetDays]);

  const handleGenerateSuggestions = useCallback(async () => {
    if (!goalInput.trim()) return;
    tap();
    await generateSuggestions(goalInput, { targetDays });
    setStep('suggestions');
    success();
  }, [goalInput, targetDays, generateSuggestions, tap, success]);

  const handleProceedToStory = useCallback(() => {
    if (selectedSuggestions.length === 0) return;
    // Auto-fill epic title from goal if not set
    if (!epicTitle) {
      setEpicTitle(goalInput);
    }
    setStep('story');
    medium();
  }, [selectedSuggestions.length, epicTitle, goalInput, medium]);

  const handleProceedToReview = useCallback(() => {
    if (!storyType) return;
    setStep('review');
    medium();
  }, [storyType, medium]);

  const handleCreateEpic = useCallback(() => {
    if (selectedHabits.length === 0) return;

    const habits = selectedHabits.map((h) => ({
      title: h.title,
      difficulty: h.difficulty,
      frequency: h.frequency || 'daily',
      custom_days: h.customDays || [],
    }));

    onCreateEpic({
      title: epicTitle || goalInput,
      description: epicDescription || undefined,
      target_days: targetDays,
      habits,
      is_public: true,
      story_type_slug: storyType || undefined,
      theme_color: themeColor,
    });

    success();
  }, [selectedHabits, epicTitle, goalInput, epicDescription, targetDays, storyType, themeColor, onCreateEpic, success]);

  const handleBack = useCallback(() => {
    light();
    if (step === 'suggestions') setStep('goal');
    else if (step === 'story') setStep('suggestions');
    else if (step === 'review') setStep('story');
  }, [step, light]);

  const handleClose = useCallback(() => {
    setStep('goal');
    setGoalMode(showTemplatesFirst ? 'template' : 'custom');
    setGoalInput(initialGoal);
    setTargetDays(initialTargetDays || 30);
    setEpicTitle('');
    setEpicDescription('');
    setCustomHabits([]);
    setStoryType(null);
    setThemeColor(themeColors[0].value);
    setSelectedTemplate(null);
    resetSuggestions();
    onOpenChange(false);
  }, [onOpenChange, resetSuggestions, initialGoal, initialTargetDays, showTemplatesFirst]);

  const handleSelectTemplate = useCallback((template: EpicTemplate) => {
    incrementPopularity.mutate(template.id);
    setSelectedTemplate(template);
    tap();
  }, [incrementPopularity, tap]);

  const handleVoiceToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
    tap();
  }, [isRecording, startRecording, stopRecording, tap]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Smart Epic Wizard
          </DialogTitle>
          <DialogDescription>
            {step === 'goal' && 'Tell us your goal and we\'ll help you build the perfect epic'}
            {step === 'suggestions' && 'Select the habits and milestones that work for you'}
            {step === 'story' && 'Choose your narrative adventure style'}
            {step === 'review' && 'Review and customize your epic before creating'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {(['goal', 'suggestions', 'story', 'review'] as const).map((s, i) => {
              const steps: readonly WizardStep[] = ['goal', 'suggestions', 'story', 'review'];
              const currentIndex = steps.indexOf(step);
              return (
                <div key={s} className="flex items-center">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                      step === s
                        ? 'bg-primary text-primary-foreground'
                        : currentIndex > i
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {currentIndex > i ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 3 && (
                    <div
                      className={cn(
                        'w-6 h-0.5 mx-1',
                        currentIndex > i
                          ? 'bg-primary'
                          : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step 1: Goal Input */}
            {step === 'goal' && (
              <motion.div
                key="goal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-6 pb-6 space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="goal-input" className="text-base font-semibold">
                    What's your goal?
                  </Label>
                  <div className="relative">
                    <Textarea
                      id="goal-input"
                      placeholder="e.g., Get my real estate license by June"
                      value={isRecording ? goalInput + (interimText ? ' ' + interimText : '') : goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      rows={3}
                      className="pr-12 text-base"
                    />
                    <Button
                      size="icon"
                      variant={isRecording ? 'default' : 'ghost'}
                      className={cn(
                        'absolute right-2 top-2 h-8 w-8',
                        isRecording && 'animate-pulse bg-red-500 hover:bg-red-600'
                      )}
                      onClick={handleVoiceToggle}
                      disabled={isAutoStopping}
                    >
                      <Mic className="w-4 h-4" />
                    </Button>
                  </div>
                  {isRecording && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      Listening...
                    </p>
                  )}
                </div>

                {/* Duration selector */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Timeline
                  </Label>
                  <div className="flex gap-2">
                    {[14, 30, 60, 90].map((days) => (
                      <Button
                        key={days}
                        type="button"
                        variant={targetDays === days ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTargetDays(days)}
                        className="flex-1"
                      >
                        {days}d
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <Button
                  onClick={handleGenerateSuggestions}
                  disabled={!goalInput.trim() || isGenerating}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate Smart Suggestions
                    </>
                  )}
                </Button>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
              </motion.div>
            )}

            {/* Step 2: Suggestions */}
            {step === 'suggestions' && (
              <motion.div
                key="suggestions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Goal summary */}
                <div className="px-6 pb-3">
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium truncate">{goalInput}</p>
                    <p className="text-xs text-muted-foreground">{targetDays} days</p>
                  </div>
                </div>

                {/* Selection controls */}
                <div className="px-6 pb-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedSuggestions.length} of {suggestions.length} selected
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}>
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Suggestions list */}
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-3 pb-4">
                    {/* Habits section */}
                    {suggestions.filter((s) => s.type === 'habit').length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Repeat className="w-4 h-4" />
                          Recurring Habits
                        </div>
                        {suggestions
                          .filter((s) => s.type === 'habit')
                          .map((suggestion, i) => (
                            <SuggestionCard
                              key={suggestion.id}
                              suggestion={suggestion}
                              onToggle={toggleSuggestion}
                              index={i}
                            />
                          ))}
                      </div>
                    )}

                    {/* Milestones section */}
                    {suggestions.filter((s) => s.type === 'milestone').length > 0 && (
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Flag className="w-4 h-4" />
                          Milestones
                        </div>
                        {suggestions
                          .filter((s) => s.type === 'milestone')
                          .map((suggestion, i) => (
                            <SuggestionCard
                              key={suggestion.id}
                              suggestion={suggestion}
                              onToggle={toggleSuggestion}
                              index={i}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Actions */}
                <div className="p-6 pt-4 border-t bg-background space-y-3">
                  <Button
                    onClick={handleProceedToStory}
                    disabled={selectedSuggestions.length === 0}
                    className="w-full"
                  >
                    Continue with {selectedSuggestions.length} items
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button variant="ghost" onClick={handleBack} className="w-full">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Goal
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Story & Theme */}
            {step === 'story' && (
              <StoryStep
                storyType={storyType}
                themeColor={themeColor}
                targetDays={targetDays}
                onStoryTypeChange={setStoryType}
                onThemeColorChange={setThemeColor}
                onContinue={handleProceedToReview}
                onBack={handleBack}
              />
            )}

            {/* Step 4: Review */}
            {step === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 pb-4">
                    {/* Epic title */}
                    <div className="space-y-2">
                      <Label htmlFor="epic-title">Epic Name</Label>
                      <Input
                        id="epic-title"
                        value={epicTitle}
                        onChange={(e) => setEpicTitle(e.target.value)}
                        placeholder="Name your epic quest"
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="epic-desc">Description (optional)</Label>
                      <Textarea
                        id="epic-desc"
                        value={epicDescription}
                        onChange={(e) => setEpicDescription(e.target.value)}
                        placeholder="Add more details about your goal"
                        rows={2}
                      />
                    </div>

                    {/* Selected items summary */}
                    <div className="space-y-3">
                      <Label>Selected Items</Label>
                      
                      {/* Habits */}
                      {selectedHabits.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            {selectedHabits.length} Habits
                          </p>
                          {selectedHabits.map((h) => (
                            <div
                              key={h.id}
                              className="p-2 bg-secondary/50 rounded-lg text-sm flex items-center justify-between"
                            >
                              <span>{h.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {h.frequency}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Milestones */}
                      {selectedMilestones.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Flag className="w-3 h-3" />
                            {selectedMilestones.length} Milestones
                          </p>
                          {selectedMilestones.map((m) => (
                            <div
                              key={m.id}
                              className="p-2 bg-amber-500/10 rounded-lg text-sm flex items-center justify-between"
                            >
                              <span>{m.title}</span>
                              {m.suggestedWeek && (
                                <Badge variant="outline" className="text-xs">
                                  Week {m.suggestedWeek}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* XP Preview */}
                    <div className="p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-primary" />
                          <span className="font-medium">Completion Reward</span>
                        </div>
                        <span className="text-xl font-bold text-primary">
                          +{calculateXP} XP
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {targetDays} days × {EPIC_XP_REWARDS.XP_PER_DAY} XP/day
                      </p>
                    </div>
                  </div>
                </ScrollArea>

                {/* Actions */}
                <div className="p-6 pt-4 border-t bg-background space-y-3">
                  <Button
                    onClick={handleCreateEpic}
                    disabled={isCreating || selectedHabits.length === 0}
                    className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-2" />
                        Create Epic
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" onClick={handleBack} className="w-full">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Story
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
