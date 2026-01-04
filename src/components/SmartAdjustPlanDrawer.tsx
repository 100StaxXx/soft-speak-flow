import { memo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Wand2, 
  Loader2,
  Sparkles,
  AlertCircle,
  Check,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
  Minus,
  Settings2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAdjustEpicPlan, type AdjustmentSuggestion } from "@/hooks/useAdjustEpicPlan";
import { SmartRitualAdvisor } from "@/components/journey/SmartRitualAdvisor";

interface SmartAdjustPlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epicId: string;
  epicTitle: string;
  habits?: Array<{
    id: string;
    title: string;
    difficulty?: string;
    frequency?: string;
    estimated_minutes?: number | null;
  }>;
  completionData?: Array<{
    habit_id: string;
    completed_at: string;
  }>;
}

export const SmartAdjustPlanDrawer = memo(function SmartAdjustPlanDrawer({ 
  open, 
  onOpenChange, 
  epicId, 
  epicTitle,
  habits = [],
  completionData = [],
}: SmartAdjustPlanDrawerProps) {
  const [step, setStep] = useState<'input' | 'preview' | 'saving'>('input');
  const [adjustmentText, setAdjustmentText] = useState('');
  const [showSmartAdvisor, setShowSmartAdvisor] = useState(true);
  
  const {
    suggestions,
    analysis,
    encouragement,
    epicStatus,
    isLoading,
    generateAdjustments,
    toggleSuggestion,
    getSelectedSuggestions,
    applyAdjustments,
    reset,
  } = useAdjustEpicPlan();

  const handleSmartAdjustment = (text: string) => {
    setAdjustmentText(text);
    setShowSmartAdvisor(false);
  };

  const handleGenerateSuggestions = async () => {
    if (!adjustmentText.trim()) return;
    
    await generateAdjustments(epicId, 'custom', {
      customRequest: adjustmentText,
    });
    
    setStep('preview');
  };

  const handleApply = async () => {
    setStep('saving');
    const success = await applyAdjustments(epicId, 'custom', adjustmentText);
    if (success) {
      handleClose();
    } else {
      setStep('preview');
    }
  };

  const handleClose = () => {
    setStep('input');
    setAdjustmentText('');
    setShowSmartAdvisor(true);
    reset();
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'preview') {
      setStep('input');
    }
  };

  const getSuggestionIcon = (suggestion: AdjustmentSuggestion) => {
    switch (suggestion.action) {
      case 'add': return <Plus className="h-4 w-4 text-green-500" />;
      case 'remove': return <Minus className="h-4 w-4 text-red-500" />;
      default: return <Settings2 className="h-4 w-4 text-purple-500" />;
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose} handleOnly={true} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-400" />
              Smart Adjust Plan
            </DrawerTitle>
            {epicStatus && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  epicStatus.progressDelta >= 0 
                    ? "border-green-500/50 text-green-500"
                    : "border-amber-500/50 text-amber-500",
                )}
              >
                {epicStatus.progressDelta >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {epicStatus.progressDelta >= 0 ? 'On track' : 'Behind'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {step === 'input' && 'Personalized suggestions to optimize your rituals'}
            {step === 'preview' && 'Review and apply the suggested changes'}
            {step === 'saving' && 'Applying changes...'}
          </p>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 max-h-[60vh]">
          <AnimatePresence mode="wait">
            {step === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 pb-4"
              >
                {/* Smart Ritual Advisor */}
                {showSmartAdvisor && habits.length > 0 && (
                  <SmartRitualAdvisor
                    habits={habits}
                    completionData={completionData}
                    onSelectAdjustment={handleSmartAdjustment}
                    onDismiss={() => setShowSmartAdvisor(false)}
                    variant="inline"
                  />
                )}

                {/* Custom Adjustment Text */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Describe your changes
                  </label>
                  <Textarea
                    value={adjustmentText}
                    onChange={(e) => setAdjustmentText(e.target.value)}
                    placeholder="e.g., I want to add a morning meditation habit, or make my current habits easier..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                {/* Current Stats */}
                <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Current journey</div>
                  <div className="text-sm font-medium">{epicTitle}</div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{habits.length} rituals</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 pb-4"
              >
                {/* Epic Status Summary */}
                {epicStatus && (
                  <Card className="p-3 bg-secondary/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{Math.round(epicStatus.actualProgress)}%</span>
                        {epicStatus.progressDelta >= 0 ? (
                          <Badge variant="secondary" className="text-green-600 bg-green-500/10">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            On track
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-amber-600 bg-amber-500/10">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Behind
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {epicStatus.daysRemaining} days remaining
                    </div>
                  </Card>
                )}

                {/* Analysis */}
                {analysis && (
                  <p className="text-sm text-muted-foreground">
                    {analysis}
                  </p>
                )}

                {/* Suggestions List */}
                {suggestions.length > 0 ? (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Suggested changes ({suggestions.length})
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {suggestions.map((suggestion) => (
                        <Card
                          key={suggestion.id}
                          className={cn(
                            "p-3 cursor-pointer transition-all border-2",
                            suggestion.selected
                              ? "border-purple-500 bg-purple-500/5"
                              : "border-transparent hover:border-purple-500/30"
                          )}
                          onClick={() => toggleSuggestion(suggestion.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                              suggestion.selected 
                                ? "bg-purple-500 text-white" 
                                : "bg-secondary"
                            )}>
                              {suggestion.selected ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                getSuggestionIcon(suggestion)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{suggestion.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {suggestion.type.replace('_', ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {suggestion.description}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4" />
                    No suggestions generated. Try a different request.
                  </div>
                )}

                {/* Comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">{habits.length}</div>
                    <div className="text-[10px] text-muted-foreground">Current rituals</div>
                  </div>
                  <div className="bg-purple-500/10 rounded-lg p-3 text-center border border-purple-500/20">
                    <div className="text-lg font-bold text-purple-400">
                      {habits.length + suggestions.filter(s => s.action === 'add' && s.selected).length - suggestions.filter(s => s.action === 'remove' && s.selected).length}
                    </div>
                    <div className="text-[10px] text-muted-foreground">After changes</div>
                  </div>
                </div>

                {/* Encouragement */}
                {encouragement && (
                  <p className="text-sm text-purple-400 italic text-center">
                    "{encouragement}"
                  </p>
                )}
              </motion.div>
            )}

            {step === 'saving' && (
              <motion.div
                key="saving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-3" />
                <p className="text-sm text-muted-foreground">Updating your rituals...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        <DrawerFooter className="border-t pt-4">
          {step === 'input' && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700" 
                onClick={handleGenerateSuggestions}
                disabled={isLoading || !adjustmentText.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Get Suggestions
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleBack}>
                Back
              </Button>
              <Button 
                className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700" 
                onClick={handleApply}
                disabled={getSelectedSuggestions().length === 0}
              >
                Apply {getSelectedSuggestions().length} Change{getSelectedSuggestions().length !== 1 ? 's' : ''}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
});
