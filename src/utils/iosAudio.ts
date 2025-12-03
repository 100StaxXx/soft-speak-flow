/**
 * iOS Audio Coordination Manager
 * Handles iOS-specific audio quirks including:
 * - AudioContext state management (must be resumed after user interaction)
 * - Volume control coordination (iOS hardware controls media volume)
 * - Proper audio session handling
 * - Global mute state synchronization across all audio sources
 */

import { safeLocalStorage } from './storage';
import { Capacitor } from '@capacitor/core';

// Check if running on iOS
export const isIOS = Capacitor.getPlatform() === 'ios' || 
  /iPad|iPhone|iPod/.test(navigator.userAgent);

// Singleton for tracking audio context state
let sharedAudioContext: AudioContext | null = null;
let audioContextResumed = false;
let userInteractionReceived = false;

/**
 * Get or create the shared AudioContext
 * On iOS, AudioContext must be created and resumed after user interaction
 */
export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!sharedAudioContext) {
    try {
      const AudioContextClass = window.AudioContext || 
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioContext = new AudioContextClass();
      }
    } catch (e) {
      console.error('[iOS Audio] Failed to create AudioContext:', e);
    }
  }
  
  return sharedAudioContext;
}

/**
 * Resume AudioContext after user interaction (required on iOS)
 */
export async function resumeAudioContext(): Promise<boolean> {
  const ctx = getSharedAudioContext();
  if (!ctx) return false;
  
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      audioContextResumed = true;
      console.log('[iOS Audio] AudioContext resumed successfully');
      return true;
    } catch (e) {
      console.error('[iOS Audio] Failed to resume AudioContext:', e);
      return false;
    }
  }
  
  audioContextResumed = ctx.state === 'running';
  return audioContextResumed;
}

/**
 * Check if AudioContext is ready to play
 */
export function isAudioContextReady(): boolean {
  const ctx = getSharedAudioContext();
  return ctx?.state === 'running';
}

/**
 * Setup user interaction listener to enable audio on iOS
 * Must be called once on app startup
 */
