import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContactsEmptyStateProps {
  onAddContact: () => void;
  isFavoritesView?: boolean;
}

export function ContactsEmptyState({ onAddContact, isFavoritesView }: ContactsEmptyStateProps) {
  if (isFavoritesView) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No favorite contacts</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Star your most important contacts to see them here for quick access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No contacts yet</h3>
      <p className="text-muted-foreground text-sm max-w-xs mb-6">
        Start building your network by adding your first contact.
      </p>
      <Button onClick={onAddContact}>
        <Plus className="h-4 w-4 mr-2" />
        Add Contact
      </Button>
    </div>
  );
}
