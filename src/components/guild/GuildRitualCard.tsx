/**
 * GuildRitualCard Component
 * Displays upcoming guild rituals and allows RSVP
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  Users,
  Bell,
  BellOff,
  Sparkles,
  Moon,
  Sun,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isPast } from "date-fns";

interface GuildRitual {
  id: string;
  name: string;
  description: string | null;
  ritual_type: string;
  scheduled_at: string;
  duration_minutes: number;
  xp_reward: number;
  attendees?: Array<{
    id: string;
    displayName?: string;
    avatarUrl?: string;
  }>;
  myRsvp?: boolean;
}

interface GuildRitualCardProps {
  ritual: GuildRitual;
  onRsvp: (ritualId: string, attending: boolean) => void;
  isRsvping: boolean;
}

export const GuildRitualCard = ({
  ritual,
  onRsvp,
  isRsvping,
}: GuildRitualCardProps) => {
  const scheduledAt = new Date(ritual.scheduled_at);
  const isUpcoming = !isPast(scheduledAt);
  const timeUntil = isUpcoming ? formatDistanceToNow(scheduledAt, { addSuffix: true }) : "Started";

  const getRitualIcon = (type: string) => {
    switch (type) {
      case 'morning':
        return Sun;
      case 'evening':
        return Moon;
      case 'meditation':
        return Star;
      default:
        return Sparkles;
    }
  };

  const getRitualColor = (type: string) => {
    switch (type) {
      case 'morning':
        return {
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
        };
      case 'evening':
        return {
          color: 'text-indigo-400',
          bgColor: 'bg-indigo-500/10',
          borderColor: 'border-indigo-500/30',
        };
      case 'meditation':
        return {
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
        };
      default:
        return {
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary/30',
        };
    }
  };

  const Icon = getRitualIcon(ritual.ritual_type);
  const colors = getRitualColor(ritual.ritual_type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={cn(
        "overflow-hidden transition-all",
        colors.borderColor,
        isUpcoming && "hover:shadow-lg"
      )}>
        <CardHeader className={cn("pb-3", colors.bgColor)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2.5 rounded-lg",
                colors.bgColor,
                colors.borderColor,
                "border"
              )}>
                <Icon className={cn("h-5 w-5", colors.color)} />
              </div>
              <div>
                <CardTitle className="text-base">{ritual.name}</CardTitle>
                <Badge variant="outline" className={cn("text-xs capitalize mt-1", colors.color)}>
                  {ritual.ritual_type} ritual
                </Badge>
              </div>
            </div>

            {isUpcoming && (
              <Badge variant={ritual.myRsvp ? "default" : "outline"} className="text-xs">
                {ritual.myRsvp ? "Attending" : "RSVP"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {ritual.description && (
            <p className="text-sm text-muted-foreground">{ritual.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(scheduledAt, 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{format(scheduledAt, 'h:mm a')}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {ritual.attendees?.length || 0} attending
              </span>
              {ritual.attendees && ritual.attendees.length > 0 && (
                <div className="flex -space-x-2 ml-1">
                  {ritual.attendees.slice(0, 4).map((attendee) => (
                    <Avatar key={attendee.id} className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={attendee.avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {attendee.displayName?.slice(0, 1).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-yellow-500 font-medium">{ritual.xp_reward} XP</span>
            </div>
          </div>

          {isUpcoming && (
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 text-sm text-muted-foreground">
                {timeUntil}
              </div>
              <Button
                size="sm"
                variant={ritual.myRsvp ? "outline" : "default"}
                onClick={() => onRsvp(ritual.id, !ritual.myRsvp)}
                disabled={isRsvping}
                className="gap-2"
              >
                {ritual.myRsvp ? (
                  <>
                    <BellOff className="h-3.5 w-3.5" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Bell className="h-3.5 w-3.5" />
                    Join Ritual
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};