import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AstrologyTermTooltipProps {
  term: 'sun' | 'moon' | 'rising' | 'mercury' | 'mars' | 'venus';
  children: ReactNode;
  sign?: string;
}

const TERM_DEFINITIONS = {
  sun: {
    definition: "Your Sun sign is your core identity - who you are at your essence, your ego, and your life force. It represents your conscious mind and primary motivations.",
    hasDeepDive: true,
  },
  moon: {
    definition: "Your Moon sign reveals your emotional inner world - how you feel, process emotions, and find comfort. It's your subconscious self and emotional needs.",
    hasDeepDive: true,
  },
  rising: {
    definition: "Your Rising sign (also called Ascendant) is how others first perceive you - your outer mask, first impressions, and how you approach the world.",
    hasDeepDive: true,
  },
  mercury: {
    definition: "Mercury governs your mind and communication - how you think, learn, process information, and express ideas. It's your mental style.",
    hasDeepDive: true,
  },
  mars: {
    definition: "Mars represents your drive, energy, and action - how you assert yourself, pursue goals, handle conflict, and channel physical energy.",
    hasDeepDive: true,
  },
  venus: {
    definition: "Venus rules your values, love, and connection - what you find beautiful, how you relate to others, what brings you pleasure, and your social style.",
    hasDeepDive: true,
  },
};

export const AstrologyTermTooltip = ({ term, children, sign }: AstrologyTermTooltipProps) => {
  const navigate = useNavigate();
  const definition = TERM_DEFINITIONS[term];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-purple-400/50 hover:border-purple-400 transition-colors">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          className="max-w-xs bg-gray-900/95 border-purple-500/30 backdrop-blur-xl p-4"
          side="top"
        >
          <p className="text-xs text-gray-300 leading-relaxed mb-2">
            {definition.definition}
          </p>
          {definition.hasDeepDive && sign && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/cosmic/${term}/${sign.toLowerCase()}`)}
              className="h-7 text-xs text-purple-300 hover:text-white hover:bg-purple-900/30 w-full"
            >
              Learn More →
            </Button>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
