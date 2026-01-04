import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Bell, Sparkles, Target, TrendingUp, MessageCircle } from "lucide-react";

interface NotificationExample {
  icon: typeof Bell;
  title: string;
  message: string;
  time: string;
  color: string;
}

const exampleNotifications: NotificationExample[] = [
  {
    icon: Sparkles,
    title: "Daily Pep Talk",
    message: "Your mentor has a new message: 'Remember, you're capable of more than you think.'",
    time: "8:00 AM",
    color: "text-purple-400"
  },
  {
    icon: Target,
    title: "Daily Mission",
    message: "New challenge unlocked: Complete 3 habits today for bonus XP!",
    time: "9:00 AM",
    color: "text-blue-400"
  },
  {
    icon: TrendingUp,
    title: "Streak Milestone",
    message: "🔥 You're on fire! 7 day streak achieved!",
    time: "6:00 PM",
    color: "text-orange-400"
  },
  {
    icon: MessageCircle,
    title: "Motivational Quote",
    message: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    time: "12:00 PM",
    color: "text-emerald-400"
  }
];

export const NotificationPreview = memo(() => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-heading font-bold text-foreground">
          What You'll Receive
        </h3>
        <p className="text-sm text-muted-foreground">
          Preview of notifications that will help keep you motivated and on track:
        </p>
      </div>

      <div className="space-y-3">
        {exampleNotifications.map((notification, index) => {
          const Icon = notification.icon;
          return (
            <Card 
              key={index}
              className="p-4 bg-card/50 border-border/50 hover:bg-card/80 transition-all duration-300"
            >
              <div className="flex gap-3 items-start">
                <div className={`p-2 rounded-full bg-background/50 ${notification.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {notification.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {notification.time}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {notification.message}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-primary font-semibold">💡 Tip:</span> Notifications are personalized to your mentor's style and your goals. You can adjust timing and frequency in settings anytime.
        </p>
      </div>
    </div>
  );
});
NotificationPreview.displayName = 'NotificationPreview';
