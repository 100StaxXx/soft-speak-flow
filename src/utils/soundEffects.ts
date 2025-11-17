// Sound effects management system
class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.5;
  private isMuted = false;
  private sounds: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.loadSoundPreferences();
    }
  }

  private loadSoundPreferences() {
    const savedVolume = localStorage.getItem('sound_volume');
    const savedMuted = localStorage.getItem('sound_muted');
    
    if (savedVolume) this.masterVolume = parseFloat(savedVolume);
    if (savedMuted) this.isMuted = savedMuted === 'true';
  }

  setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('sound_volume', this.masterVolume.toString());
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('sound_muted', this.isMuted.toString());
    return this.isMuted;
  }

  private createOscillator(frequency: number, duration: number, type: OscillatorType = 'sine'): AudioBufferSourceNode | null {
    if (!this.audioContext || this.isMuted) return null;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(this.masterVolume * 0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);

    return null;
  }

  // Evolution sounds
  playEvolutionStart() {
    if (!this.audioContext || this.isMuted) return;

    // Magical ascending arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 0.2, 'sine');
      }, i * 100);
    });
  }

  playEvolutionSuccess() {
    if (!this.audioContext || this.isMuted) return;

    // Victory fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C (higher octave)
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 0.3, 'triangle');
      }, i * 150);
    });

    // Add sparkle effect
    setTimeout(() => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const freq = 1000 + Math.random() * 1000;
          this.createOscillator(freq, 0.1, 'sine');
        }, i * 50);
      }
    }, 600);
  }

  playSparkle() {
    if (!this.audioContext || this.isMuted) return;

    const freq = 1500 + Math.random() * 1000;
    this.createOscillator(freq, 0.15, 'sine');
  }

  // UI interaction sounds
  playHabitComplete() {
    if (!this.audioContext || this.isMuted) return;

    // Satisfying click-ding
    this.createOscillator(800, 0.1, 'triangle');
    setTimeout(() => {
      this.createOscillator(1200, 0.15, 'sine');
    }, 50);
  }

  playXPGain() {
    if (!this.audioContext || this.isMuted) return;

    // Quick ascending notes
    const notes = [440, 554.37, 659.25]; // A, C#, E
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 0.1, 'square');
      }, i * 40);
    });
  }

  playMissionComplete() {
    if (!this.audioContext || this.isMuted) return;

    // Achievement sound
    this.createOscillator(523.25, 0.15, 'triangle');
    setTimeout(() => {
      this.createOscillator(659.25, 0.15, 'triangle');
    }, 75);
    setTimeout(() => {
      this.createOscillator(783.99, 0.2, 'triangle');
    }, 150);
  }

  playAchievementUnlock() {
    if (!this.audioContext || this.isMuted) return;

    // Epic achievement fanfare
    const melody = [
      { freq: 392.00, duration: 0.2 },
      { freq: 523.25, duration: 0.2 },
      { freq: 659.25, duration: 0.3 },
      { freq: 783.99, duration: 0.4 }
    ];

    melody.forEach((note, i) => {
      setTimeout(() => {
        this.createOscillator(note.freq, note.duration, 'triangle');
      }, i * 150);
    });
  }

  playButtonClick() {
    if (!this.audioContext || this.isMuted) return;

    this.createOscillator(300, 0.05, 'square');
  }

  playNotification() {
    if (!this.audioContext || this.isMuted) return;

    // Gentle notification chime
    this.createOscillator(660, 0.15, 'sine');
    setTimeout(() => {
      this.createOscillator(880, 0.2, 'sine');
    }, 100);
  }

  playStreakMilestone() {
    if (!this.audioContext || this.isMuted) return;

    // Celebratory sequence
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C, E, G, C, E
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 0.25, 'triangle');
      }, i * 100);
    });
  }

  // Ambient sounds (simple versions)
  playAmbientNature() {
    if (!this.audioContext || this.isMuted) return;

    // Create gentle nature ambience with multiple oscillators
    const frequencies = [100, 150, 200, 250];
    frequencies.forEach(freq => {
      this.createOscillator(freq + Math.random() * 20, 2, 'sine');
    });

    // Repeat periodically
    const interval = setInterval(() => {
      if (this.isMuted) {
        clearInterval(interval);
        return;
      }
      frequencies.forEach(freq => {
        this.createOscillator(freq + Math.random() * 20, 2, 'sine');
      });
    }, 2000);

    return () => clearInterval(interval);
  }

  playCalming() {
    if (!this.audioContext || this.isMuted) return;

    // Calming tones for meditation
    this.createOscillator(220, 3, 'sine');
    setTimeout(() => {
      this.createOscillator(440, 3, 'sine');
    }, 1500);
  }
}

export const soundManager = new SoundManager();

// Export individual sound functions for convenience
export const playEvolutionStart = () => soundManager.playEvolutionStart();
export const playEvolutionSuccess = () => soundManager.playEvolutionSuccess();
export const playSparkle = () => soundManager.playSparkle();
export const playHabitComplete = () => soundManager.playHabitComplete();
export const playXPGain = () => soundManager.playXPGain();
export const playMissionComplete = () => soundManager.playMissionComplete();
export const playAchievementUnlock = () => soundManager.playAchievementUnlock();
export const playButtonClick = () => soundManager.playButtonClick();
export const playNotification = () => soundManager.playNotification();
export const playStreakMilestone = () => soundManager.playStreakMilestone();
export const playAmbientNature = () => soundManager.playAmbientNature();
export const playCalming = () => soundManager.playCalming();
