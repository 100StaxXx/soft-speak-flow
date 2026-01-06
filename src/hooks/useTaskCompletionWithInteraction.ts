import { useState, useCallback } from 'react';
import { useContactInteractions, type InteractionType } from './useContactInteractions';

interface ContactInfo {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface CompletedTaskWithContact {
  taskId: string;
  taskText: string;
  contact: ContactInfo;
  autoLogInteraction: boolean;
}

/**
 * Hook to manage task completion with optional interaction logging
 * Shows a modal to log the interaction when completing a contact-linked task
 */
export function useTaskCompletionWithInteraction() {
  const [pendingInteraction, setPendingInteraction] = useState<CompletedTaskWithContact | null>(null);
  const { createInteraction } = useContactInteractions(pendingInteraction?.contact?.id);

  /**
   * Called after a task with contact_id is completed
   * Sets up the pending interaction for the modal
   */
  const handleTaskCompleted = useCallback((
    taskId: string,
    taskText: string,
    contact: ContactInfo | null,
    autoLogInteraction: boolean
  ) => {
    // Only show modal if task has a contact and auto-log is enabled
    if (contact && autoLogInteraction) {
      setPendingInteraction({
        taskId,
        taskText,
        contact,
        autoLogInteraction,
      });
    }
  }, []);

  /**
   * Log the interaction and close the modal
   */
  const logInteraction = useCallback(async (
    type: InteractionType,
    summary: string
  ) => {
    if (!pendingInteraction) return;

    await createInteraction.mutateAsync({
      contact_id: pendingInteraction.contact.id,
      interaction_type: type,
      summary,
    });

    setPendingInteraction(null);
  }, [pendingInteraction, createInteraction]);

  /**
   * Skip logging and close the modal
   */
  const skipInteraction = useCallback(() => {
    setPendingInteraction(null);
  }, []);

  /**
   * Close the modal without logging
   */
  const closeModal = useCallback(() => {
    setPendingInteraction(null);
  }, []);

  return {
    pendingInteraction,
    isModalOpen: !!pendingInteraction,
    handleTaskCompleted,
    logInteraction,
    skipInteraction,
    closeModal,
    isLogging: createInteraction.isPending,
  };
}

// Re-export the InteractionType for convenience
export type { InteractionType };
