import { safeLocalStorage } from '@/utils/storage';
import { globalAudio } from './globalAudio';
import { createIOSOptimizedAudio, isIOS, iosAudioManager, safePlay } from './iosAudio';

// Custom event interfaces
interface VolumeChangeEvent extends CustomEvent {
  detail: number;
}

interface MuteChangeEvent extends CustomEvent {
  detail: boolean;
}

// Ambient music system with persistence
class AmbientMusicManager {
  private audio: HTMLAudioElement | null = null;
  private volume = 0.15; // Subtle background volume (15%) - like MTG Arena/Pokemon TCG
  private isMuted = false;
  private isGloballyMuted = false; // Track global mute state
  private isPlaying = false;
  private fadeInterval: NodeJS.Timeout | null = null;
  private isPausedForEvent = false; // Track if paused for major events
  private isDucked = false; // Track if currently ducked
  private isMuting = false; // Prevent rapid mute/unmute
  private isStopped = false; // Track if intentionally stopped to prevent callback execution
  private isDucking = false; // Prevent rapid duck/unduck
  private wasDuckedBeforeMute = false; // Remember duck state when muted
  private lastVolumeChangeTime = 0; // Rate limiting for volume changes
  private pendingVolumeTimeout: NodeJS.Timeout | null = null; // Track pending volume change
  private volumeChangeHandler: ((e: Event) => void) | null = null; // Store handler for cleanup
  private muteChangeHandler: ((e: Event) => void) | null = null; // Store handler for cleanup
  private globalMuteHandler: ((e: Event) => void) | null = null; // Store global mute handler for cleanup
  private globalMuteUnsubscribe: (() => void) | null = null; // Unsubscribe from global mute
  private playTimeout: NodeJS.Timeout | null = null; // Timeout for play() promise
  private errorHandler: ((e: Event) => void) | null = null; // Audio error handler
  private stalledHandler: (() => void) | null = null; // Audio stalled handler
  private canPlayHandler: (() => void) | null = null; // Audio can play handler

  // Background music track - nostalgic piano
  private trackUrl = '/sounds/ambient-calm.mp3';

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadPreferences();
      this.initializeAudio();
      
      // Subscribe to global mute changes
      this.isGloballyMuted = globalAudio.getMuted();
      this.globalMuteUnsubscribe = globalAudio.subscribe((muted) => {
        this.handleGlobalMuteChange(muted);
      });
      
