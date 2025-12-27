import { useState } from 'react';
import { 
  Inbox, 
  Trash2, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  Clock,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useTaskInbox, InboxItem } from '../hooks/useTaskInbox';
import { parseNaturalLanguage, ParsedTask } from '../hooks/useNaturalLanguageParser';
import { formatDistanceToNow } from 'date-fns';

interface InboxDrawerProps {
  onProcessItem: (item: InboxItem, parsed: ParsedTask) => void;
}

export function InboxDrawer({ onProcessItem }: InboxDrawerProps) {
  const { 
    inboxItems, 
    inboxCount, 
    hasInboxItems, 
    isLoading,
    deleteFromInbox,
    markProcessed 
  } = useTaskInbox();
  const [open, setOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleProcess = (item: InboxItem) => {
    setProcessingId(item.id);
    const parsed = parseNaturalLanguage(item.raw_text);
    onProcessItem(item, parsed);
    markProcessed({ inboxId: item.id });
    setProcessingId(null);
  };

  const handleDelete = (id: string) => {
    deleteFromInbox(id);
  };

  const getSourceIcon = (source: InboxItem['source']) => {
    switch (source) {
      case 'voice':
        return '🎤';
      case 'share':
        return '📤';
      case 'widget':
        return '📱';
      default:
        return '✏️';
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative"
          aria-label={`Inbox (${inboxCount} items)`}
        >
          <Inbox className="h-4 w-4" />
          {hasInboxItems && (
            <Badge 
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-primary"
            >
              {inboxCount > 9 ? '9+' : inboxCount}
            </Badge>
          )}
        </Button>
      </DrawerTrigger>
      
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Quick Capture Inbox
            {hasInboxItems && (
              <Badge variant="secondary">{inboxCount} items</Badge>
            )}
          </DrawerTitle>
          <DrawerDescription>
            Process your captured thoughts into quests
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !hasInboxItems ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Inbox Zero!</h3>
              <p className="text-muted-foreground text-sm">
                All your captured items have been processed
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {inboxItems.map((item) => {
                const parsed = parseNaturalLanguage(item.raw_text);
                const isProcessing = processingId === item.id;
                
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group p-3 rounded-lg border bg-card transition-all",
                      "hover:border-primary/50 hover:shadow-sm",
                      isProcessing && "opacity-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg" title={item.source}>
                        {getSourceIcon(item.source)}
                      </span>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium break-words">
                          {item.raw_text}
                        </p>
                        
                        {/* Parsed preview */}
                        {(parsed.scheduledTime || parsed.scheduledDate || parsed.context) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {parsed.scheduledDate && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                📅 {parsed.scheduledDate}
                              </Badge>
                            )}
                            {parsed.scheduledTime && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                ⏰ {parsed.scheduledTime}
                              </Badge>
                            )}
                            {parsed.context && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                📍 @{parsed.context}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleProcess(item)}
                          className="h-8 gap-1"
                          disabled={isProcessing}
                        >
                          <Sparkles className="h-3 w-3" />
                          Process
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
