import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings2, 
  Clock, 
  Minus, 
  Plus, 
  Calendar,
  Sparkles,
  Check,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Loader2,
  type LucideIcon
} from 'lucide-react';
import { cn, stripMarkdown } from '@/lib/utils';
import { useAdjustEpicPlan, type AdjustmentType, type AdjustmentSuggestion } from '@/hooks/useAdjustEpicPlan';

interface AdjustEpicPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epicId: string;
  epicTitle: string;
}

const adjustmentOptions: { type: AdjustmentType; icon: LucideIcon; label: string; description: string }[] = [
  { type: 'reduce_scope', icon: Minus, label: 'Simplify Plan', description: 'Reduce habits or milestones' },
  { type: 'extend_deadline', icon: Clock, label: 'Extend Deadline', description: 'Add more time' },
  { type: 'add_habits', icon: Plus, label: 'Add Habits', description: 'Boost your progress' },
  { type: 'reschedule', icon: Calendar, label: 'Reschedule', description: 'Adjust timing' },
  { type: 'custom', icon: Settings2, label: 'Custom', description: 'Describe your needs' },
];

export function AdjustEpicPlanDialog({ open, onOpenChange, epicId, epicTitle }: AdjustEpicPlanDialogProps) {
  const [step, setStep] = useState<'select' | 'reason' | 'suggestions'>('select');
  const [selectedType, setSelectedType] = useState<AdjustmentType | null>(null);
  const [reason, setReason] = useState('');
  
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

  const handleSelectType = (type: AdjustmentType) => {
    setSelectedType(type);
    if (type === 'custom') {
      setStep('reason');
    } else {
      setStep('reason');
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!selectedType) return;
    
    await generateAdjustments(epicId, selectedType, {
      reason: reason || undefined,
      customRequest: selectedType === 'custom' ? reason : undefined,
    });
    
    setStep('suggestions');
  };

  const handleApply = async () => {
    const success = await applyAdjustments(epicId, selectedType || undefined, reason || undefined);
    if (success) {
      handleClose();
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedType(null);
    setReason('');
    reset();
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'suggestions') {
      setStep('reason');
    } else if (step === 'reason') {
      setStep('select');
      setSelectedType(null);
    }
  };

  const getSuggestionIcon = (suggestion: AdjustmentSuggestion) => {
    switch (suggestion.action) {
      case 'add': return <Plus className="h-4 w-4 text-green-500" />;
      case 'remove': return <Minus className="h-4 w-4 text-red-500" />;
      default: return <Settings2 className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Adjust Plan
          </DialogTitle>
          <DialogDescription>
            {epicTitle}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Adjustment Type */}
        {step === 'select' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              What kind of adjustment do you need?
            </p>
            <div className="grid gap-2">
              {adjustmentOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <Button
                    key={option.type}
                    variant="outline"
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => handleSelectType(option.type)}
                  >
                    <IconComponent className="h-5 w-5 mr-3 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Provide Reason */}
        {step === 'reason' && selectedType && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
              ← Back
            </Button>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {selectedType === 'custom' 
                  ? 'Describe what you need' 
                  : 'Why do you need this adjustment? (optional)'}
              </label>
              <Textarea
                placeholder={
                  selectedType === 'custom'
                    ? "Describe the changes you'd like to make..."
                    : "e.g., I've been sick, or my schedule changed..."
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
            
            <Button 
              onClick={handleGenerateSuggestions} 
              className="w-full"
              disabled={isLoading || (selectedType === 'custom' && !reason.trim())}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get Suggestions
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Review Suggestions */}
        {step === 'suggestions' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2">
              ← Back
            </Button>

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
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <Card
                    key={suggestion.id}
                    className={cn(
                      "p-3 cursor-pointer transition-all border-2",
                      suggestion.selected
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-primary/30"
                    )}
                    onClick={() => toggleSuggestion(suggestion.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                        suggestion.selected 
                          ? "bg-primary text-primary-foreground" 
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
                          {stripMarkdown(suggestion.description)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Encouragement */}
            {encouragement && (
              <p className="text-sm text-primary italic text-center">
                "{encouragement}"
              </p>
            )}

            {/* Apply Button */}
            <Button
              onClick={handleApply}
              className="w-full"
              disabled={getSelectedSuggestions().length === 0}
            >
              Apply {getSelectedSuggestions().length} Change{getSelectedSuggestions().length !== 1 ? 's' : ''}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
