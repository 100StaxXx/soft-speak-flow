import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export function DeleteAccountButton() {
  const [alertOpen, setAlertOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation Required",
        description: "Please type DELETE to confirm account deletion",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('delete-account');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Account Deleted",
          description: "Your account and all associated data have been permanently deleted.",
        });

        // Sign out and redirect to auth page
        await supabase.auth.signOut();
        navigate("/auth");
      } else {
        throw new Error(data?.error || 'Failed to delete account');
      }
    } catch (err) {
      console.error('Delete account failed:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete account. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setAlertOpen(open);
    if (!open) {
      setConfirmText("");
    }
  };

  return (
    <AlertDialog open={alertOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
          disabled={loading}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Delete Your Account?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This action is <strong>permanent and cannot be undone</strong>. All your data will be permanently deleted, including:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Your profile and account information</li>
              <li>Your companion and evolution history</li>
              <li>All your quests, habits, and progress</li>
              <li>Saved favorites and downloads</li>
              <li>Subscription and referral data</li>
            </ul>
            <p className="font-medium pt-2">
              To confirm deletion, type <strong>DELETE</strong> below:
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-2">
          <Label htmlFor="confirm-delete" className="sr-only">
            Type DELETE to confirm
          </Label>
          <Input
            id="confirm-delete"
            placeholder="Type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            disabled={loading}
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAccount}
            disabled={loading || confirmText !== "DELETE"}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Permanently Delete Account"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
