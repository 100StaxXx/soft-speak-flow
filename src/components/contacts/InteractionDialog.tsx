import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, Mail, Users, MessageSquare, StickyNote } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InteractionType } from '@/hooks/useContactInteractions';
import { cn } from '@/lib/utils';

const interactionSchema = z.object({
  interaction_type: z.enum(['call', 'email', 'meeting', 'message', 'note']),
  summary: z.string().min(1, 'Summary is required').max(200, 'Summary too long'),
  notes: z.string().optional(),
  occurred_at: z.string(),
});

type InteractionFormData = z.infer<typeof interactionSchema>;

interface InteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InteractionFormData) => void;
  isLoading?: boolean;
}

const interactionTypes: { value: InteractionType; label: string; icon: typeof Phone }[] = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'message', label: 'Message', icon: MessageSquare },
  { value: 'note', label: 'Note', icon: StickyNote },
];

export function InteractionDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: InteractionDialogProps) {
  const form = useForm<InteractionFormData>({
    resolver: zodResolver(interactionSchema),
    defaultValues: {
      interaction_type: 'call',
      summary: '',
      notes: '',
      occurred_at: new Date().toISOString().slice(0, 16),
    },
  });

  const handleSubmit = (data: InteractionFormData) => {
    onSubmit({
      ...data,
      occurred_at: new Date(data.occurred_at).toISOString(),
    });
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="interaction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {interactionTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <Button
                          key={type.value}
                          type="button"
                          variant={field.value === type.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => field.onChange(type.value)}
                          className={cn(
                            'flex items-center gap-1.5',
                            field.value === type.value && 'ring-2 ring-primary ring-offset-2'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </Button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="occurred_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
