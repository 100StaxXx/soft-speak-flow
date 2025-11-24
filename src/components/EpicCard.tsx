import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Flame, Target, Calendar, Zap, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

// Discord channel URL - update this with your actual Discord channel
const DISCORD_CHANNEL_URL = "https://discord.com/channels/yourserver/yourchannel";

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
  is_public?: boolean;
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
              {epic.is_public && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[#5865F2] hover:text-[#5865F2] hover:bg-[#5865F2]/10"
                  onClick={() => window.open(DISCORD_CHANNEL_URL, '_blank')}
                >
                  <svg className="w-4 h-4 mr-1" viewBox="0 0 71 55" fill="currentColor">
                    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/>
                  </svg>
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
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
