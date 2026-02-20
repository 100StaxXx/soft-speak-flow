/**
 * GuildRitualCard Component
 * Displays guild rituals and allows marking attendance
 */

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Sparkles,
  Moon,
  Sun,
  Star,
  Check,
  Calendar,
} from "lucide-react";
import { cn, formatDisplayLabel } from "@/lib/utils";

interface GuildRitual {
  id: string;
  name: string;
  description: string | null;
  ritual_type: string;
  scheduled_time: string;
  scheduled_days: number[];
  is_active: boolean;
}

interface GuildRitualCardProps {
  ritual: GuildRitual;
  onMarkAttendance: (ritualId: string) => void;
  hasAttendedToday: boolean;
  isMarking: boolean;
}

const getDayName = (dayNum: number) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayNum] || '';
};

export const GuildRitualCard = ({
  ritual,
  onMarkAttendance,
  hasAttendedToday,
  isMarking,
}: GuildRitualCardProps) => {
  const today = new Date().getDay();
  const isScheduledToday = ritual.scheduled_days.includes(today);

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

  // Format time (HH:MM:SS to readable format)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={cn(
        "overflow-hidden transition-all",
        colors.borderColor,
        isScheduledToday && "ring-2 ring-primary/50"
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
                <Badge variant="outline" className={cn("text-xs mt-1", colors.color)}>
                  {formatDisplayLabel(ritual.ritual_type)} Ritual
                </Badge>
              </div>
            </div>

            {isScheduledToday && (
              <Badge variant={hasAttendedToday ? "default" : "secondary"} className="text-xs">
                {hasAttendedToday ? "✓ Done" : "Today"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {ritual.description && (
            <p className="text-sm text-muted-foreground">{ritual.description}</p>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(ritual.scheduled_time)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{ritual.scheduled_days.map(getDayName).join(', ')}</span>
            </div>
          </div>

          {isScheduledToday && !hasAttendedToday && (
            <Button
              size="sm"
              onClick={() => onMarkAttendance(ritual.id)}
              disabled={isMarking}
              className="w-full gap-2"
            >
              <Check className="h-4 w-4" />
              Mark Complete
            </Button>
          )}

          {hasAttendedToday && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-500">
              <Check className="h-4 w-4" />
              Completed today!
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
