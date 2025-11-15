import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Mentor {
  id: string;
  name: string;
  mentor_type: string;
  description: string;
  tags: string[];
  voice_style: string;
  avatar_url?: string;
}

interface MentorCardProps {
  mentor: Mentor;
  selected?: boolean;
  onSelect: (mentorId: string) => void;
}

export const MentorCard = ({ mentor, selected, onSelect }: MentorCardProps) => {
  return (
    <Card 
      className={`p-5 md:p-6 transition-all duration-300 cursor-pointer hover:shadow-glow overflow-hidden relative group ${
        selected 
          ? 'bg-gradient-to-br from-primary/10 to-accent/10 border-primary border-2 shadow-glow' 
          : 'bg-card hover:bg-secondary/50 border-border'
      }`}
      onClick={() => onSelect(mentor.id)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex flex-col items-center text-center space-y-4 relative z-10">
        {/* Avatar */}
        <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-3xl md:text-4xl font-heading transition-all ${
          selected ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-muted text-muted-foreground group-hover:bg-primary/10'
        }`}>
          {mentor.name.charAt(0)}
        </div>

        {/* Name */}
        <h3 className="font-heading text-lg md:text-xl font-black text-foreground leading-tight break-words">
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
};