      // Clean up on page unload to prevent timer leaks
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }
  
  // Handle global mute state changes
  private handleGlobalMuteChange(muted: boolean) {
    this.isGloballyMuted = muted;
    if (this.audio) {
      // Use muted property for proper iOS support
      this.audio.muted = muted || this.isMuted;
      
      if (muted) {
        // Global mute turned on - mute the ambient music immediately
        if (!this.isMuted) {
          // Clear any active fades first
          if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
          }
        }
      } else {
        // Global mute turned off - restore ambient music if not locally muted
        if (!this.isMuted && this.isPlaying) {
          // Restore volume immediately (muted property already set above)
          this.audio.volume = this.isDucked ? this.volume * 0.02 : this.volume;
        } else if (!this.isMuted && !this.isPlaying) {
          this.play();
        }
      }
    }
  }
  
  // Check if audio should be muted (either locally or globally)
  private shouldMute(): boolean {
    return this.isMuted || this.isGloballyMuted;
  }
  
  // Clean up all timers, listeners, and state
  private cleanup() {
    // Clear all timers
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.pendingVolumeTimeout) {
      clearTimeout(this.pendingVolumeTimeout);
      this.pendingVolumeTimeout = null;
    }
    if (this.playTimeout) {
      clearTimeout(this.playTimeout);
      this.playTimeout = null;
    }
    
    // Remove window event listeners
    if (typeof window !== 'undefined') {
      if (this.volumeChangeHandler) {
        window.removeEventListener('bg-music-volume-change', this.volumeChangeHandler);
        this.volumeChangeHandler = null;
      }
      if (this.muteChangeHandler) {
        window.removeEventListener('bg-music-mute-change', this.muteChangeHandler);
        this.muteChangeHandler = null;
      }
      if (this.globalMuteHandler) {
        // globalMuteHandler is only used on iOS for ios-audio-mute-change
        if (isIOS) {
          window.removeEventListener('ios-audio-mute-change', this.globalMuteHandler);
        }
        this.globalMuteHandler = null;
      }
    }
    
    // Unsubscribe from global mute
    if (this.globalMuteUnsubscribe) {
      this.globalMuteUnsubscribe();
      this.globalMuteUnsubscribe = null;
    }
    
    // Clean up audio element (remove event listeners to prevent memory leaks)
    if (this.audio) {
      // Unregister from iOS audio manager
      if (isIOS) {
        iosAudioManager.unregisterAudio(this.audio);
      }
      
      this.audio.pause();
      
      // Remove all audio event listeners
      if (this.errorHandler) {
        this.audio.removeEventListener('error', this.errorHandler);
        this.errorHandler = null;
      }
      if (this.stalledHandler) {
        this.audio.removeEventListener('stalled', this.stalledHandler);
        this.stalledHandler = null;
      }
      if (this.canPlayHandler) {
        this.audio.removeEventListener('canplaythrough', this.canPlayHandler);
        this.canPlayHandler = null;
      }
      
      this.audio.src = ''; // Release audio resource
      this.audio = null;
    }
  }

  private loadPreferences() {
    try {
      const savedVolume = safeLocalStorage.getItem('bg_music_volume');
      const savedMuted = safeLocalStorage.getItem('bg_music_muted');
      
      if (savedVolume) {
        const parsed = parseFloat(savedVolume);
        // Validate parsed volume is a valid number between 0 and 1
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }
      if (savedMuted) this.isMuted = savedMuted === 'true';
    } catch (e) {
      // localStorage might not be available (private browsing, etc.)
      console.warn('Failed to load music preferences:', e);
    }
  }

  private initializeAudio() {
    // Use iOS-optimized audio element
    this.audio = createIOSOptimizedAudio();
    this.audio.loop = true;
    this.audio.volume = this.volume;
    this.audio.muted = this.isMuted || this.isGloballyMuted; // Use muted property for proper iOS support
    this.audio.preload = 'auto';
    
    // Register with iOS audio manager for coordinated control
    if (isIOS) {
      iosAudioManager.registerAudio(this.audio);
    }
    
    // Add error handlers for audio element - store refs for cleanup
    this.errorHandler = (e) => {
      console.error('Background music error:', e);
      this.isPlaying = false;
      this.isDucked = false;
      this.isPausedForEvent = false;
      this.isDucking = false;
      this.isMuting = false;
      this.isStopped = false;
      this.wasDuckedBeforeMute = false;
      // Clear any active fades on error
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
      // Clear any pending volume changes
      if (this.pendingVolumeTimeout) {
        clearTimeout(this.pendingVolumeTimeout);
        this.pendingVolumeTimeout = null;
      }
      // Clear any pending play timeout
      if (this.playTimeout) {
        clearTimeout(this.playTimeout);
        this.playTimeout = null;
      }
    };
    this.audio.addEventListener('error', this.errorHandler);
    
    this.stalledHandler = () => {
      // Audio loading stalled - browser will retry automatically
    };
    this.audio.addEventListener('stalled', this.stalledHandler);
    
    // Handle successful load
    this.canPlayHandler = () => {
      // Audio loaded and ready to play
    };
    this.audio.addEventListener('canplaythrough', this.canPlayHandler);
    
    // Listen for volume/mute changes - store handlers for cleanup
    if (typeof window !== 'undefined') {
      this.volumeChangeHandler = (e: Event) => {
        const volumeEvent = e as VolumeChangeEvent;
        this.setVolume(volumeEvent.detail);
      };
      
      this.muteChangeHandler = (e: Event) => {
        const muteEvent = e as MuteChangeEvent;
        if (muteEvent.detail) {
          this.mute();
        } else {
          this.unmute();
        }
      };
      
      window.addEventListener('bg-music-volume-change', this.volumeChangeHandler);
      window.addEventListener('bg-music-mute-change', this.muteChangeHandler);
      
      // iOS global mute is handled by globalAudio.subscribe() -> handleGlobalMuteChange()
      // No separate iOS event handler needed - it was causing double-handling and localStorage bugs
    }

    // Auto-play on user interaction (browser requirement)
    const startOnInteraction = () => {
      if (!this.isPlaying && !this.isMuted && !this.isGloballyMuted) {
        this.play();
      }
      // Remove listeners after first interaction
      document.removeEventListener('click', startOnInteraction);
      document.removeEventListener('touchstart', startOnInteraction);
      document.removeEventListener('keydown', startOnInteraction);
    };

    document.addEventListener('click', startOnInteraction);
    document.addEventListener('touchstart', startOnInteraction);
    document.addEventListener('keydown', startOnInteraction);
  }

  setVolume(volume: number) {
    // Rate limit volume changes to prevent excessive calls
    const now = Date.now();
    if (now - this.lastVolumeChangeTime < 50) {
      // Clear any pending timeout and schedule a new one
      if (this.pendingVolumeTimeout) {
        clearTimeout(this.pendingVolumeTimeout);
      }
      this.pendingVolumeTimeout = setTimeout(() => {
        this.pendingVolumeTimeout = null;
        this.setVolume(volume);
      }, 50);
      return;
    }
    this.lastVolumeChangeTime = now;
    
    this.volume = Math.max(0, Math.min(1, volume));
    
    try {
      safeLocalStorage.setItem('bg_music_volume', this.volume.toString());
    } catch (e) {
      console.warn('Failed to save volume preference:', e);
    }
    
    // Cancel any active fade when user manually adjusts volume
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    
    // FIXED: Always apply volume to audio element if it exists
    // The muted property handles actual muting, not volume level
    if (this.audio) {
      const newVolume = this.isDucked ? this.volume * 0.02 : this.volume;
      this.audio.volume = newVolume;
      console.log('[AmbientMusic] setVolume applied:', newVolume, 'base:', this.volume, 'ducked:', this.isDucked);
    }
  }

  mute() {
    if (this.isMuting) return; // Prevent rapid clicks
    this.isMuting = true;
    
    // Remember duck state before muting
    this.wasDuckedBeforeMute = this.isDucked;
    
    this.isMuted = true;
    try {
      safeLocalStorage.setItem('bg_music_muted', 'true');
    } catch (e) {
      console.warn('Failed to save mute preference:', e);
    }
    
    if (this.audio) {
      // Clear any active fades first
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
      // Use muted property for proper iOS support
      this.audio.muted = this.isMuted || this.isGloballyMuted;
    }
    this.isMuting = false;
  }

  unmute() {
    if (this.isMuting) return; // Prevent rapid clicks
    this.isMuting = true;
    
    this.isMuted = false;
    try {
      safeLocalStorage.setItem('bg_music_muted', 'false');
    } catch (e) {
      console.warn('Failed to save mute preference:', e);
    }
    
    // Restore duck state if it was ducked before muting
    if (this.wasDuckedBeforeMute) {
      this.isDucked = true;
      this.wasDuckedBeforeMute = false;
    }
    
    if (this.audio) {
      // Update muted property (respects global mute state)
      this.audio.muted = this.isMuted || this.isGloballyMuted;
    }
    
    if (!this.isPlaying) {
      this.play();
      this.isMuting = false;
    } else if (this.audio) {
      // If ducked, don't fade in to full volume - let duck state manage volume
      if (!this.isDucked) {
        this.fadeIn(2000);
        // Reset flag after fade completes (use actual fade duration)
        setTimeout(() => { this.isMuting = false; }, 2000);
      } else {
        // Set to ducked volume
        this.audio.volume = this.volume * 0.02;
        this.isMuting = false;
      }
    } else {
      this.isMuting = false;
    }
  }

  toggleMute(): boolean {
    if (this.isMuted) {
      this.unmute();
      return false; // Now unmuted
    } else {
      this.mute();
      return true; // Now muted
    }
  }

  // Check if we're on a route where audio should be disabled
  private isOnDisabledRoute(): boolean {
    const disabledRoutes = ['/journeys'];
    if (typeof window !== 'undefined') {
      return disabledRoutes.includes(window.location.pathname);
    }
    return false;
  }

  play() {
    if (!this.audio) return;
    
    // Don't play on disabled routes (like /journeys where music should be off)
    if (this.isOnDisabledRoute()) {
      return;
    }
    
    // Don't play if already playing
    if (this.isPlaying && !this.audio.paused) return;

    if (!this.audio.src) {
      this.audio.src = this.trackUrl;
    }

    if (!this.shouldMute()) {
      this.isStopped = false;
      // Ensure audio is not muted for fade-in to work
      this.audio.muted = false;
      this.audio.volume = 0;
      
      // Clear any existing play timeout
      if (this.playTimeout) {
        clearTimeout(this.playTimeout);
      }
      
      // Set timeout in case play() promise never resolves
      this.playTimeout = setTimeout(() => {
        if (!this.isPlaying) {
          this.isPlaying = false;
        }
        this.playTimeout = null;
      }, 5000); // 5 second timeout
      
      this.audio.play()
        .then(() => {
          // Clear timeout on success
          if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
          }
          if (!this.isStopped && !this.shouldMute()) {
            this.isPlaying = true;
            this.fadeIn();
          }
        })
        .catch((err) => {
          // Clear timeout on error
          if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
          }
          // Autoplay prevented - this is expected on some browsers
          this.isPlaying = false;
        });
    } else {
      // If muted, don't change isPlaying state
      this.isPlaying = false;
    }
  }

  pause() {
    if (!this.audio || !this.isPlaying) return;
    
    this.fadeOut(() => {
      if (this.audio) {
        this.audio.pause();
        this.isPlaying = false;
        // Don't reset isPausedForEvent - that's only for event-specific pauses
      }
    });
  }

  // Pause for major events (evolution, etc.)
  pauseForEvent() {
    if (!this.audio || !this.isPlaying || this.isPausedForEvent) return;
    
    this.isPausedForEvent = true;
    this.fadeOut(() => {
      if (this.audio && !this.isStopped) {
        this.audio.pause();
        this.isPlaying = false;
      }
    }, 500); // Faster fade for events
  }

  // Resume after major event
  resumeAfterEvent() {
    if (!this.audio || !this.isPausedForEvent) return;
    
    // Don't resume if already playing
    if (this.isPlaying && !this.audio.paused) {
      this.isPausedForEvent = false;
      return;
    }
    
    this.isPausedForEvent = false;
    this.isStopped = false; // Clear stopped flag when resuming from event
    
    if (!this.shouldMute()) {
      // Ensure audio is not muted for fade-in to work
      this.audio.muted = false;
      this.audio.volume = 0;
      
      // Set timeout for resume
      if (this.playTimeout) {
        clearTimeout(this.playTimeout);
      }
      this.playTimeout = setTimeout(() => {
        if (!this.isPlaying) {
          this.isPlaying = false;
        }
        this.playTimeout = null;
      }, 5000);
      
      this.audio.play()
        .then(() => {
          if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
          }
          if (!this.isStopped && !this.shouldMute()) {
            this.isPlaying = true;
            this.fadeIn(1500); // Gentle fade back in
          }
        })
        .catch(err => {
          if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
          }
          this.isPlaying = false;
        });
    }
  }

  stop() {
    if (!this.audio) return;
    
    // Set flag to prevent callbacks from executing
    this.isStopped = true;
    
    // Clear any active fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    
    // Clear any pending volume changes
    if (this.pendingVolumeTimeout) {
      clearTimeout(this.pendingVolumeTimeout);
      this.pendingVolumeTimeout = null;
    }
    
    // Clear any pending play timeout
    if (this.playTimeout) {
      clearTimeout(this.playTimeout);
      this.playTimeout = null;
    }
    
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.isPausedForEvent = false;
    this.isDucked = false; // Reset duck state
    this.isMuting = false; // Reset muting flag
    this.isDucking = false; // Reset ducking flag
    this.wasDuckedBeforeMute = false; // Reset remembered duck state
  }

  private fadeIn(duration = 2000) {
    if (!this.audio || this.shouldMute() || this.isStopped) return;
    
    // Prevent very small durations that could cause issues
    duration = Math.max(duration, 100);
    
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    
    // Use ducked volume if currently ducked, otherwise use normal volume
    const targetVolume = this.isDucked ? this.volume * 0.02 : this.volume;
    const steps = Math.max(10, Math.min(20, Math.floor(duration / 50))); // Adaptive steps
    const stepDuration = duration / steps;
    const volumeIncrement = targetVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      // Verify audio still exists and is playing, and not stopped
      if (!this.audio || !this.isPlaying || this.isStopped) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        return;
      }
      
      currentStep++;
      this.audio.volume = Math.min(volumeIncrement * currentStep, targetVolume);
      
      if (currentStep >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
    }, stepDuration);
  }

  private fadeOut(callback?: () => void, duration = 1000) {
    if (!this.audio) return;
    
    // Prevent very small durations that could cause issues
    duration = Math.max(duration, 100);
    
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    
    const startVolume = this.audio.volume;
    const steps = Math.max(10, Math.min(20, Math.floor(duration / 50))); // Adaptive steps
    const stepDuration = duration / steps;
    const volumeDecrement = startVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      // Verify audio still exists and not stopped
      if (!this.audio || this.isStopped) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        // Don't execute callback if stopped
        if (!this.isStopped) callback?.();
        return;
      }
      
      currentStep++;
      this.audio.volume = Math.max(startVolume - (volumeDecrement * currentStep), 0);
      
      if (currentStep >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        // Only execute callback if not stopped
        if (!this.isStopped) callback?.();
      }
    }, stepDuration);
  }


  // Duck volume for other audio (e.g., pep talks)
  duck() {
    // Only need audio element and not already ducked/ducking
    if (!this.audio || this.isDucked || this.isDucking) return;
    
    console.log('[AmbientMusic] duck() called - isPlaying:', this.isPlaying, 'shouldMute:', this.shouldMute());
    
    // FIXED: Always track duck state, even if muted or not playing
    this.isDucked = true;
    this.isDucking = true;
    
    const duckedVolume = this.volume * 0.02; // Reduce to 2% of original for clearer pep talk audio
    
    // FIXED: Always apply ducked volume immediately to audio element
    // This ensures correct volume regardless of play state
    if (!this.shouldMute() && this.audio) {
      this.audio.volume = duckedVolume;
      console.log('[AmbientMusic] duck() - applied ducked volume immediately:', duckedVolume);
    }
    
    // If not playing or muted, we're done (state is set, volume applied)
    if (this.shouldMute() || !this.isPlaying) {
      console.log('[AmbientMusic] duck() - state tracked, volume set (muted or not playing)');
      this.isDucking = false;
      return;
    }
    
    // Already applied the volume above, just mark as done
    this.isDucking = false;
    console.log('[AmbientMusic] duck() complete, volume:', this.audio.volume);
  }

  // Restore volume after ducking
  unduck() {
    if (!this.audio || !this.isDucked || this.isDucking) return;
    
    console.log('[AmbientMusic] unduck() called - shouldMute:', this.shouldMute(), 'isPlaying:', this.isPlaying);
    
    // FIXED: Always clear duck state first
    this.isDucked = false;
    this.wasDuckedBeforeMute = false;
    this.isDucking = true;
    
    // Use current this.volume in case user changed it while ducked
    const targetVolume = this.volume;
    
    // FIXED: Always apply target volume immediately to audio element
    // This ensures correct volume regardless of play state
    if (!this.shouldMute() && this.audio) {
      this.audio.volume = targetVolume;
      console.log('[AmbientMusic] unduck() - applied target volume immediately:', targetVolume);
    }
    
    // If not playing or muted, we're done (state is cleared, volume applied)
    if (this.shouldMute() || !this.isPlaying) {
      console.log('[AmbientMusic] unduck() - state cleared, volume set (muted or not playing)');
      this.isDucking = false;
      return;
    }
    
    // Already applied the volume above, just mark as done
    this.isDucking = false;
    console.log('[AmbientMusic] unduck() complete, volume:', this.audio.volume);
  }

  // Get current state
  getState() {
    return {
      isPlaying: this.isPlaying,
      isMuted: this.shouldMute(), // Return effective mute state (local OR global)
      isLocallyMuted: this.isMuted,
      isGloballyMuted: this.isGloballyMuted,
      volume: this.volume,
      isPausedForEvent: this.isPausedForEvent,
    };
  }
}

export const ambientMusic = new AmbientMusicManager();

// Convenience exports
export const playAmbient = () => ambientMusic.play();
export const pauseAmbient = () => ambientMusic.pause();
export const pauseAmbientForEvent = () => ambientMusic.pauseForEvent();
export const resumeAmbientAfterEvent = () => ambientMusic.resumeAfterEvent();
export const toggleAmbientMute = () => ambientMusic.toggleMute();
export const setAmbientVolume = (volume: number) => ambientMusic.setVolume(volume);
export const duckAmbient = () => ambientMusic.duck();
export const unduckAmbient = () => ambientMusic.unduck();
