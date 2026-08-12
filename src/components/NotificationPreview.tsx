import { memo } from "react";
import { Card } from "@/components/ui/card";
import { BookOpen, Moon } from "lucide-react";

interface NotificationExample {
  icon: typeof BookOpen;
  title: string;
  message: string;
  time: string;
  color: string;
}

const exampleNotifications: NotificationExample[] = [
  {
    icon: BookOpen,
    title: "Morning Daily Grace",
    message: "Today’s prayer, Guide encouragement, and ready-made activity are waiting.",
    time: "8:00 AM",
    color: "text-primary"
  },
  {
    icon: Moon,
    title: "Evening Reflection",
    message: "Take a moment to notice grace and release the day.",
    time: "8:00 PM",
    color: "text-primary"
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
          Graceward keeps delivery simple: one morning package and an optional evening invitation.
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
          <span className="text-primary font-semibold">Your choice:</span> You can adjust the morning time, turn off the evening invitation, or disable notifications entirely.
        </p>
      </div>
    </div>
  );
});
NotificationPreview.displayName = 'NotificationPreview';
