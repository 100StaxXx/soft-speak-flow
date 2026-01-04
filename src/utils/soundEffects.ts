import { safeLocalStorage } from './storage';
import { globalAudio } from './globalAudio';
import { getSharedAudioContext, isIOS, resumeAudioContext, createIOSOptimizedAudio, iosAudioManager } from './iosAudio';

// Sound effects management system
class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.5;
  private isMuted = false;
  private isGloballyMuted = false;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private activeIntervals: Set<NodeJS.Timeout> = new Set();
  private globalMuteUnsubscribe: (() => void) | null = null;


  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = getSharedAudioContext();
      this.loadSoundPreferences();
      
      this.isGloballyMuted = globalAudio.getMuted();
      this.globalMuteUnsubscribe = globalAudio.subscribe((muted) => {
        this.isGloballyMuted = muted;
        if (muted) {
          this.stopAllAmbientSounds();
        }
      });
      
      window.addEventListener('beforeunload', () => {
        this.stopAllAmbientSounds();
        if (this.globalMuteUnsubscribe) {
          this.globalMuteUnsubscribe();
        }
      });
    }
  }

  // Check if audio should be muted (either locally or globally)
  private shouldMute(): boolean {
    return this.isMuted || this.isGloballyMuted;
  }
  
  // Ensure audio context is ready (especially for iOS)
  private async ensureAudioContext(): Promise<AudioContext | null> {
    if (!this.audioContext) {
      this.audioContext = getSharedAudioContext();
    }
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await resumeAudioContext();
    }
    
    return this.audioContext;
  }

  private loadSoundPreferences() {
    const savedVolume = safeLocalStorage.getItem('sound_volume');
    const savedMuted = safeLocalStorage.getItem('sound_muted');
    
    if (savedVolume) this.masterVolume = parseFloat(savedVolume);
    if (savedMuted) this.isMuted = savedMuted === 'true';
  }

  setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    safeLocalStorage.setItem('sound_volume', this.masterVolume.toString());
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    safeLocalStorage.setItem('sound_muted', this.isMuted.toString());
    if (this.isMuted) {
      this.stopAllAmbientSounds();
    }
    return this.isMuted;
  }

  stopAllAmbientSounds() {
    this.activeIntervals.forEach(interval => clearInterval(interval));
    this.activeIntervals.clear();
  }

  private createOscillator(frequency: number, duration: number, type: OscillatorType = 'sine'): AudioBufferSourceNode | null {
    if (!this.audioContext || this.shouldMute()) return null;

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
    if (!this.audioContext || this.shouldMute()) return;

    // Create powerful ascending magical tones with harmonics
    const frequencies = [220, 277, 330, 440, 554, 659, 880, 1108];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 0.2, 'sawtooth');
        // Add harmonic
        this.createOscillator(freq * 1.5, 0.1, 'sine');
      }, i * 80);
    });
  }

  playEvolutionSuccess() {
    if (!this.audioContext || this.shouldMute()) return;

    // Create an epic triumphant fanfare with bass and harmonics
    const bassTones = [130.81, 164.81, 196.00]; // C3, E3, G3
    const chords = [
      [523.25, 659.25, 783.99], // C5 major
      [659.25, 830.61, 987.77], // E5 major
      [783.99, 987.77, 1174.66], // G5 major
      [1046.50, 1318.51, 1567.98], // C6 major - final high chord
    ];
    
    // Play bass foundation
    bassTones.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 0.4, 'sawtooth');
      }, i * 150);
    });
    
    // Play bright chords on top
    chords.forEach((chord, i) => {
      setTimeout(() => {
        chord.forEach(freq => {
          this.createOscillator(freq, 0.35, 'triangle');
          // Add sparkle harmonics
          this.createOscillator(freq * 2, 0.15, 'sine');
        });
      }, i * 180);
    });
  }

  playSparkle() {
    if (!this.audioContext || this.shouldMute()) return;

    const freq = 1500 + Math.random() * 1000;
    this.createOscillator(freq, 0.15, 'sine');
  }

  // UI interaction sounds
  playHabitComplete() {
    if (!this.audioContext || this.shouldMute()) return;

    // Satisfying click-ding
    this.createOscillator(800, 0.1, 'triangle');
    setTimeout(() => {
      this.createOscillator(1200, 0.15, 'sine');
    }, 50);
  }

  playXPGain() {
    if (!this.audioContext || this.shouldMute()) return;

    // Quick ascending notes
    const notes = [440, 554.37, 659.25]; // A, C#, E
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 0.1, 'square');
      }, i * 40);
    });
  }

  playMissionComplete() {
    if (!this.audioContext || this.shouldMute()) return;

    // Achievement sound
    this.createOscillator(523.25, 0.15, 'triangle');
    setTimeout(() => {
      this.createOscillator(659.25, 0.15, 'triangle');
    }, 75);
    setTimeout(() => {
      this.createOscillator(783.99, 0.2, 'triangle');
    }, 150);
  }

  playLessonComplete() {
    if (!this.audioContext || this.shouldMute()) return;

    // Gentle, satisfying completion chime
    this.createOscillator(659.25, 0.2, 'sine');
    setTimeout(() => {
      this.createOscillator(783.99, 0.25, 'sine');
    }, 100);
    setTimeout(() => {
      this.createOscillator(1046.50, 0.3, 'sine');
    }, 200);
  }

  playAchievementUnlock() {
    if (!this.audioContext || this.shouldMute()) return;

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
    if (!this.audioContext || this.shouldMute()) return;

    this.createOscillator(300, 0.05, 'square');
  }

  playNotification() {
    if (!this.audioContext || this.shouldMute()) return;

    // Gentle notification chime
    this.createOscillator(660, 0.15, 'sine');
    setTimeout(() => {
      this.createOscillator(880, 0.2, 'sine');
    }, 100);
  }

  playStreakMilestone() {
    if (!this.audioContext || this.shouldMute()) return;

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
    if (!this.audioContext || this.shouldMute()) return;

    // Create gentle nature ambience with multiple oscillators
    const frequencies = [100, 150, 200, 250];
    frequencies.forEach(freq => {
      this.createOscillator(freq + Math.random() * 20, 2, 'sine');
    });

    // Repeat periodically
    const interval = setInterval(() => {
      if (this.shouldMute()) {
        clearInterval(interval);
        this.activeIntervals.delete(interval);
        return;
      }
      frequencies.forEach(freq => {
        this.createOscillator(freq + Math.random() * 20, 2, 'sine');
      });
    }, 2000);

    // Track the interval for cleanup
    this.activeIntervals.add(interval);

    return () => {
      clearInterval(interval);
      this.activeIntervals.delete(interval);
    };
  }

  playCalming() {
    if (!this.audioContext || this.shouldMute()) return;

    // Calming tones for meditation
    this.createOscillator(220, 3, 'sine');
    setTimeout(() => {
      this.createOscillator(440, 3, 'sine');
    }, 1500);
  }

  // Arcade sounds
  playArcadeEntrance() {
    if (!this.audioContext || this.shouldMute()) return;

    // Retro power-up sweep with layered oscillators
    const startFreq = 150;
    const endFreq = 800;
    const duration = 0.6;
    
    // Main sweep
    const osc1 = this.audioContext.createOscillator();
    const gain1 = this.audioContext.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + duration);
    gain1.gain.setValueAtTime(this.masterVolume * 0.25, this.audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    osc1.connect(gain1);
    gain1.connect(this.audioContext.destination);
    osc1.start();
    osc1.stop(this.audioContext.currentTime + duration);

    // Harmonic layer
    const osc2 = this.audioContext.createOscillator();
    const gain2 = this.audioContext.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(startFreq * 2, this.audioContext.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.5, this.audioContext.currentTime + duration);
    gain2.gain.setValueAtTime(this.masterVolume * 0.1, this.audioContext.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    osc2.connect(gain2);
    gain2.connect(this.audioContext.destination);
    osc2.start();
    osc2.stop(this.audioContext.currentTime + duration);

    // Sparkle at the end
    setTimeout(() => {
      this.createOscillator(1200, 0.15, 'sine');
      this.createOscillator(1500, 0.1, 'sine');
    }, 400);
  }

  playArcadeSelect() {
    if (!this.audioContext || this.shouldMute()) return;

    // Quick 8-bit bloop
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.08);
    gain.gain.setValueAtTime(this.masterVolume * 0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.1);
  }

  playArcadeHighScore() {
    if (!this.audioContext || this.shouldMute()) return;

    // Victory fanfare arpeggio C5 → E5 → G5 → C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscillator(freq, 0.2, 'triangle');
        // Add sparkle harmonic
        this.createOscillator(freq * 2, 0.1, 'sine');
      }, i * 100);
    });

    // Final chord burst
    setTimeout(() => {
      [1046.50, 1318.51, 1567.98].forEach(freq => {
        this.createOscillator(freq, 0.4, 'triangle');
      });
    }, 450);
  }

  // Pokemon-style encounter trigger sound - classic ascending arpeggio
  playEncounterTrigger() {
    if (!this.audioContext || this.shouldMute()) return;

    // Classic Pokemon "wild encounter!" arpeggio: E4 → G4 → B4 → E5
    const notes = [329.63, 392.00, 493.88, 659.25];
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = this.audioContext!.createOscillator();
        const gain = this.audioContext!.createGain();
        
        // Square wave for authentic 8-bit feel
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.audioContext!.currentTime);
        
        gain.gain.setValueAtTime(this.masterVolume * 0.25, this.audioContext!.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(this.audioContext!.destination);
        osc.start();
        osc.stop(this.audioContext!.currentTime + 0.15);
      }, i * 100);
    });
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
export const playLessonComplete = () => soundManager.playLessonComplete();
export const playAchievementUnlock = () => soundManager.playAchievementUnlock();
export const playButtonClick = () => soundManager.playButtonClick();
export const playNotification = () => soundManager.playNotification();
export const playStreakMilestone = () => soundManager.playStreakMilestone();
export const playAmbientNature = () => soundManager.playAmbientNature();
export const playCalming = () => soundManager.playCalming();
export const playArcadeEntrance = () => soundManager.playArcadeEntrance();
export const playArcadeSelect = () => soundManager.playArcadeSelect();
export const playArcadeHighScore = () => soundManager.playArcadeHighScore();
export const playEncounterTrigger = () => soundManager.playEncounterTrigger();

// Generic sound aliases for UI
export const playSound = (type: 'complete' | 'error' | 'pop' | 'success') => {
  switch (type) {
    case 'complete':
      return soundManager.playHabitComplete();
    case 'error':
      return soundManager.playButtonClick();
    case 'pop':
      return soundManager.playSparkle();
    case 'success':
      return soundManager.playMissionComplete();
  }
};
