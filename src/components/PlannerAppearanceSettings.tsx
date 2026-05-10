import { memo, useCallback } from "react";
import { Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePlannerPathfinderAppearance } from "@/hooks/usePlannerPathfinderAppearance";

export const PlannerAppearanceSettings = memo(() => {
  const { themeMode, setThemeMode } = usePlannerPathfinderAppearance();
  const isLightMode = themeMode === "light";

  const handleLightModeToggle = useCallback((checked: boolean) => {
    setThemeMode(checked ? "light" : "dark");
  }, [setThemeMode]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Planner Appearance
        </CardTitle>
        <CardDescription className="text-xs">
          Controls Pathfinder, campaign editing, ritual editing, and planner chat popups.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="planner-light-mode" className="text-sm font-medium">
              Light planner screens
            </Label>
            <p className="text-xs text-muted-foreground">
              Starts Pathfinder in the brighter Aqua style. Turn off for dark cosmic.
            </p>
          </div>
          <Switch
            id="planner-light-mode"
            checked={isLightMode}
            onCheckedChange={handleLightModeToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
});

PlannerAppearanceSettings.displayName = "PlannerAppearanceSettings";
