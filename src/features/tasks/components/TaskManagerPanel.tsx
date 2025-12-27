import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Inbox, Timer, BarChart3, Target } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SmartTaskInput } from './SmartTaskInput';
import { TopThreeTasks } from './TopThreeTasks';
import { FocusTimer } from './FocusTimer';
import { FocusStats } from './FocusStats';
import { ProductivityDashboard } from './ProductivityDashboard';
import { InboxDrawer } from './InboxDrawer';
import { QuickCaptureButton } from './QuickCaptureButton';
import { useTaskInbox, InboxItem } from '../hooks/useTaskInbox';
import { ParsedTask } from '../hooks/useNaturalLanguageParser';

interface TaskManagerPanelProps {
  tasks: Array<{
    id: string;
    task_text: string;
    completed: boolean;
    priority?: string | null;
    is_top_three?: boolean | null;
  }>;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onAddTask: (taskText: string, metadata?: Record<string, any>) => void;
  className?: string;
}

export function TaskManagerPanel({
  tasks,
  onToggleComplete,
  onAddTask,
  className,
}: TaskManagerPanelProps) {
  const [activeTab, setActiveTab] = useState('focus');
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>();
  const [focusTaskName, setFocusTaskName] = useState<string | undefined>();
  const { inboxCount, hasInboxItems } = useTaskInbox();

  const handleStartFocus = (taskId: string, taskName: string) => {
    setFocusTaskId(taskId);
    setFocusTaskName(taskName);
    setActiveTab('focus');
  };

  const handleTaskAdd = (parsed: ParsedTask) => {
    onAddTask(parsed.text, {
      priority: parsed.priority,
      scheduledDate: parsed.scheduledDate,
      scheduledTime: parsed.scheduledTime,
      context: parsed.context,
      estimatedDuration: parsed.estimatedDuration,
      energyLevel: parsed.energyLevel,
      recurrencePattern: parsed.recurrencePattern,
      isTopThree: parsed.isTopThree,
    });
  };

  const handleProcessInboxItem = (item: InboxItem) => {
    onAddTask(item.raw_text);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Smart Input */}
      <Card>
        <CardContent className="p-4">
          <SmartTaskInput 
            onSubmit={handleTaskAdd}
            placeholder="Add a task... (try 'Call mom tomorrow at 2pm #personal !high')"
          />
        </CardContent>
      </Card>

      {/* Quick Capture FAB */}
      <QuickCaptureButton />

      {/* Inbox Drawer */}
      <InboxDrawer onProcessItem={handleProcessInboxItem} />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="focus" className="gap-2">
            <Timer className="w-4 h-4" />
            <span className="hidden sm:inline">Focus</span>
          </TabsTrigger>
          <TabsTrigger value="top3" className="gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Top 3</span>
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-2 relative">
            <Inbox className="w-4 h-4" />
            <span className="hidden sm:inline">Inbox</span>
            {hasInboxItems && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                {inboxCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="focus" className="mt-0 space-y-4">
            <FocusTimer taskId={focusTaskId} taskName={focusTaskName} />
            <FocusStats />
          </TabsContent>

          <TabsContent value="top3" className="mt-0">
            <TopThreeTasks
              tasks={tasks}
              onToggleComplete={onToggleComplete}
            />
          </TabsContent>

          <TabsContent value="inbox" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Inbox className="w-5 h-5" />
                  Task Inbox
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasInboxItems ? (
                  <p className="text-sm text-muted-foreground">
                    You have {inboxCount} items waiting to be processed. 
                    Click the inbox button in the header to review them.
                  </p>
                ) : (
                  <div className="text-center py-8">
                    <Inbox className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Your inbox is empty! 📭
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use quick capture to add thoughts on the go
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="mt-0">
            <ProductivityDashboard />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
