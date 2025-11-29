import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { memo } from "react";

interface Mentor {
  id: string;
  name: string;
  mentor_type: string;
  description: string;
  tags: string[];
  voice_style: string;
  avatar_url?: string;
  slug?: string;
}

interface MentorCardProps {
  mentor: Mentor;
  selected?: boolean;
  onSelect: (mentorId: string) => void;
}

// Map mentor slugs to personality colors
const mentorBackgrounds: Record<string, string> = {
  'kai': 'bg-gradient-to-br from-[hsl(var(--mentor-warmth))]/10 to-[hsl(var(--mentor-warmth))]/5',
  'stryker': 'bg-gradient-to-br from-[hsl(var(--mentor-discipline))]/10 to-[hsl(var(--mentor-discipline))]/5',
  'nova': 'bg-gradient-to-br from-[hsl(var(--mentor-energy))]/10 to-[hsl(var(--mentor-energy))]/5',
  'lumi': 'bg-gradient-to-br from-[hsl(var(--mentor-calm))]/10 to-[hsl(var(--mentor-calm))]/5',
  'solace': 'bg-gradient-to-br from-[hsl(var(--mentor-serene))]/10 to-[hsl(var(--mentor-serene))]/5',
  'sienna': 'bg-gradient-to-br from-[hsl(var(--mentor-gentle))]/10 to-[hsl(var(--mentor-gentle))]/5',
  'atlas': 'bg-gradient-to-br from-[hsl(var(--mentor-wisdom))]/10 to-[hsl(var(--mentor-wisdom))]/5',
  'eli': 'bg-gradient-to-br from-[hsl(var(--mentor-bold))]/10 to-[hsl(var(--mentor-bold))]/5',
  'darius': 'bg-gradient-to-br from-[hsl(var(--mentor-fierce))]/10 to-[hsl(var(--mentor-fierce))]/5',
};

export const MentorCard = memo(({ mentor, selected, onSelect }: MentorCardProps) => {
  const personalityBg = mentorBackgrounds[mentor.slug || ''] || 'bg-card';
  
  return (
    <Card 
      className={`p-6 md:p-7 transition-all duration-300 cursor-pointer hover:shadow-glow overflow-hidden relative group ${personalityBg} ${
        selected 
          ? 'border-primary border-2 shadow-glow' 
          : 'border-border hover:border-primary/30'
      }`}
      onClick={() => onSelect(mentor.id)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex flex-col items-center text-center space-y-5 relative z-10">
        {/* Avatar */}
        <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-3xl md:text-4xl font-heading transition-all ${
          selected ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-muted text-muted-foreground group-hover:bg-primary/10'
        }`}>
          {mentor.name.charAt(0)}
        </div>

        {/* Name */}
        <h3 className="font-heading text-lg md:text-xl font-black text-pure-white leading-tight break-words relative z-10">
          {mentor.name}
        </h3>

        {/* Description */}
        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-3 break-words">
          {mentor.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 justify-center">
          {mentor.tags.slice(0, 3).map((tag) => (
            <Badge 
              key={tag} 
              variant="secondary"
              className="text-[10px] md:text-xs rounded-full px-2 py-0.5 font-bold uppercase"
            >
              {tag}
            </Badge>
          ))}
        </div>

        {/* Voice Style */}
        <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
          Voice: <span className="text-primary">{mentor.voice_style}</span>
        </p>

        {/* Select Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(mentor.id);
          }}
          variant={selected ? "default" : "outline"}
          className="w-full rounded-full font-bold uppercase text-xs md:text-sm"
        >
          {selected ? "✓ Selected" : "Choose Motivator"}
        </Button>
      </div>
    </Card>
  );
});
