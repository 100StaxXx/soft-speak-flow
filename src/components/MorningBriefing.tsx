import { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MentorAvatar } from "@/components/MentorAvatar";
import { useMorningBriefing } from "@/hooks/useMorningBriefing";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { 
  Sparkles, 
  Target, 
  MessageCircle, 
  Check, 
  Loader2, 
  Brain,
  TrendingUp,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface MorningBriefingProps {
  onAskMore?: (context: string, actionPrompt: string) => void;
  className?: string;
}

export const MorningBriefing = memo(({ onAskMore, className }: MorningBriefingProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const personality = useMentorPersonality();
  const { 
    briefing, 
    isLoading, 
    generateBriefing, 
    dismissBriefing,
    markViewed,
    isGenerating 
  } = useMorningBriefing();
  
  const [showFull, setShowFull] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Mark as viewed when component mounts with a briefing
  useEffect(() => {
    if (briefing && !briefing.viewed_at) {
      markViewed.mutate(briefing.id);
    }
  }, [briefing?.id]);

  // Start collapsed if already dismissed
  useEffect(() => {
    if (briefing?.dismissed_at) {
      setIsCollapsed(true);
    }
  }, [briefing?.dismissed_at]);

  const handleGenerate = async () => {
    try {
      await generateBriefing.mutateAsync();
    } catch (error) {
      console.error('Failed to generate briefing:', error);
      toast({
        title: "Couldn't prepare briefing",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async () => {
    if (!briefing) return;
    
    setIsCollapsed(true);
    try {
      await dismissBriefing.mutateAsync(briefing.id);
    } catch (error) {
      console.error('Failed to dismiss briefing:', error);
    }
  };

  const handleAskMore = () => {
    if (!briefing) return;
    
    // If parent provides handler, use it
    if (onAskMore) {
      onAskMore(briefing.content, briefing.action_prompt || '');
      return;
    }
    
    // Otherwise navigate to Ask Mentor with context
    navigate('/mentor-chat', {
      state: {
        initialMessage: briefing.action_prompt || "Let's discuss my morning briefing",
        briefingContext: briefing.content,
        comprehensiveMode: true,
      }
    });
  };

  // Collapsed state - show minimized preview that can be expanded
  if (isCollapsed && briefing) {
    return (
        <Card 
          className={cn(
            "p-4 bg-card/25 backdrop-blur-2xl border-white/[0.08] cursor-pointer hover:border-primary/20 transition-colors",
            className
          )}
        onClick={() => setIsCollapsed(false)}
      >
        <div className="flex items-center gap-3">
          {personality && (
            <MentorAvatar
              mentorSlug={(personality.slug || '').toLowerCase()}
              mentorName={personality.name}
              primaryColor={personality.primary_color || '#000'}
              avatarUrl={personality.avatar_url || undefined}
              size="sm"
              showBorder={true}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Morning Briefing</h3>
              <Check className="h-4 w-4 text-primary" />
            </div>
            {briefing.todays_focus && (
              <p className="text-xs text-muted-foreground truncate">
                Focus: {briefing.todays_focus}
              </p>
            )}
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("p-6 animate-pulse bg-card/25 backdrop-blur-2xl border-white/[0.08]", className)}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        </div>
      </Card>
    );
  }

  // No briefing yet - show generate button
  if (!briefing) {
    return (
      <div className={cn(
        "rounded-2xl bg-card/25 backdrop-blur-2xl border border-white/[0.08] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
        className
      )}>
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-white/[0.06] bg-gradient-to-r from-primary/5 to-accent/[0.02]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
              <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <h3 className="font-heading font-black text-lg sm:text-2xl tracking-wide text-primary">MORNING BRIEFING</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5">
          <div className="flex flex-col items-center gap-4">
            {personality && (
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-red-500 to-pink-500 opacity-70" />
                <MentorAvatar
                  mentorSlug={(personality.slug || '').toLowerCase()}
                  mentorName={personality.name}
                  primaryColor={personality.primary_color || '#000'}
                  avatarUrl={personality.avatar_url || undefined}
                  size="md"
                  showBorder={false}
                  className="relative"
                />
              </div>
            )}
            <div className="w-full space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Get personalized insights from {personality?.name || 'your mentor'} based on your activity
              </p>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                variant="cta"
                className="w-full h-10 sm:h-12"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing your progress...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Prepare My Briefing
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Parse inferred goals safely
  const inferredGoals: string[] = Array.isArray(briefing.inferred_goals) 
    ? briefing.inferred_goals 
    : [];

  // Show briefing
  return (
    <Card className={cn(
      "overflow-hidden bg-card/25 backdrop-blur-2xl border-white/[0.08]",
      className
    )}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-white/[0.06]">
        <div className="flex items-start gap-4">
          {personality && (
            <MentorAvatar
              mentorSlug={(personality.slug || '').toLowerCase()}
              mentorName={personality.name}
              primaryColor={personality.primary_color || '#000'}
              avatarUrl={personality.avatar_url || undefined}
              size="md"
              showBorder={true}
              className="flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-base sm:text-lg truncate">
                {personality?.name || 'Your Mentor'}'s Briefing
              </h3>
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground">
              Personalized insights for today
            </p>
          </div>
        </div>
      </div>

      {/* Inferred Goals */}
      {inferredGoals.length > 0 && (
        <div className="px-4 sm:px-6 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              What I see you working toward
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {inferredGoals.map((goal, idx) => (
              <Badge 
                key={idx} 
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20"
              >
                {goal}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 sm:p-6 space-y-4">
        <div className={cn(
          "text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap",
          !showFull && "line-clamp-4"
        )}>
          {briefing.content}
        </div>
        
        {briefing.content.length > 300 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFull(!showFull)}
            className="text-primary hover:text-primary/80 -ml-2"
          >
            {showFull ? "Show less" : "Read more"}
          </Button>
        )}

        {/* Today's Focus */}
        {briefing.todays_focus && (
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-4 border border-white/[0.08]">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Today's Focus
                </p>
                <p className="text-sm font-medium text-foreground">
                  {briefing.todays_focus}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={handleDismiss}
          className="flex-1 sm:flex-none"
        >
          <Check className="h-4 w-4 mr-2" />
          Done
        </Button>
        <Button
          onClick={handleAskMore}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Ask {personality?.name || 'Mentor'} More
        </Button>
      </div>
    </Card>
  );
});

MorningBriefing.displayName = 'MorningBriefing';
