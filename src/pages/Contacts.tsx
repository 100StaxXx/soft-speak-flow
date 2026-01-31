import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Search, Star, Users, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContactCard } from '@/components/contacts/ContactCard';
import { ContactDialog } from '@/components/contacts/ContactDialog';
import { ContactsEmptyState } from '@/components/contacts/ContactsEmptyState';
import { ContactDetailSheet } from '@/components/contacts/ContactDetailSheet';
import { PhoneContactsPicker } from '@/components/contacts/PhoneContactsPicker';
import { useContacts, Contact, ContactInsert } from '@/hooks/useContacts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Contacts() {
  const navigate = useNavigate();
  const { contacts, isLoading, createContact, updateContact, deleteContact, toggleFavorite } = useContacts();
  const isNative = Capacitor.isNativePlatform();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [phonePickerOpen, setPhonePickerOpen] = useState(false);

  const filteredContacts = useMemo(() => {
    let result = contacts;

    if (activeTab === 'favorites') {
      result = result.filter((c) => c.is_favorite);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.company?.toLowerCase().includes(query) ||
          c.role?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [contacts, activeTab, searchQuery]);

  const handleOpenDialog = (contact?: Contact) => {
    setEditingContact(contact ?? null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingContact(null);
  };

  const handleSubmit = (data: ContactInsert) => {
    if (editingContact) {
      updateContact.mutate({ id: editingContact.id, ...data }, {
        onSuccess: handleCloseDialog,
      });
    } else {
      createContact.mutate(data, {
        onSuccess: handleCloseDialog,
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteContact.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const handleToggleFavorite = (id: string, isFavorite: boolean) => {
    toggleFavorite.mutate({ id, is_favorite: isFavorite });
  };

  const favoritesCount = contacts.filter((c) => c.is_favorite).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background pb-nav-safe pt-safe"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border safe-area-top">
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Contacts</h1>
                <p className="text-sm text-muted-foreground">
                  {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isNative && (
                <Button size="sm" variant="outline" onClick={() => setPhonePickerOpen(true)}>
                  <Smartphone className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'favorites')}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All Contacts
              </TabsTrigger>
              <TabsTrigger value="favorites" className="flex-1 gap-1">
                <Star className="h-4 w-4" />
                Favorites
                {favoritesCount > 0 && (
                  <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {favoritesCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <ContactsEmptyState
            onAddContact={() => handleOpenDialog()}
            onImportFromPhone={() => setPhonePickerOpen(true)}
            isFavoritesView={activeTab === 'favorites'}
          />
        ) : (
          filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleOpenDialog}
              onDelete={(id) => setDeleteId(id)}
              onToggleFavorite={handleToggleFavorite}
              onClick={setSelectedContact}
            />
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <ContactDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        contact={editingContact}
        onSubmit={handleSubmit}
        isLoading={createContact.isPending || updateContact.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contact will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contact Detail Sheet */}
      <ContactDetailSheet
        contact={selectedContact}
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
      />

      {/* Phone Contacts Picker */}
      <PhoneContactsPicker
        open={phonePickerOpen}
        onOpenChange={setPhonePickerOpen}
      />
    </motion.div>
  );
}
