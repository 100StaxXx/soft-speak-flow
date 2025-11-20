import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AchievementPepTalkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievement: {
    title: string;
    tier: string;
    pepTalkDuration?: string;
    pepTalkMessage?: string;
    pepTalkCategory?: string;
  } | null;
}

const tierColors = {
  bronze: "bg-amber-700/20 text-amber-300 border-amber-600",
  silver: "bg-slate-400/20 text-slate-200 border-slate-400",
  gold: "bg-yellow-500/20 text-yellow-300 border-yellow-500",
  platinum: "bg-cyan-400/20 text-cyan-200 border-cyan-400",
};

export const AchievementPepTalkModal = ({
  open,
  onOpenChange,
  achievement,
}: AchievementPepTalkModalProps) => {
  if (!achievement) return null;

  const tierColor = tierColors[achievement.tier as keyof typeof tierColors] || tierColors.bronze;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <DialogTitle>{achievement.title}</DialogTitle>
            <Badge className={tierColor}>
              {achievement.tier}
            </Badge>
          </div>
          {achievement.pepTalkDuration && (
            <p className="text-sm text-muted-foreground">
              Duration: {achievement.pepTalkDuration}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {achievement.pepTalkCategory && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Category
                </span>
                <Badge variant="outline" className="capitalize">
                  {achievement.pepTalkCategory}
                </Badge>
              </div>
            )}

            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <p className="text-lg leading-relaxed">
                {achievement.pepTalkMessage}
              </p>
            </div>

            <div className="pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground text-center italic">
                This message was unlocked by your achievement
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
