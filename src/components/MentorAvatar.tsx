import { useEffect, useState, memo } from "react";
import {
  DEFAULT_MENTOR_AVATAR_POSITION,
  MENTOR_AVATAR_POSITION_MAP,
  resolveMentorSlugAlias,
} from "@/lib/mentorRoster";
import {
  getDirectMentorAvatarUrl,
  loadMentorImage,
  resolveMentorImageSource,
} from "@/utils/mentorImageLoader";

interface MentorAvatarProps {
  mentorSlug: string;
  mentorName: string;
  primaryColor: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
  showGlow?: boolean;
  style?: React.CSSProperties;
}

const SIZE_CLASSES = {
  xs: 'w-10 h-10',
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
  const [mentorImage, setMentorImage] = useState<string>(
    () => getDirectMentorAvatarUrl(mentorSlug, avatarUrl) ?? '',
  );
  const resolvedSlug = resolveMentorSlugAlias(mentorSlug);
  
  // Dynamically load mentor image
  useEffect(() => {
    const directAvatarUrl = getDirectMentorAvatarUrl(mentorSlug, avatarUrl);
    if (directAvatarUrl) {
      setMentorImage(directAvatarUrl);
      return;
    }

    let cancelled = false;

    resolveMentorImageSource(mentorSlug, avatarUrl)
      .then((imageUrl) => {
        if (!cancelled) {
          setMentorImage(imageUrl || '');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMentorImage('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mentorSlug, avatarUrl]);

  const imagePosition = resolvedSlug
    ? MENTOR_AVATAR_POSITION_MAP[resolvedSlug]
    : DEFAULT_MENTOR_AVATAR_POSITION;
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();
  const handleImageError = () => {
    if (!resolvedSlug || !mentorImage) {
      setMentorImage('');
      return;
    }

    loadMentorImage(resolvedSlug)
      .then((fallbackImage) => {
        setMentorImage(fallbackImage && fallbackImage !== mentorImage ? fallbackImage : '');
      })
      .catch(() => {
        setMentorImage('');
      });
  };

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
          onError={handleImageError}
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
