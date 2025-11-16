import { useActivityFeed } from "@/hooks/useActivityFeed";
import { Card } from "@/components/ui/card";
import { CheckCircle, MessageSquare, Heart, Target, Calendar, Volume2, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "./ui/button";
import { useState } from "react";
import { useWelcomeMessage } from "@/hooks/useWelcomeMessage";

const activityIcons: Record<string, any> = {
  welcome: Sparkles,
  habit_completed: CheckCircle,
  mood_logged: Heart,
  pep_talk_listened: Volume2,
  chat_message: MessageSquare,
  reflection_completed: Calendar,
  goal_set: Target,
};

const activityLabels: Record<string, string> = {
  welcome: "joined the journey",
  habit_completed: "completed a habit",
  mood_logged: "logged your mood",
  pep_talk_listened: "listened to pep talk",
  chat_message: "chatted with mentor",
  reflection_completed: "completed reflection",
  goal_set: "set a goal",
};

export const ActivityTimeline = () => {
  const { activities, isLoading, markAsRead } = useActivityFeed();
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  
  // Add welcome message for new users
  useWelcomeMessage();

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!activities.length) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Your journey starts now. Take your first step.</p>
      </Card>
    );
  }

  const handlePlayVoice = (url: string, activityId: string) => {
    if (playingAudio === activityId) {
      setPlayingAudio(null);
      return;
    }
    
    const audio = new Audio(url);
    audio.play();
    setPlayingAudio(activityId);
    audio.onended = () => setPlayingAudio(null);
    markAsRead(activityId);
  };

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.activity_type] || MessageSquare;
        const label = activityLabels[activity.activity_type] || activity.activity_type;
        
        return (
          <Card 
            key={activity.id} 
            className={`p-4 transition-all ${!activity.is_read ? 'border-primary shadow-glow' : ''}`}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    You {label}
                    {activity.activity_data?.habit_title && (
                      <span className="font-semibold text-foreground"> • {activity.activity_data.habit_title}</span>
                    )}
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </span>
                </div>
                
                {activity.mentor_comment && (
                  <div className="bg-secondary/30 rounded-lg p-3 border-l-2 border-primary">
                    <p className="text-sm italic text-foreground">{activity.mentor_comment}</p>
                  </div>
                )}

                {activity.mentor_voice_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => handlePlayVoice(activity.mentor_voice_url!, activity.id)}
                  >
                    <Volume2 className={`h-3 w-3 mr-1 ${playingAudio === activity.id ? 'animate-pulse' : ''}`} />
                    <span className="text-xs">
                      {playingAudio === activity.id ? 'Playing...' : 'Listen'}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
