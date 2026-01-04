import { useState, useEffect, memo } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Volume2, VolumeX, Sparkles } from "lucide-react";
import { soundManager } from "@/utils/soundEffects";
import { globalAudio } from "@/utils/globalAudio";

export const SoundSettings = memo(() => {
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isGloballyMuted, setIsGloballyMuted] = useState(globalAudio.getMuted());

  useEffect(() => {
    const savedVolume = safeLocalStorage.getItem('sound_volume');
    const savedMuted = safeLocalStorage.getItem('sound_muted');
    
    if (savedVolume) {
      const parsed = parseFloat(savedVolume);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        setVolume(parsed);
      }
    }
    if (savedMuted) setIsMuted(savedMuted === 'true');
    
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

  const handleGlobalMuteToggle = () => {
    const newMuted = globalAudio.toggleMute();
    setIsGloballyMuted(newMuted);
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
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
              Mutes everything: sound effects and pep talks
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
      </div>
    </Card>
  );
});
SoundSettings.displayName = 'SoundSettings';
