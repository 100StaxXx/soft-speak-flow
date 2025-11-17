import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";

export const BackgroundMusic = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const savedVolume = localStorage.getItem('bg_music_volume');
    const savedMuted = localStorage.getItem('bg_music_muted');
    const savedPlaying = localStorage.getItem('bg_music_playing');
    
    if (savedVolume) setVolume(parseFloat(savedVolume));
    if (savedMuted) setIsMuted(savedMuted === 'true');
    if (savedPlaying !== 'false') {
      setIsPlaying(true);
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = volume;
    }

    const audio = audioRef.current;

    const handleVolumeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setVolume(customEvent.detail);
    };
    
    const handleMuteChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsMuted(customEvent.detail);
    };

    window.addEventListener('bg-music-volume-change', handleVolumeChange);
    window.addEventListener('bg-music-mute-change', handleMuteChange);

    if (isPlaying && !isMuted) {
      audio.play().catch(err => {
        console.log("Audio autoplay prevented:", err);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }

    return () => {
      window.removeEventListener('bg-music-volume-change', handleVolumeChange);
      window.removeEventListener('bg-music-mute-change', handleMuteChange);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isPlaying, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
    localStorage.setItem('bg_music_volume', volume.toString());
  }, [volume, isMuted]);

  const handleVolumeChange = (values: number[]) => {
    setVolume(values[0]);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem('bg_music_muted', newMuted.toString());
  };

  const togglePlay = () => {
    const newPlaying = !isPlaying;
    setIsPlaying(newPlaying);
    localStorage.setItem('bg_music_playing', newPlaying.toString());
  };

  return (
    <div className="fixed bottom-24 right-4 z-40">
      <Card className="p-3 bg-card/95 backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={togglePlay}
          >
            {isPlaying ? "⏸️" : "▶️"}
          </Button>
          
          <div className="w-24">
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.05}
              disabled={isMuted}
              className="w-full"
            />
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleMute}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Ambient Music
        </div>
      </Card>
    </div>
  );
};
