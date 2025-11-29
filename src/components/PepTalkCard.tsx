import { Heart, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ShareButton } from "@/components/ShareButton";
import { useNavigate } from "react-router-dom";
import { memo } from "react";
import { getRedirectUrl } from '@/utils/redirectUrl';

interface PepTalkCardProps {
  id: string;
  title: string;
  category: string;
  topicCategories?: string[];
  description?: string;
  quote?: string;
  isPremium?: boolean;
  onClick?: () => void;
  emotionalTriggers?: string[];
  highlightedTriggers?: string[];
}

export const PepTalkCard = memo(({ id, title, category, topicCategories, description, quote, isPremium, onClick, emotionalTriggers, highlightedTriggers }: PepTalkCardProps) => {
  const navigate = useNavigate();

  // Combine category and topic_categories, remove duplicates
  const allCategories = Array.from(new Set([
    category,
    ...(topicCategories || [])
  ].filter(Boolean)));

  // Check if this pep talk has any of the highlighted triggers
  const hasHighlightedTrigger = highlightedTriggers && highlightedTriggers.length > 0 && 
    emotionalTriggers?.some(trigger => highlightedTriggers.includes(trigger));

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/pep-talk/${id}`);
    }
  };
  return (
    <Card
      onClick={handleClick}
      className={`p-5 cursor-pointer hover:shadow-glow transition-all duration-300 bg-graphite border-2 ${
        hasHighlightedTrigger ? 'border-royal-gold shadow-glow' : 'border-steel/20'
      } hover:border-royal-gold rounded-lg relative`}
    >
      {isPremium && (
        <div className="absolute top-4 right-12">
          <span className="bg-royal-gold text-obsidian text-xs font-black px-3 py-1 rounded inline-flex items-center gap-1 uppercase tracking-wide">
            <Crown className="h-3 w-3" />
            Pro
          </span>
        </div>
      )}
      <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
        <ShareButton
          title={title}
          text={`${title} - ${description || quote || ''}`}
          url={`${getRedirectUrl()}/pep-talk/${id}`}
        />
      </div>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          hasHighlightedTrigger ? 'bg-royal-gold animate-pulse' : 'bg-royal-gold'
        }`}>
          <Heart className="h-5 w-5 text-obsidian" fill="currentColor" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {allCategories.map((cat, index) => (
              <span key={index} className="text-xs font-bold text-royal-gold uppercase tracking-wider">
                {cat}
              </span>
            ))}
            {hasHighlightedTrigger && (
              <span className="text-xs font-bold text-royal-gold uppercase tracking-wider animate-pulse">
                ✨ Match
              </span>
            )}
          </div>
          <h3 className="font-heading text-base md:text-lg font-black text-pure-white mb-2 line-clamp-2 uppercase tracking-tight break-words">
            {title}
          </h3>
          <p className="text-sm text-steel line-clamp-2 break-words">
            {description || quote || ""}
          </p>
        </div>
      </div>
    </Card>
  );
});
