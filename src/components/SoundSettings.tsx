import { useState, useEffect } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Volume2, VolumeX, Music, Sparkles, Swords } from "lucide-react";
import { soundManager } from "@/utils/soundEffects";
import { globalAudio } from "@/utils/globalAudio";

export const SoundSettings = () => {
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.15);
  const [bgMusicMuted, setBgMusicMuted] = useState(false);
  const [encounterMusicVolume, setEncounterMusicVolume] = useState(0.4);
  const [isGloballyMuted, setIsGloballyMuted] = useState(globalAudio.getMuted());

  useEffect(() => {
    const savedVolume = safeLocalStorage.getItem('sound_volume');
    const savedMuted = safeLocalStorage.getItem('sound_muted');
    const savedBgVolume = safeLocalStorage.getItem('bg_music_volume');
    const savedBgMuted = safeLocalStorage.getItem('bg_music_muted');
    const savedEncounterVolume = safeLocalStorage.getItem('encounter_music_volume');
    
    if (savedVolume) {
      const parsed = parseFloat(savedVolume);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        setVolume(parsed);
      }
    }
    if (savedMuted) setIsMuted(savedMuted === 'true');
    if (savedBgVolume) {
      const parsed = parseFloat(savedBgVolume);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        setBgMusicVolume(parsed);
      }
    }
    if (savedBgMuted) setBgMusicMuted(savedBgMuted === 'true');
    if (savedEncounterVolume) {
      const parsed = parseFloat(savedEncounterVolume);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        setEncounterMusicVolume(parsed);
      }
    }
    
    // Subscribe to global mute changes
    const unsubscribe = globalAudio.subscribe((muted) => {
      setIsGloballyMuted(muted);
    });
    
    return unsubscribe;
  }, []);

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setVolume(newVolume);
    soundManager.setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleBgMusicVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setBgMusicVolume(newVolume);
    safeLocalStorage.setItem('bg_music_volume', newVolume.toString());
    window.dispatchEvent(new CustomEvent('bg-music-volume-change', { detail: newVolume }));
  };

  const handleBgMusicMuteToggle = () => {
    const newMuted = !bgMusicMuted;
    setBgMusicMuted(newMuted);
    safeLocalStorage.setItem('bg_music_muted', newMuted.toString());
    window.dispatchEvent(new CustomEvent('bg-music-mute-change', { detail: newMuted }));
  };

  const handleEncounterMusicVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setEncounterMusicVolume(newVolume);
    safeLocalStorage.setItem('encounter_music_volume', newVolume.toString());
    window.dispatchEvent(new CustomEvent('encounter-music-volume-change', { detail: newVolume }));
  };

  const handleGlobalMuteToggle = () => {
    const newMuted = globalAudio.toggleMute();
    setIsGloballyMuted(newMuted);
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Music className="w-5 h-5" />
          Sound Settings
        </h3>
        <p className="text-sm text-muted-foreground">
          Customize your audio experience
        </p>
      </div>

      <div className="space-y-4">
        {/* Global Mute Toggle - Controls ALL audio */}
        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="space-y-0.5">
            <Label htmlFor="global-mute" className="flex items-center gap-2 text-base font-medium">
              {isGloballyMuted ? <VolumeX className="w-5 h-5 text-destructive" /> : <Volume2 className="w-5 h-5 text-primary" />}
              Mute All Audio
            </Label>
            <p className="text-xs text-muted-foreground">
              Mutes everything: music, sound effects, and pep talks
            </p>
          </div>
          <Switch
            id="global-mute"
            checked={isGloballyMuted}
            onCheckedChange={handleGlobalMuteToggle}
          />
        </div>

        {/* Sound Effects Volume */}
        <div className={`space-y-3 transition-opacity ${isGloballyMuted ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              Sound Effects Volume
            </Label>
            <span className="text-sm text-muted-foreground">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <Slider
            value={[volume]}
            onValueChange={handleVolumeChange}
            max={1}
            step={0.1}
            disabled={isMuted || isGloballyMuted}
            className="w-full"
          />
        </div>

        {/* Sound Effects Mute Toggle */}
        <div className={`flex items-center justify-between py-2 transition-opacity ${isGloballyMuted ? 'opacity-50 pointer-events-none' : ''}`}>
          <Label htmlFor="mute">Mute Sound Effects</Label>
          <Switch
            id="mute"
            checked={isMuted}
            onCheckedChange={handleMuteToggle}
            disabled={isGloballyMuted}
          />
        </div>

        {/* Background Music Section */}
        <div className={`pt-6 mt-6 border-t space-y-4 transition-opacity ${isGloballyMuted ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Music className="w-4 h-4 text-primary" />
              Ambient Music
            </h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                {bgMusicMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                Music Volume
              </Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(bgMusicVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[bgMusicVolume]}
              onValueChange={handleBgMusicVolumeChange}
              max={0.4}
              step={0.01}
              disabled={bgMusicMuted || isGloballyMuted}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 10-20% for subtle background ambience
            </p>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="bg-mute">Mute Ambient Music</Label>
              <p className="text-xs text-muted-foreground">
                Turn off background music while keeping sound effects
              </p>
            </div>
            <Switch
              id="bg-mute"
              checked={bgMusicMuted}
              onCheckedChange={handleBgMusicMuteToggle}
              disabled={isGloballyMuted}
            />
          </div>
        </div>

        {/* Encounter/Arcade Music Section */}
        <div className={`pt-6 mt-6 border-t space-y-4 transition-opacity ${isGloballyMuted ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              Battle & Arcade Music
            </h4>
            <p className="text-xs text-muted-foreground">
              Music during encounters and arcade games
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Volume
              </Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(encounterMusicVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[encounterMusicVolume]}
              onValueChange={handleEncounterMusicVolumeChange}
              max={1}
              step={0.05}
              disabled={isGloballyMuted}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
