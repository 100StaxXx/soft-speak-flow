/**
 * HallOfLegends Component
 * Timeline display of guild's greatest achievements
 */

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scroll, Trophy, Star, Flame, Crown, Swords, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuildLegend } from "@/hooks/useGuildLegends";
import { format } from "date-fns";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

interface HallOfLegendsProps {
  legendsByMonth: Record<string, { label: string; legends: GuildLegend[] }> | undefined;
  getLegendConfig: (type: string) => {
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
  };
  isLoading: boolean;
}

export const HallOfLegends = ({
  legendsByMonth,
  getLegendConfig,
  isLoading,
}: HallOfLegendsProps) => {
  if (isLoading) {
    return (
      <Card className="cosmic-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const months = Object.entries(legendsByMonth || {}).sort((a, b) => b[0].localeCompare(a[0]));

  if (months.length === 0) {
    return (
      <Card className="cosmic-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scroll className="h-5 w-5 text-yellow-500" />
            Hall of Legends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              No legends recorded yet. Defeat bosses and achieve greatness!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getLegendIcon = (type: string) => {
    switch (type) {
      case 'boss_defeated':
        return Swords;
      case 'streak_record':
        return Flame;
      case 'first_blood':
        return Star;
      case 'perfect_week':
        return Crown;
      default:
        return Trophy;
    }
  };

  return (
    <Card className="cosmic-card overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Scroll className="h-5 w-5 text-yellow-500" />
          Hall of Legends
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-6">
            {months.map(([monthKey, { label, legends }]) => (
              <div key={monthKey}>
                {/* Month header */}
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{label}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Legends timeline */}
                <div className="relative pl-6 space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-yellow-500/50 via-primary/30 to-transparent" />

                  {legends.map((legend, index) => {
                    const config = getLegendConfig(legend.legend_type);
                    const Icon = getLegendIcon(legend.legend_type);

                    return (
                      <motion.div
                        key={legend.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative"
                      >
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute -left-4 top-3 h-4 w-4 rounded-full border-2 border-background",
                          config.bgColor
                        )}>
                          <div className={cn("h-full w-full rounded-full", config.bgColor)} />
                        </div>

                        {/* Legend card */}
                        <div className={cn(
                          "p-4 rounded-lg border",
                          config.bgColor,
                          config.borderColor
                        )}>
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              config.bgColor
                            )}>
                              <Icon className={cn("h-5 w-5", config.color)} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold">{legend.title}</span>
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs", config.color)}
                                >
                                  {config.label}
                                </Badge>
                              </div>

                              <p className="text-sm text-muted-foreground mt-1">
                                {legend.description}
                              </p>

                              {/* Heroes */}
                              {legend.heroes && legend.heroes.length > 0 && (
                                <div className="flex items-center gap-2 mt-3">
                                  <span className="text-xs text-muted-foreground">Heroes:</span>
                                  <div className="flex -space-x-2">
                                    {legend.heroes.slice(0, 5).map((hero) => (
                                      <Avatar key={hero.id} className="h-6 w-6 border-2 border-background">
                                        <AvatarFallback className="text-xs">
                                          {getUserDisplayName(hero).slice(0, 1).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))}
                                  </div>
                                  <span className="text-xs font-medium">
                                    {legend.heroes.map(h => getUserDisplayName(h)).join(', ')}
                                  </span>
                                </div>
                              )}

                              {/* Date */}
                              <p className="text-xs text-muted-foreground/60 mt-2">
                                {format(new Date(legend.recorded_at), 'MMM d, yyyy • h:mm a')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
