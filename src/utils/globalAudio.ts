import { safeLocalStorage } from './storage';
import { iosAudioManager, isIOS, resumeAudioContext, setupIOSAudioInteraction } from './iosAudio';

/**
 * Global Audio Manager
 * Controls global mute state for ALL audio in the app:
 * - Ambient background music
 * - Sound effects
 * - Pep talk audio
 * - Evolution voices
 * - Any other audio playback
 * 
 * On iOS, coordinates with iosAudioManager for proper audio session handling
 */
class GlobalAudioManager {
  private isMuted = false;
  private listeners: Set<(muted: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadPreferences();
      
      // Setup iOS audio interaction handling
      setupIOSAudioInteraction();
      
      // Sync with iOS audio manager
      if (isIOS) {
        iosAudioManager.subscribe((muted) => {
          if (this.isMuted !== muted) {
            this.isMuted = muted;
            this.notifyListeners();
          }
        });
      }
    }
  }

  private loadPreferences() {
    try {
      const savedMuted = safeLocalStorage.getItem('global_audio_muted');
      if (savedMuted) {
        this.isMuted = savedMuted === 'true';
        // Sync iOS manager on load
        if (isIOS) {
          iosAudioManager.setMuted(this.isMuted);
        }
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
    
    // Sync with iOS audio manager
    if (isIOS) {
      iosAudioManager.setMuted(this.isMuted);
    }
    
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
      
      // Sync with iOS audio manager
      if (isIOS) {
        iosAudioManager.setMuted(muted);
      }
      
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
   * On iOS, also checks if user interaction has occurred
   */
  canPlayAudio(): boolean {
    if (isIOS) {
      return !this.isMuted && iosAudioManager.canPlay();
    }
    return !this.isMuted;
  }
  
  /**
   * Ensure audio is ready to play (especially on iOS)
   * Call this before playing important audio
   */
  async ensureReady(): Promise<void> {
    if (isIOS) {
      await resumeAudioContext();
    }
  }
}

export const globalAudio = new GlobalAudioManager();

// Convenience exports
export const isGloballyMuted = () => globalAudio.getMuted();
export const toggleGlobalMute = () => globalAudio.toggleMute();
export const setGlobalMute = (muted: boolean) => globalAudio.setMuted(muted);
export const canPlayAudio = () => globalAudio.canPlayAudio();
export const subscribeToGlobalMute = (listener: (muted: boolean) => void) => globalAudio.subscribe(listener);
