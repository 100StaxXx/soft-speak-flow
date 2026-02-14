import { Card } from "@/components/ui/card";
import { useAnalytics } from "@/hooks/useAnalytics";
import { BarChart3, TrendingUp, Flame, Heart } from "lucide-react";
import { SkeletonCard } from "./SkeletonCard";
import { ScaleIn, SlideUp } from "./PageTransition";

export const AnalyticsDashboard = () => {
  const { habitTrends, moodTrends, streakStats, checkInStats, isLoading } = useAnalytics();

  if (isLoading) {
    return <SkeletonCard />;
  }

  const totalHabits = habitTrends?.reduce((sum, day) => sum + day.count, 0) || 0;
  const avgHabitsPerDay = totalHabits / 30;
  const checkInGrowth = checkInStats && checkInStats.lastWeek > 0
    ? Math.round(((checkInStats.thisWeek - checkInStats.lastWeek) / checkInStats.lastWeek) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <ScaleIn>
        <h2 className="font-display text-3xl text-foreground">Your Progress</h2>
      </ScaleIn>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SlideUp delay={0.1}>
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Current Streak</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{streakStats?.current || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">days</p>
          </Card>
        </SlideUp>

        <SlideUp delay={0.2}>
          <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <p className="text-xs text-muted-foreground">Longest Streak</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{streakStats?.longest || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">days</p>
          </Card>
        </SlideUp>

        <SlideUp delay={0.3}>
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Avg/Day</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{avgHabitsPerDay.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">habits</p>
          </Card>
        </SlideUp>

        <SlideUp delay={0.4}>
          <Card className="p-4 bg-gradient-to-br from-accent/10 to-primary/5 border-accent/20">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-accent" />
              <p className="text-xs text-muted-foreground">Check-ins</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{checkInStats?.thisWeek || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {checkInGrowth > 0 ? '+' : ''}{checkInGrowth}% vs last week
            </p>
          </Card>
        </SlideUp>
      </div>

      {/* Habit Completion Chart */}
      <SlideUp delay={0.5}>
        <Card className="p-6 bg-card border-border shadow-soft">
          <h3 className="font-display text-xl text-foreground mb-4">30-Day Habit Trend</h3>
          <div className="h-48 flex items-end justify-between gap-1">
            {habitTrends?.map((day) => {
              const maxCount = Math.max(...(habitTrends.map(d => d.count) || [1]));
              const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
              return (
                <div
                  key={day.date}
                  className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-all cursor-pointer group relative"
                  style={{ height: `${height}%`, minHeight: day.count > 0 ? '4px' : '2px' }}
                >
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {day.count}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </Card>
      </SlideUp>

      {/* Mood Distribution */}
      {moodTrends && moodTrends.length > 0 && (
        <SlideUp delay={0.6}>
          <Card className="p-6 bg-card border-border shadow-soft">
            <h3 className="font-display text-xl text-foreground mb-4">Mood Distribution</h3>
            <div className="space-y-3">
              {moodTrends.map((mood) => {
                const maxCount = Math.max(...moodTrends.map(m => m.count));
                const percentage = (mood.count / maxCount) * 100;
                return (
                  <div key={mood.mood} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground capitalize">{mood.mood}</span>
                      <span className="text-muted-foreground">{mood.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </SlideUp>
      )}

      {/* Total Stats */}
      <SlideUp delay={0.7}>
        <Card className="p-6 bg-card border-border shadow-soft">
          <h3 className="font-display text-xl text-foreground mb-4">Lifetime Stats</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Active Habits</p>
              <p className="text-3xl font-bold text-foreground">{streakStats?.total || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Check-ins</p>
              <p className="text-3xl font-bold text-foreground">{checkInStats?.total || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Habits Completed</p>
              <p className="text-3xl font-bold text-foreground">{totalHabits}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Consistency</p>
              <p className="text-3xl font-bold text-foreground">
                {habitTrends ? Math.round((habitTrends.filter(d => d.count > 0).length / 30) * 100) : 0}%
              </p>
            </div>
          </div>
        </Card>
      </SlideUp>
    </div>
  );
};
