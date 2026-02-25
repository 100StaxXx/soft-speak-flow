/**
 * Safe clipboard utilities with fallbacks for insecure contexts
 * Handles HTTP, older browsers, and permission issues
 */
import { Capacitor } from "@capacitor/core";

const isNativeIOS = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/**
 * Safely writes text to clipboard with fallbacks
 * @param text - Text to copy to clipboard
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const safeClipboardWrite = async (text: string): Promise<boolean> => {
  try {
    // Modern Clipboard API (requires HTTPS or localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // On native iOS, avoid textarea/select fallback that can trigger edit callouts.
    if (isNativeIOS()) {
      return false;
    }

    // Fallback for insecure contexts (HTTP) or older browsers
    return fallbackCopyToClipboard(text);
  } catch (error) {
    console.error('Clipboard API failed:', error);

    // On native iOS, avoid textarea/select fallback that can trigger edit callouts.
    if (isNativeIOS()) {
      return false;
    }
    
    // If clipboard API failed (e.g., permissions denied), try fallback
    return fallbackCopyToClipboard(text);
  }
};

/**
 * Fallback clipboard copy using textarea and execCommand
 * Works in insecure contexts where Clipboard API is unavailable
 * @param text - Text to copy
 * @returns boolean - true if successful
 */
const fallbackCopyToClipboard = (text: string): boolean => {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    
    // Make textarea invisible but ensure it can be selected
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    // Try to copy using deprecated but widely supported execCommand
    const success = document.execCommand('copy');
    
    // Clean up
    document.body.removeChild(textarea);
    
    return success;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  }
};

/**
 * Checks if clipboard functionality is available
 * Checks both modern API and fallback method
 * @returns boolean - true if any clipboard method is available
 */
export const isClipboardAvailable = (): boolean => {
  // Check modern Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return true;
  }

  // On native iOS we intentionally disable legacy textarea/select fallback.
  if (isNativeIOS()) {
    return false;
  }
  
  // Check if execCommand fallback is available
  if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
    return true;
  }
  
  // Last resort: assume execCommand works (it usually does even without queryCommandSupported)
  return typeof document.execCommand === 'function';
};

/**
 * Gets user-friendly error message based on error type
 * @param error - The error that occurred
 * @returns string - User-friendly error message
 */
export const getClipboardErrorMessage = (error: unknown): string => {
  const err = error as Error | null;
  const errorName = err?.name || '';
  const errorMessage = err?.message?.toLowerCase() || '';
  
  // User denied clipboard permissions
  if (errorName === 'NotAllowedError' || errorMessage.includes('permission')) {
    return 'Clipboard access denied. Please check your browser settings.';
  }
  
  // Insecure context (HTTP instead of HTTPS)
  if (errorMessage.includes('secure') || errorMessage.includes('https')) {
    return 'Clipboard requires a secure connection (HTTPS).';
  }
  
  // Generic error
  return 'Failed to copy to clipboard. Please try again.';
};

/**
 * Safely reads from clipboard (less commonly needed)
 * @returns Promise<string | null> - Clipboard text or null if failed
 */
export const safeClipboardRead = async (): Promise<string | null> => {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    }
    return null;
  } catch (error) {
    console.error('Clipboard read failed:', error);
    return null;
  }
};
