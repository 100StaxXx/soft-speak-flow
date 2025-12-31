import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Star,
  MapPin,
  BookOpen,
  Eye,
  Quote,
  Users,
  X,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Milestone } from "@/hooks/useMilestones";
import { CompanionPostcard } from "@/hooks/useCompanionPostcards";
import { MILESTONE_XP_REWARDS } from "@/config/xpRewards";

interface MilestoneDetailDrawerProps {
  milestone: Milestone | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (milestone: Milestone) => void;
  onUncomplete: (milestone: Milestone) => void;
  isCompleting: boolean;
  status: "completed" | "overdue" | "pending";
  postcard?: CompanionPostcard;
  streakMultiplier?: number;
}

export const MilestoneDetailDrawer = ({
  milestone,
  isOpen,
  onClose,
  onComplete,
  onUncomplete,
  isCompleting,
  status,
  postcard,
  streakMultiplier = 1,
}: MilestoneDetailDrawerProps) => {
  if (!milestone) return null;

  const isCompleted = status === "completed";
  const isOverdue = status === "overdue";
  const isPostcardMilestone = milestone.is_postcard_milestone;

  // Calculate XP preview
  const baseXP = isPostcardMilestone
    ? MILESTONE_XP_REWARDS.POSTCARD
    : MILESTONE_XP_REWARDS.REGULAR;
  const displayXP = Math.round(baseXP * streakMultiplier);

  // Calculate days until/since target
  const getDaysInfo = () => {
    if (!milestone.target_date) return null;
    const targetDate = new Date(milestone.target_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const diff = differenceInDays(targetDate, today);
    return diff;
  };

  const daysInfo = getDaysInfo();

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} handleOnly={true} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {milestone.phase_name && (
                <Badge variant="outline" className="text-xs">
                  {milestone.phase_name}
                </Badge>
              )}
              {isPostcardMilestone && (
                <Badge
                  variant="outline"
                  className="text-xs text-royal-purple border-royal-purple/30 bg-royal-purple/10"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Celebration
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DrawerTitle className="text-left flex items-center gap-2 mt-2">
            <span>{milestone.title}</span>
            {isPostcardMilestone && (
              <Sparkles className="w-4 h-4 text-amber-500" />
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div 
          className="flex-1 max-h-[60vh] overflow-y-auto overscroll-contain"
          style={{ 
            WebkitOverflowScrolling: 'touch', 
            touchAction: 'pan-y' 
          }}
          data-vaul-no-drag
        >
          <div className="px-4 py-4 space-y-5">
            {/* Status & Date Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-2"
            >
              {/* Status Badge */}
              {isCompleted && (
                <Badge className="bg-green-500/10 text-green-600 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completed
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="bg-destructive/10">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Overdue
                </Badge>
              )}
              {!isCompleted && !isOverdue && (
                <Badge variant="secondary">Pending</Badge>
              )}

              {/* Target Date */}
              {milestone.target_date && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    isOverdue && "text-destructive"
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{format(new Date(milestone.target_date), "MMM d, yyyy")}</span>
                  {daysInfo !== null && !isCompleted && (
                    <span className="text-muted-foreground text-xs">
                      ({daysInfo > 0
                        ? `in ${daysInfo} day${daysInfo !== 1 ? "s" : ""}`
                        : daysInfo === 0
                        ? "today"
                        : `${Math.abs(daysInfo)} day${Math.abs(daysInfo) !== 1 ? "s" : ""} ago`})
                    </span>
                  )}
                </div>
              )}
            </motion.div>

            {/* Description */}
            {milestone.description && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="space-y-2"
              >
                <h4 className="text-sm font-medium text-muted-foreground">
                  Description
                </h4>
                <p className="text-sm leading-relaxed">{milestone.description}</p>
              </motion.div>
            )}

            {/* Cosmiq Story Section */}
            {isPostcardMilestone && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold">Cosmiq Story</h4>
                </div>

                {postcard ? (
                  // Show full chapter content
                  <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                    {/* Chapter Header */}
                    {postcard.chapter_title && (
                      <div className="px-4 py-3 border-b border-border/30 bg-primary/5">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-medium">
                            {postcard.chapter_number
                              ? `Chapter ${postcard.chapter_number}: `
                              : ""}
                            {postcard.chapter_title}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Postcard Image */}
                    {postcard.image_url && (
                      <div className="relative aspect-video w-full">
                        <img
                          src={postcard.image_url}
                          alt={postcard.location_name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <div className="flex items-center gap-1.5 text-white/90">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="text-sm font-medium">
                              {postcard.location_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 space-y-4">
                      {/* Location Description */}
                      {postcard.location_description && (
                        <p className="text-sm text-muted-foreground italic">
                          {postcard.location_description}
                        </p>
                      )}

                      {/* Story Content */}
                      {postcard.story_content && (
                        <div className="space-y-2">
                          <p className="text-sm leading-relaxed">
                            {postcard.story_content}
                          </p>
                        </div>
                      )}

                      {/* Mystery Clue */}
                      {postcard.clue_text && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-200/30">
                          <Eye className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-purple-600 block mb-1">
                              Mystery Clue
                            </span>
                            <p className="text-sm italic text-purple-700/80">
                              "{postcard.clue_text}"
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Prophecy */}
                      {postcard.prophecy_line && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-200/30">
                          <Quote className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-amber-600 block mb-1">
                              Prophecy Fragment
                            </span>
                            <p className="text-sm italic text-amber-700/80">
                              "{postcard.prophecy_line}"
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Featured Characters */}
                      {postcard.characters_featured &&
                        postcard.characters_featured.length > 0 && (
                          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Featuring:{" "}
                              {postcard.characters_featured.join(", ")}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                ) : !isCompleted ? (
                  // Teaser for uncompleted postcard milestone
                  <div className="relative rounded-xl border border-dashed border-stardust-gold/40 bg-gradient-to-br from-stardust-gold/10 via-amber-500/5 to-royal-purple/10 p-5 text-center overflow-hidden">
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-stardust-gold/10 to-transparent animate-shimmer" />
                    <div className="relative z-10">
                      <div className="w-12 h-12 rounded-full bg-stardust-gold/20 flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="w-6 h-6 text-stardust-gold" />
                      </div>
                      <p className="text-sm text-foreground/90 font-medium">
                        Complete this milestone to unlock{" "}
                        <span className="text-stardust-gold">
                          {milestone.chapter_number
                            ? `Chapter ${milestone.chapter_number}`
                            : "a new chapter"}
                        </span>
                        {" "}of your cosmic journey!
                      </p>
                    </div>
                  </div>
                ) : (
                  // Completed but no postcard generated yet
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-center">
                    <Loader2 className="w-6 h-6 text-muted-foreground mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      Your story chapter is being written...
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 border-t border-border/50">
          <AnimatePresence mode="wait">
            {isCompleted ? (
              <motion.div
                key="uncomplete"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onUncomplete(milestone)}
                  disabled={isCompleting}
                >
                  {isCompleting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <X className="w-4 h-4 mr-2" />
                  )}
                  Mark Incomplete
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Button
                  className="w-full gap-2"
                  onClick={() => onComplete(milestone)}
                  disabled={isCompleting}
                >
                  {isCompleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Complete Milestone
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-primary-foreground/20 text-primary-foreground text-xs"
                  >
                    +{displayXP} XP
                  </Badge>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
