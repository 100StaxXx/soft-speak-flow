import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X } from "lucide-react";

interface Mentor {
  id: string;
  name: string;
  slug: string;
  archetype: string;
  short_title: string;
  tone_description: string;
  style_description: string;
  target_user: string;
  signature_line: string;
  primary_color: string;
  avatar_url?: string;
  themes: string[];
}

interface MentorGridProps {
  mentors: Mentor[];
  onSelectMentor: (mentorId: string) => void;
  currentMentorId?: string | null;
  isSelecting?: boolean;
}

const MENTOR_ORDER = ['atlas', 'darius', 'kai', 'eli', 'nova', 'sienna', 'lumi', 'stryker', 'solace'];

export const MentorGrid = ({ mentors, onSelectMentor, currentMentorId, isSelecting = false }: MentorGridProps) => {
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);

  const orderedMentors = MENTOR_ORDER.map(slug => 
    mentors.find(m => m.slug === slug)
  ).filter(Boolean) as Mentor[];

  const handleMentorClick = (mentorId: string) => {
    setExpandedMentor(expandedMentor === mentorId ? null : mentorId);
  };

  const selectedMentor = orderedMentors.find(m => m.id === expandedMentor);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getBulletPoints = (mentor: Mentor) => {
    const points = [];
    if (mentor.tone_description) {
      const tone = mentor.tone_description.split(',')[0];
      points.push(tone.trim());
    }
    if (mentor.style_description) {
      const style = mentor.style_description.split('.')[0];
      points.push(style.trim());
    }
    if (mentor.themes && mentor.themes.length > 0) {
      points.push(`Focus: ${mentor.themes.slice(0, 2).join(', ')}`);
    }
    return points.slice(0, 3);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 animate-fade-in">
      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-8 md:gap-12">
        {orderedMentors.map((mentor) => (
          <div
            key={mentor.id}
            className="flex flex-col items-center space-y-3 cursor-pointer group"
            onClick={() => handleMentorClick(mentor.id)}
          >
            {/* Avatar Circle */}
            <div className="relative">
              {currentMentorId === mentor.id && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-royal-gold whitespace-nowrap">
                  Current
                </div>
              )}
              <div
                className={`
                  relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden
                  transition-all duration-300
                  ${expandedMentor === mentor.id 
                    ? 'scale-110' 
                    : 'group-hover:scale-105'
                  }
                `}
                style={{ 
                  border: expandedMentor === mentor.id 
                    ? '4px solid #CDAA7D' 
                    : `2px solid ${mentor.primary_color}`,
                  boxShadow: expandedMentor === mentor.id 
                    ? `0 0 30px ${mentor.primary_color}80` 
                    : 'none'
                }}
              >
                {mentor.avatar_url ? (
                  <img 
                    src={mentor.avatar_url} 
                    alt={mentor.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center text-pure-white text-2xl font-black"
                    style={{ backgroundColor: mentor.primary_color }}
                  >
                    {getInitials(mentor.name)}
                  </div>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="text-center space-y-1">
              <h3 className="text-pure-white font-bold text-lg md:text-xl">
                {mentor.name}
              </h3>
              <p className="text-steel text-xs md:text-sm" style={{ color: mentor.primary_color }}>
                {mentor.short_title}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Card */}
      {selectedMentor && (
        <Card className="border-2 border-charcoal bg-midnight/95 backdrop-blur-sm animate-fade-in">
          <CardContent className="p-8 md:p-12 space-y-8">
            {/* Close Button */}
            <button
              onClick={() => setExpandedMentor(null)}
              className="absolute top-4 right-4 text-steel hover:text-pure-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Header */}
            <div className="space-y-3 text-center">
              <h2 className="text-4xl md:text-5xl font-black text-pure-white uppercase tracking-tight">
                {selectedMentor.name}
              </h2>
              <p className="text-xl text-royal-gold font-bold">
                {selectedMentor.short_title}
              </p>
              <p className="text-sm text-steel italic">
                {selectedMentor.archetype}
              </p>
            </div>

            {/* Characteristics */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-pure-white">Key Characteristics</h3>
              <ul className="space-y-3">
                {getBulletPoints(selectedMentor).map((point, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-steel">
                    <div 
                      className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                      style={{ backgroundColor: selectedMentor.primary_color }}
                    />
                    <span className="text-base">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Best For */}
            <div className="space-y-3 p-6 bg-charcoal/50 rounded-lg border border-steel/20">
              <h3 className="text-sm font-bold text-royal-gold uppercase tracking-wide">
                Best if you're feeling...
              </h3>
              <p className="text-steel text-base leading-relaxed">
                {selectedMentor.target_user}
              </p>
            </div>

            {/* Signature Line */}
            <div className="space-y-3 border-l-4 pl-6" style={{ borderColor: selectedMentor.primary_color }}>
              <h3 className="text-sm font-bold text-steel uppercase tracking-wide">
                How they sound
              </h3>
              <p className="text-pure-white text-lg italic leading-relaxed">
                "{selectedMentor.signature_line}"
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row gap-4 pt-6">
              <Button
                onClick={() => onSelectMentor(selectedMentor.id)}
                disabled={isSelecting}
                className="flex-1 h-14 text-lg font-black uppercase tracking-wider bg-royal-gold hover:bg-royal-gold/90 text-obsidian"
              >
                {isSelecting ? (
                  <>Selecting...</>
                ) : currentMentorId === selectedMentor.id ? (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Confirm {selectedMentor.name}
                  </>
                ) : (
                  <>Choose {selectedMentor.name}</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setExpandedMentor(null)}
                className="md:w-48 h-14 border-steel/50 text-pure-white hover:bg-charcoal/50"
              >
                View Others
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
