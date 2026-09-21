import { memo, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Accessibility } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanionVoiceSettings } from "@/hooks/useCompanionVoiceSettings";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const CompanionAccessibilitySettings = memo(() => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    autoplayVoice,
    setAutoplayVoice,
    muteSpokenReplies,
    setMuteSpokenReplies,
  } = useCompanionVoiceSettings();
  const [isUpdatingReadableQuestCards, setIsUpdatingReadableQuestCards] = useState(false);

  const spokenRepliesEnabled = autoplayVoice && !muteSpokenReplies;
  const readableQuestCardsEnabled = profile?.readable_quest_cards_enabled ?? false;

  const handleSpokenRepliesToggle = useCallback((checked: boolean) => {
    if (checked) {
      setMuteSpokenReplies(false);
      setAutoplayVoice(true);
      return;
    }

    setAutoplayVoice(false);
  }, [setAutoplayVoice, setMuteSpokenReplies]);

  const handleReadableQuestCardsToggle = useCallback(async (checked: boolean) => {
    if (!user || isUpdatingReadableQuestCards) return;

    setIsUpdatingReadableQuestCards(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ readable_quest_cards_enabled: checked })
        .eq("id", user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });

      toast({
        title: "Preference Updated",
        description: checked
          ? "Action cards will use a clearer backing"
          : "Action cards will use the original style",
      });
    } catch (error) {
      console.error("Error updating readable quest cards preference:", error);
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingReadableQuestCards(false);
    }
  }, [isUpdatingReadableQuestCards, queryClient, toast, user]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Accessibility className="h-4 w-4 text-primary" />
          Accessibility
        </CardTitle>
        <CardDescription className="text-xs">
          Options that make companion replies and quest cards easier to perceive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="companion-spoken-replies" className="text-sm font-medium">
              Read companion replies aloud
            </Label>
            <p className="text-xs text-muted-foreground">
              Turns on automatic spoken replies for companion and planner chats.
            </p>
          </div>
          <Switch
            id="companion-spoken-replies"
            checked={spokenRepliesEnabled}
            onCheckedChange={handleSpokenRepliesToggle}
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-5">
          <div className="space-y-0.5">
            <Label htmlFor="readable-quest-cards" className="text-sm font-medium">
              Readable quest cards
            </Label>
            <p className="text-xs text-muted-foreground">
              Uses a clearer backing for today’s quest and Companion story choices.
            </p>
          </div>
          <Switch
            id="readable-quest-cards"
            checked={readableQuestCardsEnabled}
            onCheckedChange={handleReadableQuestCardsToggle}
            disabled={!user || isUpdatingReadableQuestCards}
          />
        </div>
      </CardContent>
    </Card>
  );
});

CompanionAccessibilitySettings.displayName = "CompanionAccessibilitySettings";
