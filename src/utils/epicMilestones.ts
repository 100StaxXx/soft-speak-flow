// Epic Milestone Calculations for Narrative System

import { NarrativeCheckpoint, StorySeed } from '@/types/narrativeTypes';

/**
 * Calculate total chapters based on duration and story type
 * Base chapters from story type + bonus for longer epics
 */
export const calculateTotalChapters = (
  targetDays: number,
  baseChapters: number
): number => {
  // Bonus chapter for epics over 30 days
  const durationBonus = targetDays >= 30 ? 1 : 0;
  return baseChapters + durationBonus;
};

/**
 * Calculate chapter milestones as percentages
 * Returns array of progress percentages for each chapter
 */
export const calculateChapterMilestones = (totalChapters: number): number[] => {
  const milestones: number[] = [];
  for (let i = 1; i <= totalChapters; i++) {
    // Distribute chapters evenly, with finale at 100%
    const percentage = Math.round((i / totalChapters) * 100);
    milestones.push(percentage);
  }
  return milestones;
};

/**
 * Get current chapter based on progress
 */
export const getCurrentChapter = (
  progress: number,
  totalChapters: number
): number => {
  const milestones = calculateChapterMilestones(totalChapters);
  
  // Find which chapter we're on or past
  for (let i = 0; i < milestones.length; i++) {
    if (progress < milestones[i]) {
      return i; // Return the chapter we're working towards (0-indexed)
    }
  }
  return totalChapters; // All chapters complete
};

/**
 * Get next chapter milestone percentage
 */
export const getNextMilestone = (
  progress: number,
  totalChapters: number
): number | null => {
  const milestones = calculateChapterMilestones(totalChapters);
  
  for (const milestone of milestones) {
    if (progress < milestone) {
      return milestone;
    }
  }
  return null; // All milestones reached
};

/**
 * Check if a chapter has been reached
 */
export const isChapterReached = (
  chapterNumber: number,
  progress: number,
  totalChapters: number
): boolean => {
  const milestones = calculateChapterMilestones(totalChapters);
  const chapterMilestone = milestones[chapterNumber - 1];
  return progress >= chapterMilestone;
};

/**
 * Generate narrative checkpoints for ConstellationTrail
 */
export const generateNarrativeCheckpoints = (
  progress: number,
  totalChapters: number,
  storySeed: StorySeed | null,
  revealedChapters: Map<number, { locationName: string; clueText: string | null }>
): NarrativeCheckpoint[] => {
  const milestones = calculateChapterMilestones(totalChapters);
  const checkpoints: NarrativeCheckpoint[] = [];
  
  for (let i = 0; i < totalChapters; i++) {
    const chapterNumber = i + 1;
    const chapterMilestone = milestones[i];
    const isReached = progress >= chapterMilestone;
    const isCurrent = progress < chapterMilestone && (i === 0 || progress >= milestones[i - 1]);
    const isFinale = chapterNumber === totalChapters;
    
    // Get revealed info if available
    const revealed = revealedChapters.get(chapterNumber);
    
    // Get location from story seed blueprints if not yet revealed
    let locationName: string | null = null;
    let clueText: string | null = null;
    
    if (revealed) {
      locationName = revealed.locationName;
      clueText = revealed.clueText;
    } else if (storySeed?.chapter_blueprints?.[i]) {
      // Show mystery placeholder until reached
      locationName = isReached ? storySeed.chapter_blueprints[i].title : null;
    }
    
    checkpoints.push({
      chapter: chapterNumber,
      progressPercent: chapterMilestone,
      locationName: isReached ? locationName : null,
      locationRevealed: isReached,
      isReached,
      isCurrent,
      isFinale,
      clueText: isReached ? clueText : null,
    });
  }
  
  return checkpoints;
};

/**
 * Get boss battle trigger info
 * Returns boss context if progress is at 100% and finale not yet completed
 */
export const shouldTriggerBossBattle = (
  progress: number,
  finaleCompleted: boolean
): boolean => {
  return progress >= 100 && !finaleCompleted;
};

/**
 * Calculate chapter progress within current chapter
 * Returns 0-100 representing progress toward next chapter
 */
export const getChapterProgress = (
  overallProgress: number,
  totalChapters: number
): { currentChapter: number; progressInChapter: number } => {
  const milestones = calculateChapterMilestones(totalChapters);
  
  for (let i = 0; i < milestones.length; i++) {
    const chapterStart = i === 0 ? 0 : milestones[i - 1];
    const chapterEnd = milestones[i];
    
    if (overallProgress < chapterEnd) {
      const chapterRange = chapterEnd - chapterStart;
      const progressInRange = overallProgress - chapterStart;
      const progressInChapter = Math.round((progressInRange / chapterRange) * 100);
      
      return {
        currentChapter: i + 1,
        progressInChapter: Math.min(100, Math.max(0, progressInChapter)),
      };
    }
  }
  
  return {
    currentChapter: totalChapters,
    progressInChapter: 100,
  };
};

/**
 * Format chapter title with mystery styling
 */
export const formatChapterTitle = (
  chapterNumber: number,
  totalChapters: number,
  title: string | null,
  isRevealed: boolean
): string => {
  if (chapterNumber === totalChapters) {
    return isRevealed ? `Finale: ${title || 'The Final Confrontation'}` : '??? The Final Confrontation ???';
  }
  
  if (!isRevealed) {
    return `Chapter ${chapterNumber}: ???`;
  }
  
  return `Chapter ${chapterNumber}: ${title || 'Unknown Location'}`;
};

/**
 * Get prophecy line for chapter
 */
export const getProphecyLineForChapter = (
  chapterNumber: number,
  storySeed: StorySeed | null
): string | null => {
  if (!storySeed?.the_prophecy) return null;
  
  const revealIndex = storySeed.the_prophecy.when_revealed.indexOf(chapterNumber);
  if (revealIndex === -1) return null;
  
  // Split prophecy text into lines
  const lines = storySeed.the_prophecy.full_text.split('\n').filter(l => l.trim());
  return lines[revealIndex] || null;
};
