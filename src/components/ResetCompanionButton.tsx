import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const ResetCompanionButton = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('reset-companion');
      if (error) throw error;
      if (data?.success) {
        toast.success('Companion reset successfully. Create a new one anytime.');
        setOpen(false);
      } else {
        throw new Error(data?.error || 'Failed to reset companion');
      }
    } catch (err: any) {
      console.error('Reset companion failed:', err);
      toast.error(err.message || 'Failed to reset companion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={loading}>
          {loading ? 'Resetting…' : 'Reset Companion'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset your companion?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete your companion and its evolution history. You can create a new companion after resetting. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset} disabled={loading}>
            Confirm Reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
