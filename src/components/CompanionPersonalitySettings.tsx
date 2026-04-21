import { memo } from "react";
import { Sparkles } from "lucide-react";

import { useCompanionModeSettings } from "@/hooks/useCompanionModeSettings";
import { cn } from "@/lib/utils";
import { COMPANION_MODE_OPTIONS } from "@/shared/companionModes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const CompanionPersonalitySettings = memo(() => {
  const {
    mode,
    adaptationEnabled,
    isLoading,
    isSaving,
    setMode,
    setAdaptationEnabled,
  } = useCompanionModeSettings();

  const selectedMode = COMPANION_MODE_OPTIONS.find((option) => option.id === mode) ?? COMPANION_MODE_OPTIONS[0];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Companion Personality
        </CardTitle>
        <CardDescription className="text-xs">
          Choose your companion&apos;s default vibe and whether it adapts to the moment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="companion-personality-mode" className="text-sm font-medium">
            Personality mode
          </Label>
          <Select
            value={mode}
            onValueChange={(value) => {
              void setMode(value as typeof mode);
            }}
            disabled={isLoading || isSaving}
          >
            <SelectTrigger
              id="companion-personality-mode"
              aria-label="Companion personality mode"
              className="bg-background"
            >
              <SelectValue placeholder="Choose a personality mode" />
            </SelectTrigger>
            <SelectContent>
              {COMPANION_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Sets the companion&apos;s default tone before any situational adjustments.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="text-sm font-medium text-foreground">{selectedMode.label}</div>
          <p className="mt-1 text-xs text-muted-foreground">{selectedMode.description}</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="companion-adaptive-tone" className="text-sm font-medium">
              Adaptive tone
            </Label>
            <p className="text-xs text-muted-foreground">
              Lets your companion flex that vibe based on context instead of staying rigidly in one mode.
            </p>
          </div>
          <Switch
            id="companion-adaptive-tone"
            checked={adaptationEnabled}
            onCheckedChange={(checked) => {
              void setAdaptationEnabled(checked);
            }}
            disabled={isLoading || isSaving}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mode guide
          </p>
          <div className="space-y-2">
            {COMPANION_MODE_OPTIONS.map((option) => (
              <div
                key={option.id}
                className={cn(
                  "rounded-xl border px-3 py-2 transition-colors",
                  option.id === mode
                    ? "border-primary/35 bg-primary/5"
                    : "border-border/50 bg-background/60",
                )}
              >
                <div className="text-sm font-medium text-foreground">{option.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CompanionPersonalitySettings.displayName = "CompanionPersonalitySettings";
