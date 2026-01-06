import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const QuestBehaviorSettings = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  // Default to true (stay in place) if not set
  const keepInPlace = profile?.completed_tasks_stay_in_place ?? true;

  const handleToggle = useCallback(async (checked: boolean) => {
    if (!user || isUpdating) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ completed_tasks_stay_in_place: checked })
        .eq("id", user.id);

      if (error) throw error;

      // Invalidate profile cache to reflect the change
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      
      toast({
        title: "Preference Updated",
        description: checked 
          ? "Completed quests will stay in place" 
          : "Completed quests will move to the bottom",
      });
    } catch (error) {
      console.error("Error updating preference:", error);
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }, [user, isUpdating, queryClient, toast]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Quest Behavior
        </CardTitle>
        <CardDescription className="text-xs">
          Customize how completed quests are displayed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="keep-in-place" className="text-sm font-medium">
              Keep completed quests in place
            </Label>
            <p className="text-xs text-muted-foreground">
              When off, completed quests move to the bottom of the list
            </p>
          </div>
          <Switch
            id="keep-in-place"
            checked={keepInPlace}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
          />
        </div>
      </CardContent>
    </Card>
  );
};
