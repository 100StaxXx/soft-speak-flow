import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Mail, Calendar, MessageSquare, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InteractionLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactAvatarUrl?: string | null;
  taskTitle: string;
  onLog: (type: string, summary: string) => Promise<void>;
  onSkip: () => void;
}

const INTERACTION_TYPES = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'message', label: 'Message', icon: MessageSquare },
  { value: 'note', label: 'Note', icon: FileText },
];

export function InteractionLogModal({
  open,
  onOpenChange,
  contactName,
  contactAvatarUrl,
  taskTitle,
  onLog,
  onSkip,
}: InteractionLogModalProps) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [summary, setSummary] = useState(taskTitle);
  const [isLogging, setIsLogging] = useState(false);

  // Auto-detect interaction type from task title
  const suggestedType = useMemo(() => {
    const lower = taskTitle.toLowerCase();
    if (lower.includes('call') || lower.includes('phone')) return 'call';
    if (lower.includes('email') || lower.includes('send') || lower.includes('write')) return 'email';
    if (lower.includes('meet') || lower.includes('lunch') || lower.includes('coffee')) return 'meeting';
    if (lower.includes('text') || lower.includes('message')) return 'message';
    return 'note';
  }, [taskTitle]);

  // Set suggested type on mount
  React.useEffect(() => {
    if (!selectedType) {
      setSelectedType(suggestedType);
    }
  }, [suggestedType, selectedType]);

  const handleLog = async () => {
    if (!selectedType || !summary.trim()) return;
    
    setIsLogging(true);
    try {
      await onLog(selectedType, summary.trim());
      onOpenChange(false);
    } finally {
      setIsLogging(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const initials = contactName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
          <DialogDescription>
            Record this as an interaction with {contactName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Contact info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-10 w-10">
              <AvatarImage src={contactAvatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{contactName}</p>
              <p className="text-xs text-muted-foreground">{taskTitle}</p>
            </div>
          </div>

          {/* Interaction type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <div className="flex flex-wrap gap-2">
              {INTERACTION_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = selectedType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSelectedType(type.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Summary</label>
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="What happened?"
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="flex-1"
            disabled={isLogging}
          >
            Just Complete
          </Button>
          <Button
            onClick={handleLog}
            className="flex-1"
            disabled={!selectedType || !summary.trim() || isLogging}
          >
            {isLogging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging...
              </>
            ) : (
              'Log & Complete'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
