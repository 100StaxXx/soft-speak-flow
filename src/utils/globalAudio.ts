import { safeLocalStorage } from './storage';

/**
 * Global Audio Manager
 * Controls global mute state for ALL audio in the app:
 * - Ambient background music
 * - Sound effects
 * - Pep talk audio
 * - Evolution voices
 * - Any other audio playback
 */
class GlobalAudioManager {
  private isMuted = false;
  private listeners: Set<(muted: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadPreferences();
    }
  }

  private loadPreferences() {
    try {
      const savedMuted = safeLocalStorage.getItem('global_audio_muted');
      if (savedMuted) {
        this.isMuted = savedMuted === 'true';
      }
    } catch (e) {
      console.warn('Failed to load global audio preferences:', e);
    }
  }

  private savePreferences() {
    try {
      safeLocalStorage.setItem('global_audio_muted', this.isMuted.toString());
    } catch (e) {
      console.warn('Failed to save global audio preferences:', e);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.isMuted);
      } catch (e) {
        console.error('Error in global audio listener:', e);
      }
    });

    // Also dispatch a window event for components that prefer event-based updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('global-audio-mute-change', { detail: this.isMuted }));
    }
  }

  /**
   * Toggle global mute state
   * @returns The new muted state
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.savePreferences();
    this.notifyListeners();
    return this.isMuted;
  }

  /**
   * Set mute state directly
   */
  setMuted(muted: boolean) {
    if (this.isMuted !== muted) {
      this.isMuted = muted;
      this.savePreferences();
      this.notifyListeners();
    }
  }

  /**
   * Get current mute state
   */
  getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Subscribe to mute state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Check if audio can play (not globally muted)
   */
  canPlayAudio(): boolean {
    return !this.isMuted;
  }
}

export const globalAudio = new GlobalAudioManager();

// Convenience exports
export const isGloballyMuted = () => globalAudio.getMuted();
export const toggleGlobalMute = () => globalAudio.toggleMute();
export const setGlobalMute = (muted: boolean) => globalAudio.setMuted(muted);
export const canPlayAudio = () => globalAudio.canPlayAudio();
export const subscribeToGlobalMute = (listener: (muted: boolean) => void) => globalAudio.subscribe(listener);
