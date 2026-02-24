import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useEpicTemplates, EpicTemplate } from "@/hooks/useEpicTemplates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StarPathsInfoTooltip } from "./StarPathsInfoTooltip";
import { Target, Clock, Users, Sparkles, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarPathsBrowserProps {
  onSelectTemplate: (template: EpicTemplate) => void;
}

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Beginner', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  intermediate: { label: 'Intermediate', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  advanced: { label: 'Advanced', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const THEME_COLORS: Record<string, string> = {
  heroic: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  warrior: 'from-orange-500/20 to-red-600/10 border-orange-500/30',
  mystic: 'from-blue-500/20 to-indigo-600/10 border-blue-500/30',
  nature: 'from-green-500/20 to-emerald-600/10 border-green-500/30',
  solar: 'from-yellow-500/20 to-amber-600/10 border-yellow-500/30',
};

export const StarPathsBrowser = ({ onSelectTemplate }: StarPathsBrowserProps) => {
  const { templates, featuredTemplates, isLoading, incrementPopularity } = useEpicTemplates();
  const [filter, setFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');

  const filteredTemplates = filter === 'all' 
    ? templates 
    : templates.filter(t => t.difficulty_tier === filter);

  const handleSelectTemplate = (template: EpicTemplate) => {
    incrementPopularity.mutate(template.id);
    onSelectTemplate(template);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Featured Star Paths */}
      {featuredTemplates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold">Featured Star Paths</h3>
            <StarPathsInfoTooltip />
          </div>
          <div className="grid gap-3">
            {featuredTemplates.slice(0, 3).map((template) => (
              <StarPathCard 
                key={template.id} 
                template={template} 
                onSelect={handleSelectTemplate}
                featured
              />
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="beginner">Beginner</TabsTrigger>
          <TabsTrigger value="intermediate">Medium</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* All Star Paths */}
      <div className="grid gap-3">
        {filteredTemplates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <StarPathCard 
              template={template} 
              onSelect={handleSelectTemplate}
            />
          </motion.div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No star paths found for this difficulty</p>
        </div>
      )}
    </div>
  );
};

interface StarPathCardProps {
  template: EpicTemplate;
  onSelect: (template: EpicTemplate) => void;
  featured?: boolean;
}

const StarPathCard = ({ template, onSelect, featured }: StarPathCardProps) => {
  const difficultyConfig = DIFFICULTY_CONFIG[template.difficulty_tier];
  const themeGradient = THEME_COLORS[template.theme_color] || THEME_COLORS.heroic;
  const displayedHabits = template.habits;

  // Track touch start position to differentiate tap from scroll
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const moveThreshold = 10; // pixels

  const handleSelect = useCallback(() => {
    onSelect(template);
  }, [onSelect, template]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = Math.abs(endX - touchStartRef.current.x);
    const deltaY = Math.abs(endY - touchStartRef.current.y);

    // Only trigger selection if finger didn't move much (it was a tap, not a scroll)
    if (deltaX < moveThreshold && deltaY < moveThreshold) {
      e.preventDefault();
      handleSelect();
    }

    touchStartRef.current = null;
  }, [handleSelect]);

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all sm:hover:scale-[1.02] hover:shadow-lg border select-none active:scale-[0.98]",
        `bg-gradient-to-r ${themeGradient}`,
        featured && "ring-2 ring-primary/50"
      )}
      onClick={handleSelect}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{template.badge_icon}</span>
              <h4 className="font-semibold truncate">{template.name}</h4>
              {featured && (
                <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {template.description}
            </p>
            
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={difficultyConfig.color}>
                {difficultyConfig.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {template.target_days} days
              </Badge>
              {template.popularity_count > 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  <Users className="h-3 w-3 mr-1" />
                  {template.popularity_count}
                </Badge>
              )}
            </div>
            
            {/* Habits Preview */}
            {displayedHabits.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-2">
                  Habits included ({displayedHabits.length}):
                </p>
                <div className="space-y-1.5">
                  {displayedHabits.map((habit, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        habit.difficulty === 'easy' && "bg-green-500",
                        habit.difficulty === 'medium' && "bg-yellow-500",
                        habit.difficulty === 'hard' && "bg-red-500",
                        !habit.difficulty && "bg-muted-foreground"
                      )} />
                      <span className="truncate">{habit.title}</span>
                      <span className="text-muted-foreground/70 flex-shrink-0">({habit.frequency})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
};
