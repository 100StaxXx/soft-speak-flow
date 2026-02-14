import { useRef, useCallback, useState } from 'react';

interface UseEphemeralReorderOptions<T> {
  items: T[];
  onCommitOrder: (items: T[]) => void;
  getKey: (item: T) => string;
  swapThreshold?: number; // 0.6 = 60% hysteresis
}

interface EphemeralReorderState {
  isDragging: boolean;
  draggedIndex: number | null;
  overIndex: number | null;
}

export function useEphemeralReorder<T>({
  items,
  onCommitOrder,
  getKey: _getKey,
  swapThreshold = 0.6,
}: UseEphemeralReorderOptions<T>) {
  // Visual order stored in ref (no re-renders during drag)
  const visualOrderRef = useRef<T[]>(items);
  const itemRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const dragStartYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const rowHeightRef = useRef<number>(56); // Default row height
  
  // Minimal state for UI feedback
  const [state, setState] = useState<EphemeralReorderState>({
    isDragging: false,
    draggedIndex: null,
    overIndex: null,
  });

  // Sync visual order with items when not dragging
  if (!state.isDragging && visualOrderRef.current !== items) {
    visualOrderRef.current = items;
  }

  // Calculate which index the dragged item is over based on Y position
  const calculateOverIndex = useCallback((dragY: number, draggedIndex: number): number => {
    const deltaY = dragY - dragStartYRef.current;
    const rowHeight = rowHeightRef.current;
    
    // Calculate how many rows we've moved
    const rowsMoved = Math.round(deltaY / rowHeight);
    let newIndex = draggedIndex + rowsMoved;
    
    // Clamp to valid range
    newIndex = Math.max(0, Math.min(newIndex, visualOrderRef.current.length - 1));
    
    // Apply hysteresis - only swap if we've crossed the threshold
    const partialMove = Math.abs(deltaY) % rowHeight;
    const thresholdPx = rowHeight * swapThreshold;
    
    if (partialMove < thresholdPx && newIndex !== draggedIndex) {
      // Haven't crossed threshold yet, stay at previous position
      const direction = deltaY > 0 ? -1 : 1;
      newIndex = Math.max(0, Math.min(newIndex + direction, visualOrderRef.current.length - 1));
    }
    
    return newIndex;
  }, [swapThreshold]);

  // Start dragging
  const startDrag = useCallback((index: number, startY: number, rowHeight?: number) => {
    dragStartYRef.current = startY;
    currentYRef.current = startY;
    if (rowHeight) rowHeightRef.current = rowHeight;
    
    setState({
      isDragging: true,
      draggedIndex: index,
      overIndex: index,
    });
  }, []);

  // Update drag position (called frequently, but only updates refs + minimal state)
  const updateDrag = useCallback((currentY: number) => {
    if (state.draggedIndex === null) return;
    
    currentYRef.current = currentY;
    const newOverIndex = calculateOverIndex(currentY, state.draggedIndex);
    
    // Only update state if over index changed (throttled re-renders)
    if (newOverIndex !== state.overIndex) {
      // Reorder visual array
      const newOrder = [...visualOrderRef.current];
      const [removed] = newOrder.splice(state.draggedIndex, 1);
      newOrder.splice(newOverIndex, 0, removed);
      visualOrderRef.current = newOrder;
      
      setState(prev => ({
        ...prev,
        overIndex: newOverIndex,
        draggedIndex: newOverIndex, // Update dragged index to new position
      }));
    }
  }, [state.draggedIndex, state.overIndex, calculateOverIndex]);

  // End drag and commit order
  const endDrag = useCallback(() => {
    if (state.isDragging) {
      // Commit the final order
      onCommitOrder(visualOrderRef.current);
    }
    
    setState({
      isDragging: false,
      draggedIndex: null,
      overIndex: null,
    });
  }, [state.isDragging, onCommitOrder]);

  // Cancel drag without committing
  const cancelDrag = useCallback(() => {
    visualOrderRef.current = items; // Reset to original
    setState({
      isDragging: false,
      draggedIndex: null,
      overIndex: null,
    });
  }, [items]);

  // Get the current visual order (for rendering)
  const getVisualOrder = useCallback(() => {
    return state.isDragging ? visualOrderRef.current : items;
  }, [state.isDragging, items]);

  // Store item rect for calculations
  const registerItemRect = useCallback((key: string, rect: DOMRect) => {
    itemRectsRef.current.set(key, rect);
  }, []);

  return {
    // State
    isDragging: state.isDragging,
    draggedIndex: state.draggedIndex,
    overIndex: state.overIndex,
    
    // Actions
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    
    // Helpers
    getVisualOrder,
    registerItemRect,
    
    // Refs for direct access
    visualOrderRef,
    rowHeightRef,
  };
}
