import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Flame, Target, Calendar, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface Epic {
  id: string;
  title: string;
  description?: string;
  target_days: number;
  start_date: string;
  end_date: string;
  status: string;
  xp_reward: number;
  progress_percentage: number;
  epic_habits?: Array<{
    habit_id: string;
    habits: {
      id: string;
      title: string;
      difficulty: string;
    };
  }>;
}

interface EpicCardProps {
  epic: Epic;
  onComplete?: () => void;
  onAbandon?: () => void;
}

export const EpicCard = ({ epic, onComplete, onAbandon }: EpicCardProps) => {
  const daysRemaining = Math.ceil(
    (new Date(epic.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const isCompleted = epic.status === "completed";
  const isActive = epic.status === "active";

  const getMilestoneColor = (progress: number) => {
    if (progress >= 100) return "text-yellow-400";
    if (progress >= 75) return "text-purple-400";
    if (progress >= 50) return "text-blue-400";
    if (progress >= 25) return "text-green-400";
    return "text-muted-foreground";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 bg-gradient-to-br from-background to-secondary/20 border-2 border-primary/20 hover:border-primary/40 transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isCompleted ? (
                <Trophy className="w-6 h-6 text-yellow-400" />
              ) : (
                <Target className="w-6 h-6 text-primary" />
              )}
              <h3 className="text-xl font-bold">{epic.title}</h3>
            </div>
            {epic.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {epic.description}
              </p>
            )}
          </div>
          <Badge
            variant={isCompleted ? "default" : "secondary"}
            className="ml-2"
          >
            {isCompleted ? "Legendary" : isActive ? "Active" : "Abandoned"}
          </Badge>
        </div>

        {/* Progress Bar with Milestones */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Epic Progress</span>
            <span className={`text-sm font-bold ${getMilestoneColor(epic.progress_percentage)}`}>
              {epic.progress_percentage}%
            </span>
          </div>
          <Progress value={epic.progress_percentage} className="h-3 bg-secondary" />
          
          {/* Milestone Markers */}
          <div className="flex justify-between mt-1 px-1">
            {[25, 50, 75, 100].map((milestone) => (
              <div key={milestone} className="text-center">
                <div
                  className={`w-1 h-2 mx-auto rounded ${
                    epic.progress_percentage >= milestone
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
                <span className="text-xs text-muted-foreground">{milestone}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="text-sm font-bold">{epic.target_days} days</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <div>
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="text-sm font-bold">
                {isCompleted ? "Complete!" : `${daysRemaining}d`}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <div>
              <div className="text-xs text-muted-foreground">XP Reward</div>
              <div className="text-sm font-bold">{epic.xp_reward} XP</div>
            </div>
          </div>
        </div>

        {/* Linked Habits */}
        {epic.epic_habits && epic.epic_habits.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Contributing Habits
            </div>
            <div className="flex flex-wrap gap-2">
              {epic.epic_habits.map((eh) => (
                <Badge key={eh.habit_id} variant="outline" className="text-xs">
                  {eh.habits.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isActive && (
          <div className="flex gap-2">
            {epic.progress_percentage >= 100 && (
              <Button
                onClick={onComplete}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Complete Epic
              </Button>
            )}
            <Button
              onClick={onAbandon}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              Abandon
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
};
