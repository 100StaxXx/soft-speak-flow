import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PlanContext, HardCommitment } from '@/hooks/useSmartDayPlanner';
import { Clock, Plus, X, MessageSquare, Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomizeStepProps {
  context: PlanContext;
  updateContext: (updates: Partial<PlanContext>) => void;
  onNext: () => void;
  isGenerating?: boolean;
}

export function CustomizeStep({ context, updateContext, onNext, isGenerating }: CustomizeStepProps) {
  const [showTimeBlockForm, setShowTimeBlockForm] = useState(false);
  const [newBlock, setNewBlock] = useState({
    title: '',
    startTime: '14:00',
    endTime: '15:00',
  });

  const handleAddTimeBlock = () => {
    if (!newBlock.title || !newBlock.startTime || !newBlock.endTime) return;
    
    const commitment: HardCommitment = {
      id: `custom-${Date.now()}`,
      title: newBlock.title,
      startTime: newBlock.startTime,
      endTime: newBlock.endTime,
    };
    
    updateContext({
      hardCommitments: [...context.hardCommitments, commitment],
    });
    
    setNewBlock({ title: '', startTime: '14:00', endTime: '15:00' });
    setShowTimeBlockForm(false);
  };

  const handleRemoveTimeBlock = (id: string) => {
    updateContext({
      hardCommitments: context.hardCommitments.filter(c => c.id !== id),
    });
  };

  const handleRequestChange = (value: string) => {
    updateContext({ adjustmentRequest: value });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const quickDurations = [
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '2 hours', minutes: 120 },
  ];

  const setQuickDuration = (minutes: number) => {
    const [hours, mins] = newBlock.startTime.split(':').map(Number);
    const startMinutes = hours * 60 + mins;
    const endMinutes = startMinutes + minutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    setNewBlock(prev => ({
      ...prev,
      endTime: `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Time Blocks Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Block Time</Label>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Block off times for meetings, appointments, or focus time
        </p>

        {/* Existing Time Blocks */}
        {context.hardCommitments.length > 0 && (
          <div className="space-y-2">
            {context.hardCommitments.map(commitment => (
              <div
                key={commitment.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{commitment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(commitment.startTime)} – {formatTime(commitment.endTime)}
                    </p>
                  </div>
                </div>
                {!commitment.isImported && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemoveTimeBlock(commitment.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Time Block Form */}
        {showTimeBlockForm ? (
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-4">
            <Input
              placeholder="Event title (e.g., Doctor appointment)"
              value={newBlock.title}
              onChange={(e) => setNewBlock(prev => ({ ...prev, title: e.target.value }))}
              className="bg-background"
            />
            
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="time"
                  value={newBlock.startTime}
                  onChange={(e) => setNewBlock(prev => ({ ...prev, startTime: e.target.value }))}
                  className="bg-background"
                />
              </div>
              <span className="text-muted-foreground mt-5">–</span>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="time"
                  value={newBlock.endTime}
                  onChange={(e) => setNewBlock(prev => ({ ...prev, endTime: e.target.value }))}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Quick Duration Buttons */}
            <div className="flex gap-2">
              {quickDurations.map(({ label, minutes }) => (
                <Button
                  key={minutes}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setQuickDuration(minutes)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowTimeBlockForm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAddTimeBlock}
                disabled={!newBlock.title}
              >
                Add Block
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setShowTimeBlockForm(true)}
          >
            <Plus className="h-4 w-4" />
            Add blocked time
          </Button>
        )}
      </div>

      {/* Natural Language Requests */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Special Requests</Label>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>
        
        <Textarea
          placeholder="e.g., Make sure to call mom, need time for the gym, important email to send..."
          value={context.adjustmentRequest || ''}
          onChange={(e) => handleRequestChange(e.target.value)}
          className="min-h-[80px] resize-none"
          maxLength={500}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Tell us anything we should know about your day</span>
          <span>{(context.adjustmentRequest || '').length}/500</span>
        </div>
      </div>

      {/* Continue Button */}
      <div className="pt-4">
        <Button 
          onClick={onNext} 
          className="w-full gap-2"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Sparkles className="h-4 w-4 animate-pulse" />
              Generating your plan...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate My Plan
            </>
          )}
        </Button>
        
        {context.hardCommitments.length === 0 && !context.adjustmentRequest && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            You can skip this step if you don't have any constraints
          </p>
        )}
      </div>
    </div>
  );
}
