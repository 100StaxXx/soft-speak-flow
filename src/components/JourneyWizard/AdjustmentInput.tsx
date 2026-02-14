import { useState } from 'react';
import { MessageSquare, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AdjustmentInputProps {
  onSubmit: (feedback: string) => void;
  isLoading?: boolean;
}

const quickAdjustments = [
  { label: 'Less aggressive', value: 'Make the schedule less aggressive, I need more breathing room' },
  { label: 'More intensive', value: 'I can dedicate more time, make it more intensive' },
  { label: 'Fewer milestones', value: 'Reduce the number of milestones, keep only the essential ones' },
  { label: 'More rest days', value: 'Include more rest days and recovery time' },
];

export function AdjustmentInput({ onSubmit, isLoading }: AdjustmentInputProps) {
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleQuickAdjust = (value: string) => {
    onSubmit(value);
  };

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    onSubmit(customInput.trim());
    setCustomInput('');
    setShowCustom(false);
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-muted/50 rounded-xl border border-dashed flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Adjusting your plan...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Want to adjust the plan?
      </p>

      {/* Quick adjustments */}
      <div className="flex flex-wrap gap-2">
        {quickAdjustments.map(adj => (
          <Button
            key={adj.label}
            variant="outline"
            size="sm"
            onClick={() => handleQuickAdjust(adj.value)}
            className="text-xs"
          >
            {adj.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Custom request
        </Button>
      </div>

      {/* Custom input */}
      {showCustom && (
        <div className="flex gap-2">
          <Input
            placeholder="e.g., 'I have prior experience, skip the basics'"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            className="flex-1"
          />
          <Button 
            onClick={handleCustomSubmit}
            disabled={!customInput.trim()}
            size="sm"
          >
            Adjust
          </Button>
        </div>
      )}
    </div>
  );
}
