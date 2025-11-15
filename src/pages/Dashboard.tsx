import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SkeletonCard } from "@/components/SkeletonCard";
import { 
  Trophy, 
  Target, 
  Flame, 
  BookOpen, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

interface DashboardStats {
  habitStreak: number;
  habitsCompleted: number;
  totalHabits: number;
  challengesActive: number;
  challengesCompleted: number;
  lessonsCompleted: number;
  totalLessons: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    if (!user) return;

    try {
      // Fetch habits stats
      const { data: habits } = await supabase
        .from("habits")
        .select("*, habit_completions(*)")
        .eq("user_id", user.id)
        .eq("is_active", true);

      // Fetch challenges stats
      const { data: challenges } = await supabase
        .from("user_challenges")
        .select("*, challenge_progress(*)")
        .eq("user_id", user.id);

      // Fetch lessons stats
      const { data: lessonsProgress } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", true);

      const { data: totalLessons } = await supabase
        .from("lessons")
        .select("id");

      // Calculate stats
      const activeHabits = habits || [];
      const todayStr = new Date().toISOString().split('T')[0];
      const habitsCompletedToday = activeHabits.filter(habit => 
        habit.habit_completions?.some((c: any) => c.date === todayStr)
      ).length;

      const maxStreak = Math.max(...activeHabits.map(h => h.current_streak || 0), 0);

      const activeChallenges = challenges?.filter(c => c.is_active && !c.completed).length || 0;
      const completedChallenges = challenges?.filter(c => c.completed).length || 0;

      setStats({
        habitStreak: maxStreak,
        habitsCompleted: habitsCompletedToday,
        totalHabits: activeHabits.length,
        challengesActive: activeChallenges,
        challengesCompleted: completedChallenges,
        lessonsCompleted: lessonsProgress?.length || 0,
        totalLessons: totalLessons?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <SkeletonCard />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const habitProgress = stats.totalHabits > 0 
    ? (stats.habitsCompleted / stats.totalHabits) * 100 
    : 0;

  const lessonProgress = stats.totalLessons > 0 
    ? (stats.lessonsCompleted / stats.totalLessons) * 100 
    : 0;

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            Your Progress
          </h1>
          <p className="text-muted-foreground">
            Track your journey and celebrate your wins
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/habits')}>
            <Flame className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.habitStreak}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </Card>

          <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/habits')}>
            <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.habitsCompleted}</p>
            <p className="text-xs text-muted-foreground">Today's Habits</p>
          </Card>

          <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/challenges')}>
            <Target className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.challengesActive}</p>
            <p className="text-xs text-muted-foreground">Active Goals</p>
          </Card>

          <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/challenges')}>
            <Trophy className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.challengesCompleted}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </Card>
        </div>

        {/* Progress Details */}
        <div className="space-y-4">
          {/* Habits Progress */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Daily Habits</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.habitsCompleted} of {stats.totalHabits} completed today
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/habits')}
              >
                View <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <Progress value={habitProgress} className="h-2" />
          </Card>

          {/* Lessons Progress */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Learning Journey</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.lessonsCompleted} of {stats.totalLessons} lessons completed
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/lessons')}
              >
                View <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <Progress value={lessonProgress} className="h-2" />
          </Card>

          {/* Challenges Progress */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Active Challenges</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.challengesActive} in progress, {stats.challengesCompleted} completed
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/challenges')}
              >
                View <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate('/weekly-review')}
          >
            <Calendar className="h-6 w-6" />
            <span>Weekly Review</span>
          </Button>
          <Button 
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate('/challenges')}
          >
            <Target className="h-6 w-6" />
            <span>Start New Challenge</span>
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
