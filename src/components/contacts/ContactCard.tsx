import { memo } from 'react';
import { Star, Mail, Phone, Building2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Contact } from '@/hooks/useContacts';
import { useContactReminders } from '@/hooks/useContactReminders';
import { ReminderBadge } from './ReminderBadge';
import { cn } from '@/lib/utils';

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onClick?: (contact: Contact) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const ContactCard = memo(function ContactCard({
  contact,
  onEdit,
  onDelete,
  onToggleFavorite,
  onClick,
}: ContactCardProps) {
  const { reminders } = useContactReminders(contact.id);
  const nextReminder = reminders.find((r) => !r.sent);

  return (
    <Card 
      className="p-4 flex items-start gap-4 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onClick?.(contact)}
    >
      <Avatar className="h-12 w-12 shrink-0">
        <AvatarImage src={contact.avatar_url ?? undefined} alt={contact.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(contact.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground truncate">{contact.name}</h3>
          {contact.is_favorite && (
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
          )}
          {nextReminder && (
            <ReminderBadge
              reminderAt={nextReminder.reminder_at}
              reason={nextReminder.reason}
            />
          )}
        </div>

        {(contact.role || contact.company) && (
          <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
            {contact.role && <span>{contact.role}</span>}
            {contact.role && contact.company && <span>@</span>}
            {contact.company && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {contact.company}
              </span>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate max-w-[150px]">{contact.email}</span>
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{contact.phone}</span>
            </a>
          )}
        </div>

        {contact.tags && contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
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
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onToggleFavorite(contact.id, !contact.is_favorite)}>
            <Star className={cn('h-4 w-4 mr-2', contact.is_favorite && 'fill-yellow-400 text-yellow-400')} />
            {contact.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(contact)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(contact.id)} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
});
