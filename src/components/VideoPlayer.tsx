import { Play, Pause } from "lucide-react";
import { useState, useRef } from "react";

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  className?: string;
}

export const VideoPlayer = ({ videoUrl, thumbnailUrl, className = "" }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className={`relative rounded-3xl overflow-hidden shadow-elegant ${className}`}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        className="w-full aspect-video object-cover"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        controls
      />
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-all group"
        >
          <div className="bg-white/90 rounded-full p-4 group-hover:scale-110 transition-transform shadow-soft">
            <Play className="h-8 w-8 text-blush-rose" fill="currentColor" />
          </div>
        </button>
      )}
    </div>
  );
};
