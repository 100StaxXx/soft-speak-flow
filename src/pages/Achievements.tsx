import { BottomNav } from "@/components/BottomNav";
import { useAchievements } from "@/hooks/useAchievements";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Star, Crown } from "lucide-react";
import { PageTransition, SlideUp } from "@/components/PageTransition";
import { ShareButton } from "@/components/ShareButton";
import { format } from "date-fns";

export default function Achievements() {
  const { achievements, isLoading } = useAchievements();

  const tierColors = {
    bronze: "from-amber-700 to-amber-900",
    silver: "from-gray-400 to-gray-600",
    gold: "from-yellow-400 to-yellow-600",
    platinum: "from-purple-400 to-purple-600",
  };

  const tierIcons = {
    bronze: Award,
    silver: Star,
    gold: Trophy,
    platinum: Crown,
  };

  const stats = {
    total: achievements.length,
    bronze: achievements.filter(a => a.tier === 'bronze').length,
    silver: achievements.filter(a => a.tier === 'silver').length,
    gold: achievements.filter(a => a.tier === 'gold').length,
    platinum: achievements.filter(a => a.tier === 'platinum').length,
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Achievements
            </h1>
            <p className="text-sm text-muted-foreground">Your milestone collection</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Stats Overview */}
          <SlideUp delay={0.1}>
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Your Progress</h2>
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{stats.bronze}</div>
                  <div className="text-xs text-muted-foreground">Bronze</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-400">{stats.silver}</div>
                  <div className="text-xs text-muted-foreground">Silver</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">{stats.gold}</div>
                  <div className="text-xs text-muted-foreground">Gold</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-500">{stats.platinum}</div>
                  <div className="text-xs text-muted-foreground">Platinum</div>
                </div>
              </div>
            </Card>
          </SlideUp>

          {/* Achievements Grid */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading achievements...</div>
            ) : achievements.length === 0 ? (
              <SlideUp delay={0.2}>
                <Card className="p-12 text-center">
                  <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">No Achievements Yet</h3>
                  <p className="text-muted-foreground">
                    Start building habits and completing challenges to earn achievements!
                  </p>
                </Card>
              </SlideUp>
            ) : (
              achievements.map((achievement, index) => {
                const Icon = tierIcons[achievement.tier];
                return (
                  <SlideUp key={achievement.id} delay={0.1 * (index + 2)}>
                    <Card className="p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start gap-4">
                        <div className={`p-4 rounded-2xl bg-gradient-to-br ${tierColors[achievement.tier]} flex-shrink-0`}>
                          <span className="text-3xl">{achievement.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-bold text-lg">{achievement.title}</h3>
                            <Badge variant="outline" className="flex items-center gap-1 capitalize">
                              <Icon className="h-3 w-3" />
                              {achievement.tier}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Earned {format(new Date(achievement.earned_at), 'MMM d, yyyy')}
                            </span>
                            <ShareButton
                              title={`I earned "${achievement.title}"!`}
                              text={`🏆 ${achievement.title}\n${achievement.description}`}
                              className="h-8 w-8"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </SlideUp>
                );
              })
            )}
          </div>
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
}
