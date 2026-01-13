import { useEffect, useState, memo } from "react";
import { loadMentorImage } from "@/utils/mentorImageLoader";

const POSITION_MAP: Record<string, string> = {
  atlas: 'center 20%',
  kai: 'center 25%',
  eli: 'center 15%', // Using Darius's position since Eli now uses Darius's image
  nova: 'center 20%',
  sienna: 'center 30%',
  lumi: 'center 20%',
  stryker: 'center 25%',
  carmen: 'center 20%',
  reign: 'center 20%',
  elizabeth: 'center 25%', // Using Solace's position
};

interface MentorAvatarProps {
  mentorSlug: string;
  mentorName: string;
  primaryColor: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
  showGlow?: boolean;
  style?: React.CSSProperties;
}

const SIZE_CLASSES = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24 md:w-32 md:h-32',
  lg: 'w-32 h-32 md:w-40 md:h-40',
  xl: 'w-48 h-48 md:w-56 md:h-56',
};

export const MentorAvatar = memo(({
  mentorSlug,
  mentorName,
  primaryColor,
  avatarUrl,
  size = 'md',
  className = '',
  showBorder = true,
  showGlow = false,
  style,
}: MentorAvatarProps) => {
  const [mentorImage, setMentorImage] = useState<string>(avatarUrl || '');
  
  // Dynamically load mentor image
  useEffect(() => {
    if (avatarUrl) {
      setMentorImage(avatarUrl);
      return;
    }
    
    const baseSlug = (mentorSlug || '').trim().toLowerCase();
    if (baseSlug) {
      loadMentorImage(baseSlug).then(setMentorImage).catch(() => {
        // Keep empty string as fallback
      });
    }
  }, [mentorSlug, avatarUrl]);

  // Normalize slug for position lookup
  const baseSlug = (mentorSlug || '').trim().toLowerCase();
  const nameSlug = (mentorName || '').trim().toLowerCase().replace(/\s+/g, '-');
  const key = baseSlug || nameSlug;
  const imagePosition = POSITION_MAP[key] || 'center 25%';
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div
      className={`relative ${SIZE_CLASSES[size]} rounded-full overflow-hidden ${className}`}
      style={{
        ...style,
        border: showBorder ? `4px solid ${primaryColor}` : undefined,
        boxShadow: style?.boxShadow || (showGlow 
          ? `0 0 40px ${primaryColor}60`
          : showBorder 
          ? `0 0 20px ${primaryColor}40`
          : undefined)
      }}
    >
      {mentorImage ? (
        <img
          src={mentorImage}
          alt={mentorName}
          className="w-full h-full object-cover"
          style={{ objectPosition: imagePosition }}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-pure-white text-4xl font-black"
          style={{ backgroundColor: primaryColor }}
        >
          {getInitials(mentorName)}
        </div>
      )}
    </div>
  );
});
