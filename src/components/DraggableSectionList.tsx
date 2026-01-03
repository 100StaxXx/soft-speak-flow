import { useState, useCallback, useMemo } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { DroppableSection, TimeSection, sectionConfig } from "./DroppableSection";
import { DraggableTaskList, type DragHandleProps } from "./DraggableTaskList";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface Task {
  id: string;
  task_text: string;
  completed: boolean | null;
  xp_reward: number;
  scheduled_time?: string | null;
  is_main_quest?: boolean | null;
  difficulty?: string | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
  sort_order?: number | null;
}

interface DraggableSectionListProps {
  tasks: Task[];
  onMoveTask: (taskId: string, targetSection: TimeSection) => void;
  onReorderWithinSection: (tasks: Task[]) => void;
  renderItem: (task: Task, dragProps?: DragHandleProps) => React.ReactNode;
  disableDrag?: boolean;
}

// Helper to determine section from scheduled_time
function getTaskSection(scheduledTime: string | null | undefined): TimeSection {
  if (!scheduledTime) return 'unscheduled';
  
  const hour = parseInt(scheduledTime.split(':')[0], 10);
  
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// Group tasks by time section
function groupTasksBySection(tasks: Task[]): Record<TimeSection, Task[]> {
  const groups: Record<TimeSection, Task[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    unscheduled: [],
  };

  tasks.forEach(task => {
    const section = getTaskSection(task.scheduled_time);
    groups[section].push(task);
  });

  // Sort each group by sort_order, then by scheduled_time
  const sortTasks = (a: Task, b: Task) => {
    // First by sort_order
    const aOrder = a.sort_order ?? 999;
    const bOrder = b.sort_order ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    // Then by scheduled_time
    if (a.scheduled_time && b.scheduled_time) {
      return a.scheduled_time.localeCompare(b.scheduled_time);
    }
    if (a.scheduled_time) return -1;
    if (b.scheduled_time) return 1;
    return 0;
  };

  Object.keys(groups).forEach(key => {
    groups[key as TimeSection].sort(sortTasks);
  });

  return groups;
}

export function DraggableSectionList({
  tasks,
  onMoveTask,
  onReorderWithinSection,
  renderItem,
  disableDrag = false,
}: DraggableSectionListProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [hoveredSection, setHoveredSection] = useState<TimeSection | null>(null);

  // Group tasks by section
  const groupedTasks = useMemo(() => groupTasksBySection(tasks), [tasks]);

  // Track the section of the currently dragged task
  const draggingTaskSection = useMemo(() => {
    if (!draggingTaskId) return null;
    const task = tasks.find(t => t.id === draggingTaskId);
    return task ? getTaskSection(task.scheduled_time) : null;
  }, [draggingTaskId, tasks]);

  const triggerHaptic = async (style: ImpactStyle) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch (e) {
        // Haptics not available
      }
    }
  };

  const handleDragStart = useCallback((taskId: string) => {
    setDraggingTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    // If we were hovering over a different section, move the task there
    if (draggingTaskId && hoveredSection && draggingTaskSection !== hoveredSection) {
      triggerHaptic(ImpactStyle.Medium);
      onMoveTask(draggingTaskId, hoveredSection);
    }
    
    setDraggingTaskId(null);
    setHoveredSection(null);
  }, [draggingTaskId, hoveredSection, draggingTaskSection, onMoveTask]);

  const handleSectionDrop = useCallback((section: TimeSection) => {
    if (draggingTaskId && draggingTaskSection !== section) {
      triggerHaptic(ImpactStyle.Medium);
      onMoveTask(draggingTaskId, section);
    }
    setDraggingTaskId(null);
    setHoveredSection(null);
  }, [draggingTaskId, draggingTaskSection, onMoveTask]);

  const handleReorder = useCallback((sectionId: TimeSection, reorderedTasks: Task[]) => {
    // Combine the reordered section with other sections' tasks
    const allTasks: Task[] = [];
    
    (['unscheduled', 'morning', 'afternoon', 'evening'] as TimeSection[]).forEach(section => {
      if (section === sectionId) {
        allTasks.push(...reorderedTasks);
      } else {
        allTasks.push(...groupedTasks[section]);
      }
    });
    
    onReorderWithinSection(allTasks);
  }, [groupedTasks, onReorderWithinSection]);

  const sections: TimeSection[] = ['unscheduled', 'morning', 'afternoon', 'evening'];
  const isAnyDragging = draggingTaskId !== null;

  return (
    <LayoutGroup>
      <div className="space-y-3">
        {sections.map(sectionId => {
          const sectionTasks = groupedTasks[sectionId];
          // Only show sections with tasks, OR all sections when dragging (to allow cross-section drops)
          const shouldShow = sectionTasks.length > 0 || isAnyDragging;
          
          if (!shouldShow) return null;

          return (
            <DroppableSection
              key={sectionId}
              sectionId={sectionId}
              isActive={isAnyDragging && draggingTaskSection !== sectionId}
              isDraggedOver={hoveredSection === sectionId && draggingTaskSection !== sectionId}
              onDragEnter={() => {
                if (draggingTaskId && draggingTaskSection !== sectionId) {
                  triggerHaptic(ImpactStyle.Light);
                }
                setHoveredSection(sectionId);
              }}
              onDragLeave={() => setHoveredSection(prev => prev === sectionId ? null : prev)}
              onDrop={() => handleSectionDrop(sectionId)}
              isEmpty={sectionTasks.length === 0}
            >
              {sectionTasks.length > 0 ? (
                <DraggableTaskList
                  tasks={sectionTasks}
                  onReorder={(reordered) => handleReorder(sectionId, reordered)}
                  disabled={disableDrag}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  renderItem={renderItem}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  className="text-center py-4 text-xs text-muted-foreground"
                >
                  Drop tasks here
                </motion.div>
              )}
            </DroppableSection>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export { getTaskSection };
export type { TimeSection };
