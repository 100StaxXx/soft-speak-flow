import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Remove markdown formatting from text (asterisks, underscores, etc.)
 * Used as a safety net for AI-generated content that may contain markdown
 */
export function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')       // Remove *italic*
    .replace(/__([^_]+)__/g, '$1')       // Remove __bold__
    .replace(/_([^_]+)_/g, '$1')         // Remove _italic_
    .replace(/~~([^~]+)~~/g, '$1')       // Remove ~~strikethrough~~
    .replace(/`([^`]+)`/g, '$1')         // Remove `code`
    .trim();
}
