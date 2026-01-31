import React, { useState } from 'react';
import { Timer, BarChart3, Target } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SmartTaskInput } from './SmartTaskInput';
import { TopThreeTasks } from './TopThreeTasks';
import { FocusTimer } from './FocusTimer';
import { FocusStats } from './FocusStats';
import { ProductivityDashboard } from './ProductivityDashboard';
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
      contactId: parsed.contactId,
      autoLogInteraction: parsed.autoLogInteraction ?? true,
    });
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

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="focus" className="gap-2">
            <Timer className="w-4 h-4" />
            <span className="hidden sm:inline">Focus</span>
          </TabsTrigger>
          <TabsTrigger value="top3" className="gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Top 3</span>
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

          <TabsContent value="stats" className="mt-0">
            <ProductivityDashboard />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
