import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Eraser, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { trackProductExperience } from "@/lib/productAnalytics";

export const CompanionMemorySettings = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const memoryEnabled = profile?.companion_memory_enabled ?? true;

  const handleMemoryToggle = useCallback(async (checked: boolean) => {
    if (!user?.id || isUpdating) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ companion_memory_enabled: checked })
        .eq("id", user.id);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      void trackProductExperience("memory_preference_changed", {
        surface: "settings",
        properties: { enabled: checked },
      });
      toast({
        title: checked ? "Companion memory is on" : "Companion memory is off",
        description: checked
          ? "Your Companion may connect recent patterns and details you choose to share."
          : "Past chat details and earlier daily patterns will not personalize new Companion replies.",
      });
    } catch (error) {
      toast({
        title: "Could not update memory",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }, [isUpdating, queryClient, toast, user?.id]);

  const handleClearMemory = useCallback(async () => {
    if (!user?.id || isClearing) return;
    setIsClearing(true);
    try {
      const { error } = await supabase.rpc("clear_personal_companion_memory");
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["companion-memories"] }),
        queryClient.invalidateQueries({ queryKey: ["companion-chat-history", user.id] }),
      ]);
      setShowClearDialog(false);
      toast({
        title: "Personal memory cleared",
        description: "Chat-learned details were removed. Your conversations and earned progress remain.",
      });
    } catch (error) {
      toast({
        title: "Could not clear memory",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  }, [isClearing, queryClient, toast, user?.id]);

  return (
    <>
      <Card className="border-border/70 bg-card/85 p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Brain className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="companion-memory" className="font-semibold">Companion memory</Label>
              <Switch
                id="companion-memory"
                checked={memoryEnabled}
                disabled={!user?.id || isUpdating}
                onCheckedChange={(checked) => void handleMemoryToggle(checked)}
              />
            </div>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Allows your Companion to connect personal details you share in chat with recent daily patterns. Current-day Guide handoffs still work when this is off.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3 -ml-3 text-muted-foreground"
              onClick={() => setShowClearDialog(true)}
              disabled={!user?.id || isClearing}
            >
              <Eraser className="mr-2 h-4 w-4" aria-hidden="true" />
              Clear personal memory
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={showClearDialog} onOpenChange={(open) => !isClearing && setShowClearDialog(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear personal Companion memory?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes durable personal details learned from Companion chats. It does not delete conversations, daily reflections, or earned milestones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleClearMemory()} disabled={isClearing}>
              {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isClearing ? "Clearing…" : "Clear memory"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
