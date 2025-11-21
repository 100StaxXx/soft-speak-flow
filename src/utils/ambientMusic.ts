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
  private volume = 0.025; // Subtle background volume (2.5%)
  private isMuted = false;
  private isPlaying = false;
  private fadeInterval: NodeJS.Timeout | null = null;
  private currentTrack = 'ambient';
  private isPausedForEvent = false; // Track if paused for major events
  private originalVolume = 0.025; // Store original volume before ducking
  private isDucked = false; // Track if currently ducked

  // Ambient music URLs - these would be your actual music files
  private tracks = {
    ambient: '/sounds/ambient-calm.mp3',
    meditation: '/sounds/ambient-meditation.mp3',
    focus: '/sounds/ambient-focus.mp3',
    energy: '/sounds/ambient-energy.mp3',
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadPreferences();
      this.initializeAudio();
    }
  }

  private loadPreferences() {
    const savedVolume = localStorage.getItem('bg_music_volume');
    const savedMuted = localStorage.getItem('bg_music_muted');
    const savedTrack = localStorage.getItem('bg_music_track');
    
    if (savedVolume) this.volume = parseFloat(savedVolume);
    if (savedMuted) this.isMuted = savedMuted === 'true';
    if (savedTrack && savedTrack in this.tracks) {
      this.currentTrack = savedTrack as keyof typeof this.tracks;
    }
  }

  private initializeAudio() {
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.volume = this.isMuted ? 0 : this.volume;
    this.audio.preload = 'auto';
    
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
    
    if (this.audio && !this.isMuted) {
      this.audio.volume = this.volume;
    }
  }

  mute() {
    this.isMuted = true;
    localStorage.setItem('bg_music_muted', 'true');
    if (this.audio) {
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
      this.fadeIn();
    }
  }

  toggleMute(): boolean {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }

  play(track?: keyof typeof this.tracks) {
    if (!this.audio) return;

    if (track && track !== this.currentTrack) {
      this.currentTrack = track;
      localStorage.setItem('bg_music_track', track);
      this.audio.src = this.tracks[track];
    } else if (!this.audio.src) {
      this.audio.src = this.tracks[this.currentTrack];
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
      }
    }, 500); // Faster fade for events
  }

  // Resume after major event
  resumeAfterEvent() {
    if (!this.audio || !this.isPausedForEvent) return;
    
    this.isPausedForEvent = false;
    if (!this.isMuted) {
      this.audio.play()
        .then(() => {
          this.isPlaying = true;
          this.fadeIn(1500); // Gentle fade back in
        })
        .catch(err => console.error('Resume failed:', err));
    }
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.isPausedForEvent = false;
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

  // Transition between tracks
  changeTrack(track: keyof typeof this.tracks) {
    if (this.currentTrack === track) return;
    
    this.fadeOut(() => {
      this.currentTrack = track;
      localStorage.setItem('bg_music_track', track);
      if (this.audio) {
        this.audio.src = this.tracks[track];
        if (!this.isMuted && this.isPlaying) {
          this.audio.play().then(() => this.fadeIn());
        }
      }
    });
  }

  // Duck volume for other audio (e.g., pep talks)
  duck() {
    if (!this.audio || this.isDucked || this.isMuted) return;
    
    this.isDucked = true;
    this.originalVolume = this.volume;
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
    const targetVolume = this.originalVolume;
    
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
      currentTrack: this.currentTrack,
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
export const changeAmbientTrack = (track: 'ambient' | 'meditation' | 'focus' | 'energy') => 
  ambientMusic.changeTrack(track);
export const duckAmbient = () => ambientMusic.duck();
export const unduckAmbient = () => ambientMusic.unduck();
