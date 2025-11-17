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

  useEffect(() => {
    const savedVolume = localStorage.getItem('sound_volume');
    const savedMuted = localStorage.getItem('sound_muted');
    
    if (savedVolume) setVolume(parseFloat(savedVolume));
    if (savedMuted) setIsMuted(savedMuted === 'true');
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
      </div>
    </Card>
  );
};
