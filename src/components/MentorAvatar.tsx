import { useEffect, useState, memo } from "react";
import {
  DEFAULT_MENTOR_AVATAR_POSITION,
  MENTOR_AVATAR_POSITION_MAP,
  resolveMentorSlugAlias,
} from "@/lib/mentorRoster";
import { loadMentorImage } from "@/utils/mentorImageLoader";

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
    
    const resolvedSlug = resolveMentorSlugAlias(mentorSlug);
    if (resolvedSlug) {
      loadMentorImage(resolvedSlug).then(setMentorImage).catch(() => {
        // Keep empty string as fallback
      });
    }
  }, [mentorSlug, avatarUrl]);

  const resolvedSlug = resolveMentorSlugAlias(mentorSlug);
  const imagePosition = resolvedSlug
    ? MENTOR_AVATAR_POSITION_MAP[resolvedSlug]
    : DEFAULT_MENTOR_AVATAR_POSITION;
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
