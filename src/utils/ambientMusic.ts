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
  private isPlaying = false;
  private fadeInterval: NodeJS.Timeout | null = null;
  private isPausedForEvent = false; // Track if paused for major events
  private isDucked = false; // Track if currently ducked

  // Background music track - nostalgic piano
  private trackUrl = '/sounds/ambient-calm.mp3';

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadPreferences();
      this.initializeAudio();
    }
  }

  private loadPreferences() {
    const savedVolume = localStorage.getItem('bg_music_volume');
    const savedMuted = localStorage.getItem('bg_music_muted');
    
    if (savedVolume) {
      const parsed = parseFloat(savedVolume);
      // Validate parsed volume is a valid number between 0 and 1
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        this.volume = parsed;
      }
    }
    if (savedMuted) this.isMuted = savedMuted === 'true';
  }

  private initializeAudio() {
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.volume = this.isMuted ? 0 : this.volume;
    this.audio.preload = 'auto';
    
    // Add error handlers for audio element
    this.audio.addEventListener('error', (e) => {
      console.error('Background music error:', e);
      this.isPlaying = false;
    });
    
    this.audio.addEventListener('stalled', () => {
      console.warn('Background music stalled, attempting to recover...');
    });
    
    // Listen for volume/mute changes
    if (typeof window !== 'undefined') {
      window.addEventListener('bg-music-volume-change', (e: Event) => {
        const volumeEvent = e as VolumeChangeEvent;
        this.setVolume(volumeEvent.detail);
      });

      window.addEventListener('bg-music-mute-change', (e: Event) => {
        const muteEvent = e as MuteChangeEvent;
        if (muteEvent.detail) {
          this.mute();
        } else {
          this.unmute();
        }
      });
    }

    // Auto-play on user interaction (browser requirement)
    const startOnInteraction = () => {
      if (!this.isPlaying && !this.isMuted) {
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
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('bg_music_volume', this.volume.toString());
    
    // Only update audio volume if not muted and not ducked
    // If ducked, the volume will be restored when unduck() is called
    if (this.audio && !this.isMuted && !this.isDucked) {
      this.audio.volume = this.volume;
    }
  }

  mute() {
    this.isMuted = true;
    localStorage.setItem('bg_music_muted', 'true');
    if (this.audio) {
      // Clear any active fades first
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
      this.fadeOut(() => {
        if (this.audio) this.audio.volume = 0;
      });
    }
  }

  unmute() {
    this.isMuted = false;
    localStorage.setItem('bg_music_muted', 'false');
    
    if (!this.isPlaying) {
      this.play();
    } else if (this.audio) {
      // If ducked, don't fade in to full volume - let duck state manage volume
      if (!this.isDucked) {
        this.fadeIn();
      } else {
        // Set to ducked volume
        this.audio.volume = this.volume * 0.15;
      }
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

  play() {
    if (!this.audio) return;
    
    // Don't play if already playing
    if (this.isPlaying && !this.audio.paused) return;

    if (!this.audio.src) {
      this.audio.src = this.trackUrl;
    }

    if (!this.isMuted) {
      this.audio.volume = 0;
      this.audio.play()
        .then(() => {
          this.isPlaying = true;
          this.fadeIn();
        })
        .catch(() => {
          // Autoplay prevented - this is expected on some browsers
          this.isPlaying = false;
        });
    }
  }

  pause() {
    if (!this.audio) return;
    
    this.fadeOut(() => {
      if (this.audio) {
        this.audio.pause();
        this.isPlaying = false;
      }
    });
  }

  // Pause for major events (evolution, etc.)
  pauseForEvent() {
    if (!this.audio || !this.isPlaying) return;
    
    this.isPausedForEvent = true;
    this.fadeOut(() => {
      if (this.audio) {
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
    if (!this.isMuted) {
      this.audio.volume = 0;
      this.audio.play()
        .then(() => {
          this.isPlaying = true;
          this.fadeIn(1500); // Gentle fade back in
        })
        .catch(err => {
          console.error('Resume failed:', err);
          this.isPlaying = false;
        });
    }
  }

  stop() {
    if (!this.audio) return;
    
    // Clear any active fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.isPausedForEvent = false;
    this.isDucked = false; // Reset duck state
  }

  private fadeIn(duration = 2000) {
    if (!this.audio || this.isMuted) return;
    
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    
    const targetVolume = this.volume;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeIncrement = targetVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.audio) return;
      
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
    
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    
    const startVolume = this.audio.volume;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeDecrement = startVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.audio) return;
      
      currentStep++;
      this.audio.volume = Math.max(startVolume - (volumeDecrement * currentStep), 0);
      
      if (currentStep >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        callback?.();
      }
    }, stepDuration);
  }


  // Duck volume for other audio (e.g., pep talks)
  duck() {
    if (!this.audio || this.isDucked || this.isMuted) return;
    
    this.isDucked = true;
    const duckedVolume = this.volume * 0.15; // Reduce to 15% of original
    
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    
    const startVolume = this.audio.volume;
    const steps = 10;
    const stepDuration = 300 / steps;
    const volumeDecrement = (startVolume - duckedVolume) / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.audio) return;
      
      currentStep++;
      this.audio.volume = Math.max(startVolume - (volumeDecrement * currentStep), duckedVolume);
      
      if (currentStep >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
    }, stepDuration);
  }

  // Restore volume after ducking
  unduck() {
    if (!this.audio || !this.isDucked || this.isMuted) return;
    
    this.isDucked = false;
    // Use current this.volume in case user changed it while ducked
    const targetVolume = this.volume;
    
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    
    const startVolume = this.audio.volume;
    const steps = 10;
    const stepDuration = 500 / steps;
    const volumeIncrement = (targetVolume - startVolume) / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.audio) return;
      
      currentStep++;
      this.audio.volume = Math.min(startVolume + (volumeIncrement * currentStep), targetVolume);
      
      if (currentStep >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
    }, stepDuration);
  }

  // Get current state
  getState() {
    return {
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      volume: this.volume,
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
