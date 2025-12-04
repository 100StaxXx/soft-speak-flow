import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Trash2, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const AccountDeletionCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const platformLabel = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web";
  const env = import.meta.env;
  const appVersion =
    (env.VITE_APP_VERSION as string | undefined) ??
    (env.VITE_COMMIT_SHA as string | undefined) ??
    undefined;

  const resetState = () => {
    setReason("");
    setAcknowledged(false);
    setConfirmation("");
  };

  const handleDialogChange = (open: boolean) => {
    if (isDeleting) return;
    setDialogOpen(open);
    if (!open) {
      resetState();
    }
  };

  const isConfirmed = acknowledged && confirmation.trim().toUpperCase() === "DELETE";

  const handleDeleteAccount = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: {
          reason: reason.trim() || null,
          confirmation: confirmation.trim(),
          acknowledged: true,
          platform: platformLabel,
          appVersion,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to delete account");
      }

      toast({
        title: "Account deleted",
        description: "We've erased your account and all associated personal data.",
      });

      resetState();
      setDialogOpen(false);

      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.warn("Sign out after account deletion failed", signOutError);
      }

      navigate("/auth", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Unable to delete account",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Remove your Cosmiq account along with companions, AI chats, quests, and referral history. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>You can delete your account directly in the app without emailing support.</p>
            <p>This action immediately revokes access, cancels referral progress, and permanently removes stored personal data.</p>
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setDialogOpen(true)}
            disabled={!user}
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently erases your profile, AI conversations, missions, achievements, referral data, and companion history. You cannot undo this action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <p>
                  You&apos;ll immediately lose access to premium content. Active App Store subscriptions must still be cancelled directly with Apple.
                </p>
              </div>
            </div>

            <label className="text-sm font-medium text-foreground">
              Optional reason (helps us improve)
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Let us know why you're leaving..."
                className="mt-2"
                maxLength={1000}
              />
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
                disabled={isDeleting}
              />
              <span className="text-sm text-muted-foreground">
                I understand this action is permanent and will delete my account, companions, and personalized content.
              </span>
            </label>

            <label className="text-sm font-medium text-foreground">
              Type DELETE to confirm
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="DELETE"
                className="mt-2 uppercase"
                disabled={!acknowledged}
              />
            </label>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => handleDialogChange(false)}
              className="w-full sm:w-auto"
            >
              Keep my account
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={!isConfirmed || isDeleting}
              onClick={handleDeleteAccount}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete permanently"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
