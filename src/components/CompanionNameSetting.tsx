import { memo, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PawPrint, Check } from "lucide-react";

import { useCompanion } from "@/hooks/useCompanion";
import {
  COMPANION_CUSTOM_NAME_MAX_LENGTH,
  getStoredCompanionCustomName,
  normalizeCompanionCustomName,
  persistCompanionCustomName,
} from "@/lib/companionName";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const CompanionNameSetting = memo(() => {
  const { companion, isLoading } = useCompanion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentCustomName = useMemo(
    () => getStoredCompanionCustomName(companion),
    [companion],
  );
  const [draftName, setDraftName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const normalizedDraftName = normalizeCompanionCustomName(draftName);
  const isDirty = normalizedDraftName !== currentCustomName;
  const isSaveDisabled =
    isSaving
    || !companion
    || !isDirty
    || isLoading;

  const startEditing = () => {
    setDraftName(currentCustomName ?? "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftName("");
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!companion || isSaveDisabled) return;

    setIsSaving(true);
    try {
      const nextName = await persistCompanionCustomName(companion.id, draftName);
      await queryClient.invalidateQueries({ queryKey: ["companion"] });

      toast({
        title: nextName ? "Companion name updated" : "Companion name cleared",
        description: nextName
          ? `${nextName} will now appear across the app.`
          : "Your companion will go back to using its generated name.",
      });

      setDraftName("");
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Failed to update companion name",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PawPrint className="h-4 w-4 text-primary" />
          Companion Name
        </CardTitle>
        <CardDescription className="text-xs">
          Give your companion a custom name or leave it blank to use its generated name.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="companionName" className="text-xs text-muted-foreground">
                Custom companion name
              </Label>
              <Input
                id="companionName"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Optional custom name"
                maxLength={COMPANION_CUSTOM_NAME_MAX_LENGTH}
                className="h-9"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                {draftName.length}/{COMPANION_CUSTOM_NAME_MAX_LENGTH}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => void handleSave()}
                disabled={isSaveDisabled}
                size="sm"
                className="h-8 text-xs"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1.5" />
                )}
                Save
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <PawPrint className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">
                  {currentCustomName ?? "Using generated name"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentCustomName
                    ? "Your custom name takes priority everywhere."
                    : "Set a name if you want something more personal."}
                </p>
              </div>
            </div>
            <Button
              onClick={startEditing}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!companion || isLoading}
            >
              {currentCustomName ? "Edit" : "Set Name"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

CompanionNameSetting.displayName = "CompanionNameSetting";
