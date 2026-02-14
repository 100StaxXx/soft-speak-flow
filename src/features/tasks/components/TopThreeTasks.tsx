import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Target, Star, Check, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  task_text: string;
  completed: boolean;
  priority?: string | null;
  is_top_three?: boolean | null;
}

interface TopThreeTasksProps {
  tasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onReorder?: (taskIds: string[]) => void;
  className?: string;
}

export function TopThreeTasks({ 
  tasks, 
  onToggleComplete, 
  onReorder,
  className 
}: TopThreeTasksProps) {
  const topThreeTasks = tasks.filter(t => t.is_top_three).slice(0, 3);
  const completedCount = topThreeTasks.filter(t => t.completed).length;
  const progress = topThreeTasks.length > 0 ? (completedCount / topThreeTasks.length) * 100 : 0;

  const handleReorder = (newOrder: Task[]) => {
    if (onReorder) {
      onReorder(newOrder.map(t => t.id));
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Today's Top 3
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {completedCount}/{topThreeTasks.length}
            </span>
            {completedCount === 3 && topThreeTasks.length === 3 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-yellow-500"
              >
                <Star className="w-5 h-5 fill-current" />
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {topThreeTasks.length === 0 ? (
          <div className="text-center py-6">
            <Target className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No top priorities set for today
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Mark up to 3 tasks as your top priorities
            </p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={topThreeTasks}
            onReorder={handleReorder}
            className="space-y-2"
          >
            <AnimatePresence mode="popLayout">
              {topThreeTasks.map((task, index) => (
                <Reorder.Item
                  key={task.id}
                  value={task}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-all",
                      "bg-muted/30 hover:bg-muted/50",
                      task.completed && "opacity-60"
                    )}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
                    
                    <div className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                      index === 0 && "bg-yellow-500/20 text-yellow-500",
                      index === 1 && "bg-slate-400/20 text-slate-400",
                      index === 2 && "bg-amber-600/20 text-amber-600"
                    )}>
                      {index + 1}
                    </div>

                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={(checked) => 
                        onToggleComplete(task.id, checked as boolean)
                      }
                      className="data-[state=checked]:bg-primary"
                    />

                    <span className={cn(
                      "flex-1 text-sm",
                      task.completed && "line-through text-muted-foreground"
                    )}>
                      {task.task_text}
                    </span>

                    {task.completed && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-green-500"
                      >
                        <Check className="w-4 h-4" />
                      </motion.div>
                    )}
                  </div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}

        {/* Completion celebration */}
        {completedCount === 3 && topThreeTasks.length === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-lg bg-gradient-to-r from-primary/20 to-yellow-500/20 border border-primary/20 text-center"
          >
            <span className="text-sm font-medium">
              🎉 All top priorities complete! Amazing focus today!
            </span>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
