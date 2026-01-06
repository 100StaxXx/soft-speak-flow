import { format, formatDistanceToNow } from 'date-fns';
import { Phone, Mail, Users, MessageSquare, StickyNote, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { ContactInteraction, InteractionType } from '@/hooks/useContactInteractions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InteractionsListProps {
  interactions: ContactInteraction[];
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

const typeConfig: Record<InteractionType, { icon: typeof Phone; label: string; color: string }> = {
  call: { icon: Phone, label: 'Call', color: 'text-green-500' },
  email: { icon: Mail, label: 'Email', color: 'text-blue-500' },
  meeting: { icon: Users, label: 'Meeting', color: 'text-purple-500' },
  message: { icon: MessageSquare, label: 'Message', color: 'text-orange-500' },
  note: { icon: StickyNote, label: 'Note', color: 'text-yellow-500' },
};

export function InteractionsList({ interactions, onDelete, isLoading }: InteractionsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading interactions...
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <StickyNote className="h-8 w-8 mb-2 opacity-50" />
        <p>No interactions yet</p>
        <p className="text-sm">Log your first interaction above</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {interactions.map((interaction) => {
        const config = typeConfig[interaction.interaction_type];
        const Icon = config.icon;
        const isExpanded = expandedId === interaction.id;
        const hasNotes = interaction.notes && interaction.notes.trim().length > 0;

        return (
          <div
            key={interaction.id}
            className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={cn('p-2 rounded-full bg-muted', config.color)}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(interaction.occurred_at), { addSuffix: true })}
                  </span>
                </div>

                <p className="text-sm font-medium text-foreground">{interaction.summary}</p>

                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(interaction.occurred_at), 'MMM d, yyyy · h:mm a')}
                </p>

                {hasNotes && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-0 text-xs text-muted-foreground hover:text-foreground mt-1"
                      onClick={() => setExpandedId(isExpanded ? null : interaction.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Hide notes
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Show notes
                        </>
                      )}
                    </Button>

                    {isExpanded && (
                      <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                        {interaction.notes}
                      </p>
                    )}
                  </>
                )}
              </div>

              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => onDelete(interaction.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
