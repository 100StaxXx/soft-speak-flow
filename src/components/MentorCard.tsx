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
      className={`p-6 transition-all duration-300 cursor-pointer hover:shadow-medium ${
        selected 
          ? 'bg-gradient-to-br from-primary/10 to-accent/10 border-primary shadow-glow' 
          : 'bg-card hover:bg-muted/30'
      }`}
      onClick={() => onSelect(mentor.id)}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Avatar */}
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-heading ${
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}>
          {mentor.name.charAt(0)}
        </div>

        {/* Name */}
        <h3 className="font-heading text-2xl text-foreground">
          {mentor.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {mentor.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 justify-center">
          {mentor.tags.slice(0, 3).map((tag) => (
            <Badge 
              key={tag} 
              variant="secondary"
              className="text-xs rounded-full"
            >
              {tag}
            </Badge>
          ))}
        </div>

        {/* Voice Style */}
        <p className="text-xs text-muted-foreground italic">
          Voice: {mentor.voice_style}
        </p>

        {/* Select Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(mentor.id);
          }}
          variant={selected ? "default" : "outline"}
          className="w-full rounded-full"
        >
          {selected ? "Selected" : "Choose Mentor"}
        </Button>
      </div>
    </Card>
  );
};
