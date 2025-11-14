import { Heart } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PepTalkCardProps {
  title: string;
  category: string;
  description: string;
  onClick: () => void;
}

export const PepTalkCard = ({ title, category, description, onClick }: PepTalkCardProps) => {
  return (
    <Card
      onClick={onClick}
      className="p-5 cursor-pointer hover:shadow-medium transition-all duration-300 bg-card border-border rounded-3xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blush-rose to-petal-pink flex items-center justify-center">
          <Heart className="h-5 w-5 text-warm-charcoal" fill="currentColor" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {category}
            </span>
          </div>
          <h3 className="font-heading text-lg font-semibold text-foreground mb-2 line-clamp-1">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
};
