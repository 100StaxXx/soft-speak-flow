import { memo, useCallback } from "react";
import { Accessibility } from "lucide-react";

import { useCompanionVoiceSettings } from "@/hooks/useCompanionVoiceSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const CompanionAccessibilitySettings = memo(() => {
  const {
    autoplayVoice,
    setAutoplayVoice,
    muteSpokenReplies,
    setMuteSpokenReplies,
  } = useCompanionVoiceSettings();

  const spokenRepliesEnabled = autoplayVoice && !muteSpokenReplies;

  const handleSpokenRepliesToggle = useCallback((checked: boolean) => {
    if (checked) {
      setMuteSpokenReplies(false);
      setAutoplayVoice(true);
      return;
    }

    setAutoplayVoice(false);
  }, [setAutoplayVoice, setMuteSpokenReplies]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Accessibility className="h-4 w-4 text-primary" />
          Accessibility
        </CardTitle>
        <CardDescription className="text-xs">
          Optional spoken playback for companion replies. It stays hidden elsewhere while we improve it.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
});

CompanionAccessibilitySettings.displayName = "CompanionAccessibilitySettings";
