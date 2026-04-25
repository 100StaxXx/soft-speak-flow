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
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AICompanionCreator } from "@/components/AICompanionCreator";
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
    companionName?: string | null;
  }) => {
    await createCompanion.mutateAsync({
      creationMode: "ai",
      ...data,
    });
    setCreateDialogOpen(false);
    toast.success("Your new AI egg has been chosen!");
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
              Shape Your New Companion Egg
            </DialogTitle>
          </DialogHeader>
          <AICompanionCreator
            onComplete={handleCreateCompanion}
            storyTone="epic_adventure"
            allowToneSelection
            isLoading={createCompanion.isPending}
            layout="compact"
            description="Choose the color and species for the new AI-generated egg you want to begin with."
          />
        </DialogContent>
      </Dialog>
    </>
  );
});
ResetCompanionButton.displayName = 'ResetCompanionButton';