export function setupIOSAudioInteraction(): void {
  if (typeof document === 'undefined' || userInteractionReceived) return;
  
  const enableAudio = async () => {
    if (userInteractionReceived) return;
    userInteractionReceived = true;
    
    console.log('[iOS Audio] User interaction detected, enabling audio...');
    
    // Resume AudioContext
    await resumeAudioContext();
    
  // Create and immediately play/pause a silent audio element
      // This "unlocks" audio on iOS Safari
      try {
        const silentAudio = new Audio();
        silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        silentAudio.volume = 0.001;
        (silentAudio as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
      
      const playPromise = silentAudio.play();
      if (playPromise) {
        playPromise
          .then(() => {
            silentAudio.pause();
            silentAudio.src = '';
            console.log('[iOS Audio] Audio unlocked via silent play');
          })
          .catch(() => {
            // Expected on some browsers, audio may still work
            console.log('[iOS Audio] Silent play caught (expected on some platforms)');
          });
      }
    } catch (e) {
      // Silent audio unlock failed, but main audio may still work
      console.log('[iOS Audio] Silent unlock failed (non-critical):', e);
    }
    
    // Remove listeners after first successful interaction
    document.removeEventListener('touchstart', enableAudio, true);
    document.removeEventListener('touchend', enableAudio, true);
    document.removeEventListener('click', enableAudio, true);
    document.removeEventListener('keydown', enableAudio, true);
  };
  
  // Use capture phase for earlier detection
  document.addEventListener('touchstart', enableAudio, { capture: true, passive: true });
  document.addEventListener('touchend', enableAudio, { capture: true, passive: true });
  document.addEventListener('click', enableAudio, { capture: true });
  document.addEventListener('keydown', enableAudio, { capture: true });
}

/**
 * Coordinated Audio Element creation with iOS optimizations
 */
export function createIOSOptimizedAudio(src?: string): HTMLAudioElement {
  const audio = new Audio();
  
  // iOS-specific attributes
  (audio as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
  (audio as HTMLAudioElement & { 'webkit-playsinline': boolean })['webkit-playsinline'] = true;
  
  // Preload metadata for faster playback
  audio.preload = 'auto';
  
  if (src) {
    audio.src = src;
  }
  
  return audio;
}

/**
 * Safe play function that handles iOS autoplay restrictions
 */
export async function safePlay(audio: HTMLAudioElement): Promise<boolean> {
  if (!audio) return false;
  
  // Ensure AudioContext is resumed on iOS
  if (isIOS && !isAudioContextReady()) {
    await resumeAudioContext();
  }
  
  try {
    const playPromise = audio.play();
    if (playPromise) {
      await playPromise;
    }
    return true;
  } catch (e) {
    const error = e as Error;
    if (error.name === 'NotAllowedError') {
      console.log('[iOS Audio] Play blocked - waiting for user interaction');
      return false;
    }
    if (error.name === 'AbortError') {
      // Play was interrupted (e.g., by pause call) - not a real error
      return false;
    }
    console.error('[iOS Audio] Play failed:', e);
    return false;
  }
}

/**
 * iOS Audio State Manager
 * Coordinates global mute state with proper iOS handling
 */
class IOSAudioStateManager {
  private isMuted = false;
  private listeners: Set<(muted: boolean) => void> = new Set();
  private audioElements: Set<HTMLAudioElement> = new Set();
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.loadState();
      setupIOSAudioInteraction();
      
      // Listen for visibility changes - iOS can suspend audio when backgrounded
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Listen for app becoming active again (Capacitor)
      // Use resume event which works across platforms
      if (Capacitor.isNativePlatform()) {
        // For native apps, listen for resume events via document
        document.addEventListener('resume', () => {
          if (!this.isMuted) {
            this.resumeAllAudio();
          }
        });
      }
    }
  }
  
  private loadState() {
    const saved = safeLocalStorage.getItem('global_audio_muted');
    this.isMuted = saved === 'true';
  }
  
  private saveState() {
    safeLocalStorage.setItem('global_audio_muted', this.isMuted.toString());
  }
  
  private handleVisibilityChange = () => {
    if (document.hidden) {
      // App backgrounded - audio will be suspended by iOS
      console.log('[iOS Audio] App backgrounded');
    } else {
      // App foregrounded - resume audio if not muted
      console.log('[iOS Audio] App foregrounded');
      if (!this.isMuted) {
        // Small delay to let iOS settle
        setTimeout(() => this.resumeAllAudio(), 100);
      }
    }
  };
  
  /**
   * Register an audio element for coordinated control
   */
  registerAudio(audio: HTMLAudioElement) {
    this.audioElements.add(audio);
    
    // Apply current mute state
    if (this.isMuted) {
      audio.volume = 0;
    }
  }
  
  /**
   * Unregister an audio element
   */
  unregisterAudio(audio: HTMLAudioElement) {
    this.audioElements.delete(audio);
  }
  
  /**
   * Resume all registered audio elements
   */
  private async resumeAllAudio() {
    // First resume AudioContext
    await resumeAudioContext();
    
    // Then check each audio element
    for (const audio of this.audioElements) {
      if (audio.paused && !this.isMuted) {
        // Audio was paused (possibly by iOS background), try to resume
        safePlay(audio);
      }
    }
  }
  
  /**
   * Get current mute state
   */
  getMuted(): boolean {
    return this.isMuted;
  }
  
  /**
   * Set mute state
   */
  setMuted(muted: boolean) {
    if (this.isMuted === muted) return;
    
    this.isMuted = muted;
    this.saveState();
    
    // Apply to all registered audio elements
    for (const audio of this.audioElements) {
      if (muted) {
        audio.volume = 0;
      }
      // Note: We don't restore volume here - that's handled by each audio manager
    }
    
    // Notify listeners
    this.notifyListeners();
    
    // Dispatch window event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ios-audio-mute-change', { detail: muted }));
    }
  }
  
  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }
  
  /**
   * Subscribe to mute state changes
   */
  subscribe(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.isMuted);
      } catch (e) {
        console.error('[iOS Audio] Listener error:', e);
      }
    }
  }
  
  /**
   * Check if audio can currently play
   */
  canPlay(): boolean {
    return !this.isMuted && userInteractionReceived;
  }
}

// Export singleton instance
export const iosAudioManager = new IOSAudioStateManager();

// Initialize on import
if (typeof window !== 'undefined') {
  setupIOSAudioInteraction();
}
