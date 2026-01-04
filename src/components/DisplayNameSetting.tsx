import { useState, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

export const DisplayNameSetting = memo(() => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const currentName = getUserDisplayName(profile);
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    if (!user || !displayName.trim()) return;
    
    setIsSaving(true);
    try {
      // Fetch fresh profile data to avoid overwriting other fields
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();
      
      const onboardingData = (freshProfile?.onboarding_data as Record<string, unknown>) || {};
      const updatedData = { ...onboardingData, userName: displayName.trim() };
      
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_data: updatedData })
        .eq("id", user.id);
      
      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      
      toast({
        title: "Display name updated",
        description: `You'll now be known as "${displayName.trim()}"`,
      });
      
      setIsEditing(false);
      setDisplayName("");
    } catch (error) {
      toast({
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEditing = () => {
    setDisplayName(currentName === "Anonymous" ? "" : currentName);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDisplayName("");
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Display Name
        </CardTitle>
        <CardDescription className="text-xs">
          How you appear across the app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs text-muted-foreground">
                Enter your name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
                className="h-9"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !displayName.trim()}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {currentName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="font-medium">{currentName}</span>
            </div>
            <Button
              onClick={handleStartEditing}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
            >
              Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
DisplayNameSetting.displayName = 'DisplayNameSetting';
