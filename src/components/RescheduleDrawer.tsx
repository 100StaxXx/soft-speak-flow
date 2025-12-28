import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Wand2, 
  Calendar as CalendarIcon, 
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useJourneySchedule, JourneyMilestone, JourneyPhase, JourneyRitual } from "@/hooks/useJourneySchedule";
import { useMilestones } from "@/hooks/useMilestones";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface RescheduleDrawerProps {
  epicId: string;
  epicTitle: string;
  epicGoal?: string;
  currentDeadline: string;
  children?: React.ReactNode;
}

const QUICK_ADJUSTMENTS = [
  { label: "I'm falling behind", value: "I'm falling behind schedule and need more time for each milestone" },
  { label: "Ahead of schedule", value: "I'm ahead of schedule, please compress the timeline" },
  { label: "Extend deadline", value: "I need to extend my deadline, please redistribute milestones" },
  { label: "More milestones", value: "Add more intermediate milestones to track progress better" },
  { label: "Simplify plan", value: "Simplify the plan with fewer, more focused milestones" },
];

export const RescheduleDrawer = ({ 
  epicId, 
  epicTitle,
  epicGoal,
  currentDeadline,
  children 
}: RescheduleDrawerProps) => {
  const [open, setOpen] = useState(false);
  const [adjustmentText, setAdjustmentText] = useState("");
  const [newDeadline, setNewDeadline] = useState<Date | undefined>(
    currentDeadline ? new Date(currentDeadline) : undefined
  );
  const [step, setStep] = useState<"input" | "preview" | "saving">("input");
  
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { milestones, milestonesByPhase } = useMilestones(epicId);
  const { 
    schedule, 
    adjustSchedule, 
    isLoading: isGenerating, 
    error: scheduleError,
    reset: resetSchedule 
  } = useJourneySchedule();

  // Convert current milestones to the format expected by adjustSchedule
  const currentSchedule = {
    phases: milestonesByPhase.map((phase, index) => ({
      id: `phase-${index}`,
      name: phase.phaseName,
      description: "",
      startDate: phase.milestones[0]?.target_date || "",
      endDate: phase.milestones[phase.milestones.length - 1]?.target_date || "",
      phaseOrder: phase.phaseOrder,
    })) as JourneyPhase[],
    milestones: milestones.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description || "",
      targetDate: m.target_date || "",
      phaseOrder: m.phase_order || 0,
      phaseName: m.phase_name || "General",
      isPostcardMilestone: m.is_postcard_milestone || false,
      milestonePercent: m.milestone_percent,
    })) as JourneyMilestone[],
    rituals: [] as JourneyRitual[],
  };

  const handleQuickAdjustment = (value: string) => {
    setAdjustmentText(prev => prev ? `${prev}\n${value}` : value);
  };

  const handleGenerateNewSchedule = async () => {
    if (!adjustmentText.trim() && newDeadline?.toISOString() === currentDeadline) {
      toast.error("Please describe your adjustment or change the deadline");
      return;
    }

    const result = await adjustSchedule({
      goal: epicGoal || epicTitle,
      deadline: newDeadline?.toISOString() || currentDeadline,
      adjustmentRequest: adjustmentText,
      previousSchedule: currentSchedule,
    });

    if (result) {
      setStep("preview");
    }
  };

  const handleApplyChanges = async () => {
    if (!schedule || !user) return;

    setStep("saving");

    try {
      // Delete existing milestones
      const { error: deleteError } = await supabase
        .from("epic_milestones")
        .delete()
        .eq("epic_id", epicId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      // Insert new milestones
      const newMilestones = schedule.milestones.map(m => ({
        epic_id: epicId,
        user_id: user.id,
        title: m.title,
        description: m.description,
        milestone_percent: m.milestonePercent,
        target_date: m.targetDate,
        phase_name: m.phaseName,
        phase_order: m.phaseOrder,
        is_postcard_milestone: m.isPostcardMilestone,
      }));

      const { error: insertError } = await supabase
        .from("epic_milestones")
        .insert(newMilestones);

      if (insertError) throw insertError;

      // Update epic deadline if changed
      if (newDeadline && newDeadline.toISOString() !== currentDeadline) {
        const { error: updateError } = await supabase
          .from("epics")
          .update({ end_date: newDeadline.toISOString() })
          .eq("id", epicId)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["milestones", epicId] });
      queryClient.invalidateQueries({ queryKey: ["epics"] });

      toast.success("Journey rescheduled!", {
        description: `${schedule.milestones.length} milestones updated`,
      });

      setOpen(false);
      resetState();
    } catch (error) {
      console.error("Failed to apply schedule changes:", error);
      toast.error("Failed to update schedule");
      setStep("preview");
    }
  };

  const resetState = () => {
    setStep("input");
    setAdjustmentText("");
    resetSchedule();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetState();
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Wand2 className="w-3.5 h-3.5" />
            Reschedule
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            AI Reschedule
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {step === "input" && "Tell AI how you'd like to adjust your journey"}
            {step === "preview" && "Review and apply the new schedule"}
            {step === "saving" && "Applying changes..."}
          </p>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 max-h-[60vh]">
          <AnimatePresence mode="wait">
            {step === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 pb-4"
              >
                {/* Quick Adjustments */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Quick adjustments
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ADJUSTMENTS.map((adj) => (
                      <Badge
                        key={adj.label}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-colors"
                        onClick={() => handleQuickAdjustment(adj.value)}
                      >
                        {adj.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Custom Adjustment Text */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Describe your changes
                  </label>
                  <Textarea
                    value={adjustmentText}
                    onChange={(e) => setAdjustmentText(e.target.value)}
                    placeholder="e.g., I need to take a 2-week break next month, please adjust milestones around that..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                {/* New Deadline */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Adjust deadline (optional)
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newDeadline && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newDeadline ? format(newDeadline, "PPP") : "Pick a new deadline"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newDeadline}
                        onSelect={setNewDeadline}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Current Stats */}
                <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Current journey</div>
                  <div className="text-sm font-medium">{epicTitle}</div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{milestones.length} milestones</span>
                    <span>•</span>
                    <span>{milestones.filter(m => m.completed_at).length} completed</span>
                  </div>
                </div>

                {scheduleError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4" />
                    {scheduleError}
                  </div>
                )}
              </motion.div>
            )}

            {step === "preview" && schedule && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 pb-4"
              >
                {/* Feasibility */}
                <div className={cn(
                  "rounded-lg p-3 border",
                  schedule.feasibilityAssessment.feasibility === "comfortable" && "bg-green-500/10 border-green-500/20",
                  schedule.feasibilityAssessment.feasibility === "achievable" && "bg-blue-500/10 border-blue-500/20",
                  schedule.feasibilityAssessment.feasibility === "aggressive" && "bg-amber-500/10 border-amber-500/20",
                  schedule.feasibilityAssessment.feasibility === "very_aggressive" && "bg-red-500/10 border-red-500/20",
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-medium text-sm capitalize">
                      {schedule.feasibilityAssessment.feasibility.replace("_", " ")} timeline
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {schedule.feasibilityAssessment.message}
                  </p>
                </div>

                {/* New Milestones Preview */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    New milestones ({schedule.milestones.length})
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {schedule.milestones.map((milestone, index) => (
                      <div
                        key={milestone.id}
                        className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">
                              {milestone.title}
                            </span>
                            {milestone.isPostcardMilestone && (
                              <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{milestone.phaseName}</span>
                            <span>•</span>
                            <span>{format(new Date(milestone.targetDate), "MMM d")}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">{milestones.length}</div>
                    <div className="text-[10px] text-muted-foreground">Current milestones</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
                    <div className="text-lg font-bold text-primary">{schedule.milestones.length}</div>
                    <div className="text-[10px] text-muted-foreground">New milestones</div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "saving" && (
              <motion.div
                key="saving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Updating your journey...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        <DrawerFooter className="border-t pt-4">
          {step === "input" && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 gap-2" 
                onClick={handleGenerateNewSchedule}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate New Schedule
                  </>
                )}
              </Button>
            </div>
          )}

          {step === "preview" && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("input")}>
                Back
              </Button>
              <Button className="flex-1 gap-2" onClick={handleApplyChanges}>
                <CheckCircle2 className="w-4 h-4" />
                Apply Changes
              </Button>
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
