import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getHabitCompletions } from "@/lib/firebase/habitCompletions";
import { getDocuments } from "@/lib/firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays, startOfDay } from "date-fns";
import { Flame } from "lucide-react";

export const HabitCalendar = () => {
  const { user } = useAuth();

  const { data: completions = [] } = useQuery({
    queryKey: ["habit-calendar", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const data = await getHabitCompletions(user.uid, thirtyDaysAgo);
      
      return data.map(c => ({ date: c.date }));
    },
  });

  const { data: habits = [] } = useQuery({
    queryKey: ["active-habits", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      const data = await getDocuments(
        "habits",
        [
          ["user_id", "==", user.uid],
          ["is_active", "==", true]
        ]
      );
      
      return data.map(h => ({ id: h.id }));
    },
  });

  // Generate last 30 days
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    return format(date, "yyyy-MM-dd");
  });

  // Count completions per day
  const completionsByDate = completions.reduce((acc, c) => {
    acc[c.date] = (acc[c.date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate intensity (0-4 levels based on % of habits completed)
  const getIntensity = (date: string) => {
    const count = completionsByDate[date] || 0;
    const totalHabits = habits.length || 1;
    const percentage = count / totalHabits;
    
    if (percentage === 0) return 0;
    if (percentage < 0.33) return 1;
    if (percentage < 0.66) return 2;
    if (percentage < 1) return 3;
    return 4;
  };

  const intensityColors = [
    "bg-muted/30",
    "bg-primary/20",
    "bg-primary/40",
    "bg-primary/60",
    "bg-primary/80",
  ];

  // Calculate streak
  let currentStreak = 0;
  const today = format(new Date(), "yyyy-MM-dd");
  for (let i = days.length - 1; i >= 0; i--) {
    if (completionsByDate[days[i]]) {
      currentStreak++;
    } else if (days[i] !== today) {
      break;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>30-Day Progress</span>
          {currentStreak > 0 && (
            <div className="flex items-center gap-1 text-orange-500">
              <Flame className="h-5 w-5" />
              <span className="text-lg font-bold">{currentStreak} day streak</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-10 gap-1.5">
          {days.map((date) => {
            const intensity = getIntensity(date);
            return (
              <div
                key={date}
                className={`aspect-square rounded-sm ${intensityColors[intensity]} transition-all hover:scale-110 cursor-pointer border border-border/30`}
                title={`${date}: ${completionsByDate[date] || 0}/${habits.length} habits`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            {intensityColors.map((color, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${color} border border-border/30`} />
            ))}
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
};
