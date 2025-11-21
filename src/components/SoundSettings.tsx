import { useState, useEffect } from "react";
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
  const [bgMusicVolume, setBgMusicVolume] = useState(0.025);
  const [bgMusicMuted, setBgMusicMuted] = useState(false);

  useEffect(() => {
    const savedVolume = localStorage.getItem('sound_volume');
    const savedMuted = localStorage.getItem('sound_muted');
    const savedBgVolume = localStorage.getItem('bg_music_volume');
    const savedBgMuted = localStorage.getItem('bg_music_muted');
    
    if (savedVolume) setVolume(parseFloat(savedVolume));
    if (savedMuted) setIsMuted(savedMuted === 'true');
    if (savedBgVolume) setBgMusicVolume(parseFloat(savedBgVolume));
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
    localStorage.setItem('bg_music_volume', newVolume.toString());
    window.dispatchEvent(new CustomEvent('bg-music-volume-change', { detail: newVolume }));
  };

  const handleBgMusicMuteToggle = () => {
    const newMuted = !bgMusicMuted;
    setBgMusicMuted(newMuted);
    localStorage.setItem('bg_music_muted', newMuted.toString());
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

        {/* Sound Test Buttons */}
        <div className="pt-4 space-y-3">
          <Label className="text-sm font-medium">Test Sounds</Label>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testSound(() => soundManager.playEvolutionSuccess())}
              className="justify-start"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Evolution
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => testSound(() => soundManager.playHabitComplete())}
              className="justify-start"
            >
              <span className="mr-2">✓</span>
              Habit Complete
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => testSound(() => soundManager.playXPGain())}
              className="justify-start"
            >
              <span className="mr-2">⚡</span>
              XP Gain
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => testSound(() => soundManager.playAchievementUnlock())}
              className="justify-start"
            >
              <span className="mr-2">🏆</span>
              Achievement
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => testSound(() => soundManager.playNotification())}
              className="justify-start"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notification
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => testSound(() => soundManager.playStreakMilestone())}
              className="justify-start"
            >
              <span className="mr-2">🔥</span>
              Streak
            </Button>
          </div>
        </div>

        {/* Background Music Section */}
        <div className="pt-6 mt-6 border-t space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Music className="w-4 h-4 text-primary" />
              Ambient Music
            </h4>
            <p className="text-xs text-muted-foreground">
              Calming background music creates a relaxing, immersive experience throughout the app
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
              max={1}
              step={0.05}
              disabled={bgMusicMuted}
              className="w-full"
            />
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
