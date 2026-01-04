import { useState, memo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import { useCompanion } from "@/hooks/useCompanion";

export const ResetCompanionButton = memo(() => {
  const [alertOpen, setAlertOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { createCompanion } = useCompanion();

  const handleReset = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('reset-companion');
      if (error) throw error;
      if (data?.success) {
        // Invalidate companion queries
        await queryClient.invalidateQueries({ queryKey: ['companion'] });
        
        toast.success('Companion reset! Create your new companion now.');
        setAlertOpen(false);
        
        // Open creation dialog immediately
        setCreateDialogOpen(true);
      } else {
        throw new Error(data?.error || 'Failed to reset companion');
      }
    } catch (err) {
      console.error('Reset companion failed:', err);
      toast.error(err.message || 'Failed to reset companion');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompanion = async (data: {
    favoriteColor: string;
    spiritAnimal: string;
    coreElement: string;
    storyTone: string;
  }) => {
    await createCompanion.mutateAsync(data);
    setCreateDialogOpen(false);
    toast.success('Your new companion has been created!');
  };

  return (
    <>
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full" disabled={loading}>
            {loading ? 'Resetting…' : 'Reset Companion'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your companion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your companion and its evolution history. 
              You'll be able to create a new companion immediately after. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={loading}>
              {loading ? 'Resetting...' : 'Confirm Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-black">
              Create Your New Companion
            </DialogTitle>
          </DialogHeader>
          <CompanionPersonalization
            onComplete={handleCreateCompanion}
            isLoading={createCompanion.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
});
ResetCompanionButton.displayName = 'ResetCompanionButton';
