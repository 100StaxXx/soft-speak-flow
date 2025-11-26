import { useState, useEffect } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Music, Bell, Sparkles } from "lucide-react";
import { soundManager } from "@/utils/soundEffects";

export const SoundSettings = () => {
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.15);
  const [bgMusicMuted, setBgMusicMuted] = useState(false);

  useEffect(() => {
    const savedVolume = safeLocalStorage.getItem('sound_volume');
    const savedMuted = safeLocalStorage.getItem('sound_muted');
    const savedBgVolume = safeLocalStorage.getItem('bg_music_volume');
    const savedBgMuted = safeLocalStorage.getItem('bg_music_muted');
    
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

  const testSound = (soundFn: () => void) => {
    soundFn();
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
        {/* Master Volume */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              Master Volume
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
            disabled={isMuted}
            className="w-full"
          />
        </div>

        {/* Mute Toggle */}
        <div className="flex items-center justify-between py-2">
          <Label htmlFor="mute">Mute All Sounds</Label>
          <Switch
            id="mute"
            checked={isMuted}
            onCheckedChange={handleMuteToggle}
          />
        </div>

        {/* Background Music Section */}
        <div className="pt-6 mt-6 border-t space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Music className="w-4 h-4 text-primary" />
              Ambient Music
            </h4>
            <p className="text-xs text-muted-foreground">
              Calming background music plays continuously in the background, like MTG Arena and Pokémon TCG. It automatically ducks when other audio plays.
            </p>
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
              disabled={bgMusicMuted}
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
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
