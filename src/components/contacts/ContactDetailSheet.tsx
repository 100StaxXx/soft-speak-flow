import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Mail, Phone, Building2, Star, Plus, Bell } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Contact } from '@/hooks/useContacts';
import { useContactInteractions } from '@/hooks/useContactInteractions';
import { useContactReminders } from '@/hooks/useContactReminders';
import { InteractionDialog } from './InteractionDialog';
import { InteractionsList } from './InteractionsList';
import { ReminderDialog } from './ReminderDialog';
import { RemindersList } from './RemindersList';
import { cn } from '@/lib/utils';

interface ContactDetailSheetProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ContactDetailSheet({ contact, open, onOpenChange }: ContactDetailSheetProps) {
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  
  const {
    interactions,
    isLoading,
    createInteraction,
    deleteInteraction,
  } = useContactInteractions(contact?.id);

  const { reminders } = useContactReminders(contact?.id);
  const pendingReminders = reminders.filter((r) => !r.sent);

  if (!contact) return null;

  const lastInteraction = interactions[0];
  const totalInteractions = interactions.length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarImage src={contact.avatar_url ?? undefined} alt={contact.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {getInitials(contact.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-left truncate">{contact.name}</SheetTitle>
                  {contact.is_favorite && (
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
                  )}
                </div>

                {(contact.role || contact.company) && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {contact.role}
                    {contact.role && contact.company && ' @ '}
                    {contact.company}
                  </p>
                )}
              </div>
            </div>

            {/* Contact info */}
            <div className="flex flex-wrap gap-3 mt-4 text-sm">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  <span className="truncate max-w-[180px]">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  <span>{contact.phone}</span>
                </a>
              )}
            </div>

            {/* Tags */}
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-4 mt-4 pt-4 border-t text-sm">
              <div>
                <p className="text-muted-foreground">Last contact</p>
                <p className="font-medium">
                  {lastInteraction
                    ? formatDistanceToNow(new Date(lastInteraction.occurred_at), { addSuffix: true })
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total interactions</p>
                <p className="font-medium">{totalInteractions}</p>
              </div>
            </div>
          </SheetHeader>

          {/* Content Tabs */}
          <Tabs defaultValue="interactions" className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/50">
              <TabsList className="h-8">
                <TabsTrigger value="interactions" className="text-xs px-3">
                  History
                </TabsTrigger>
                <TabsTrigger value="reminders" className="text-xs px-3 relative">
                  Reminders
                  {pendingReminders.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                      {pendingReminders.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReminderDialogOpen(true)}
                  className="h-8"
                >
                  <Bell className="h-4 w-4 mr-1" />
                  Remind
                </Button>
                <Button
                  size="sm"
                  onClick={() => setInteractionDialogOpen(true)}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Log
                </Button>
              </div>
            </div>

            <TabsContent value="interactions" className="flex-1 m-0">
              <ScrollArea className="h-full px-6 py-4">
                <InteractionsList
                  interactions={interactions}
                  isLoading={isLoading}
                  onDelete={(id) => deleteInteraction.mutate({ id, contactId: contact.id })}
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="reminders" className="flex-1 m-0">
              <ScrollArea className="h-full px-6 py-4">
                <RemindersList contactId={contact.id} />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <InteractionDialog
        open={interactionDialogOpen}
        onOpenChange={setInteractionDialogOpen}
        onSubmit={(data) => {
          createInteraction.mutate({
            contact_id: contact.id,
            interaction_type: data.interaction_type,
            summary: data.summary,
            notes: data.notes,
            occurred_at: data.occurred_at,
          });
          setInteractionDialogOpen(false);
        }}
        isLoading={createInteraction.isPending}
      />

      <ReminderDialog
        contact={contact}
        open={reminderDialogOpen}
        onOpenChange={setReminderDialogOpen}
      />
    </>
  );
}
