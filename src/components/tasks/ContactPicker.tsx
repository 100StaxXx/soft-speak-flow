import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useContacts } from '@/hooks/useContacts';

interface ContactPickerProps {
  value: string | null;
  onChange: (contactId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ContactPicker({
  value,
  onChange,
  placeholder = 'Link to contact...',
  disabled = false,
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const { contacts, isLoading } = useContacts();

  const selectedContact = useMemo(() => {
    if (!value || !contacts) return null;
    return contacts.find((c) => c.id === value) || null;
  }, [value, contacts]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between bg-background/50',
            !selectedContact && 'text-muted-foreground'
          )}
          disabled={disabled || isLoading}
        >
          {selectedContact ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedContact.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(selectedContact.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedContact.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {selectedContact && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search contacts..." />
          <CommandList>
            <CommandEmpty>No contacts found.</CommandEmpty>
            <CommandGroup>
              {contacts?.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={contact.name}
                  onSelect={() => {
                    onChange(contact.id === value ? null : contact.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={contact.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm">{contact.name}</span>
                      {contact.company && (
                        <span className="text-xs text-muted-foreground">
                          {contact.company}
                        </span>
                      )}
                    </div>
                  </div>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      value === contact.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
