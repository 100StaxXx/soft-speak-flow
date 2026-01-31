import { useState, useEffect, useMemo } from 'react';
import { Smartphone, Search, AlertCircle, CheckCircle2, Users, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePhoneContacts, PhoneContact } from '@/hooks/usePhoneContacts';
import { useContacts } from '@/hooks/useContacts';
import { toast } from 'sonner';
import { ContactsPermissionDialog } from './ContactsPermissionDialog';

interface PhoneContactsPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportState = 'idle' | 'checking-permission' | 'loading' | 'selecting' | 'importing' | 'complete' | 'error';
type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

export function PhoneContactsPicker({ open, onOpenChange }: PhoneContactsPickerProps) {
  const { fetchContacts, mapToAppContact, isNative, checkPermission, requestPermission } = usePhoneContacts();
  const { contacts: existingContacts, createContact } = useContacts();

  const [state, setState] = useState<ImportState>('idle');
  const [phoneContacts, setPhoneContacts] = useState<PhoneContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setState('idle');
      setSelectedIds(new Set());
      setSearchQuery('');
      setImportProgress(0);
      setImportedCount(0);
      setSkippedCount(0);
      setError(null);
      setShowPermissionDialog(false);
      setIsRequestingPermission(false);
    }
  }, [open]);

  // Check permission when dialog opens
  useEffect(() => {
    if (open && state === 'idle' && isNative) {
      handleCheckPermission();
    }
  }, [open, state, isNative]);

  const handleCheckPermission = async () => {
    setState('checking-permission');
    const status = await checkPermission();
    setPermissionStatus(status);

    if (status === 'granted') {
      // Permission already granted, fetch contacts
      await handleFetchContacts();
    } else if (status === 'denied') {
      // Permission denied, show blocked dialog
      setShowPermissionDialog(true);
      setState('idle');
    } else {
      // Need to request permission
      setShowPermissionDialog(true);
      setState('idle');
    }
  };

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    const status = await requestPermission();
    setPermissionStatus(status);
    setIsRequestingPermission(false);

    if (status === 'granted') {
      setShowPermissionDialog(false);
      await handleFetchContacts();
    } else {
      // Permission denied after request
      setShowPermissionDialog(true);
    }
  };

  const handleFetchContacts = async () => {
    setState('loading');
    const { contacts, error: fetchError } = await fetchContacts();
    
    if (fetchError) {
      setError(fetchError);
      setState('error');
      return;
    }

    setPhoneContacts(contacts);
    setState('selecting');
  };

  // Filter and mark duplicates
  const { filteredContacts, duplicateIds } = useMemo(() => {
    const duplicates = new Set<string>();
    
    // Check for duplicates by phone or email
    phoneContacts.forEach(pc => {
      const isDuplicate = existingContacts.some(ec => {
        if (pc.phone && ec.phone) {
          // Normalize phone numbers for comparison
          const normalizedPc = pc.phone.replace(/\D/g, '');
          const normalizedEc = ec.phone.replace(/\D/g, '');
          if (normalizedPc && normalizedEc && normalizedPc === normalizedEc) return true;
        }
        if (pc.email && ec.email) {
          if (pc.email.toLowerCase() === ec.email.toLowerCase()) return true;
        }
        return false;
      });
      if (isDuplicate) duplicates.add(pc.id);
    });

    const filtered = phoneContacts.filter(contact => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        contact.name.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.phone?.includes(query) ||
        contact.company?.toLowerCase().includes(query)
      );
    });

    return { filteredContacts: filtered, duplicateIds: duplicates };
  }, [phoneContacts, existingContacts, searchQuery]);

  // Importable contacts (non-duplicates)
  const importableContacts = useMemo(() => 
    phoneContacts.filter(c => !duplicateIds.has(c.id)),
    [phoneContacts, duplicateIds]
  );

  // Select all non-duplicate contacts in current view
  const selectableContacts = filteredContacts.filter(c => !duplicateIds.has(c.id));
  const allSelected = selectableContacts.length > 0 && selectableContacts.every(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableContacts.map(c => c.id)));
    }
  };

  const toggleContact = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleImportContacts = async (contactsToImport: PhoneContact[]) => {
    if (contactsToImport.length === 0) return;

    setState('importing');
    setImportProgress(0);
    setImportedCount(0);
    setSkippedCount(0);

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < contactsToImport.length; i++) {
      const contact = contactsToImport[i];
      const appContact = mapToAppContact(contact);

      try {
        await createContact.mutateAsync(appContact);
        imported++;
        setImportedCount(imported);
      } catch (err) {
        console.error('Failed to import contact:', contact.name, err);
        skipped++;
        setSkippedCount(skipped);
      }

      setImportProgress(((i + 1) / contactsToImport.length) * 100);
    }

    setState('complete');
    
    if (imported > 0) {
      toast.success(`Imported ${imported} contact${imported !== 1 ? 's' : ''}`);
    }
  };

  const handleImportSelected = async () => {
    const contactsToImport = phoneContacts.filter(c => selectedIds.has(c.id));
    await handleImportContacts(contactsToImport);
  };

  const handleImportAll = async () => {
    await handleImportContacts(importableContacts);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleClosePermissionDialog = () => {
    setShowPermissionDialog(false);
    // If permission was denied, close the whole picker
    if (permissionStatus === 'denied') {
      onOpenChange(false);
    }
  };

  if (!isNative) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>
              Contact import is only available in the native iOS app.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Smartphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Open the app on your iPhone to import contacts from your phone.
            </p>
          </div>
          <Button onClick={handleClose} variant="outline" className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {/* Permission Dialog */}
      <ContactsPermissionDialog
        isOpen={showPermissionDialog}
        onClose={handleClosePermissionDialog}
        onRequestPermission={handleRequestPermission}
        permissionStatus={permissionStatus}
        isRequesting={isRequestingPermission}
      />

      <Dialog open={open && !showPermissionDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Import from Phone
            </DialogTitle>
            <DialogDescription>
              {state === 'checking-permission' && 'Checking permissions...'}
              {state === 'loading' && 'Fetching your contacts...'}
              {state === 'selecting' && `Select contacts to import (${phoneContacts.length} found)`}
              {state === 'importing' && 'Importing contacts...'}
              {state === 'complete' && 'Import complete!'}
              {state === 'error' && 'Something went wrong'}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {/* Checking Permission State */}
            {state === 'checking-permission' && (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-12"
              >
                <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Checking permissions...</p>
              </motion.div>
            )}

            {/* Loading State */}
            {state === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-12"
              >
                <div className="h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Loading contacts...</p>
              </motion.div>
            )}

            {/* Error State */}
            {state === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8 text-center"
              >
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <div className="flex gap-2">
                  <Button onClick={handleCheckPermission} variant="outline">
                    Try Again
                  </Button>
                  <Button onClick={handleClose} variant="ghost">
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Selection State */}
            {state === 'selecting' && (
              <motion.div
                key="selecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col flex-1 min-h-0"
              >
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Import All + Select All Row */}
                {importableContacts.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer flex-1"
                      onClick={toggleSelectAll}
                    >
                      <Checkbox checked={allSelected} />
                      <span className="font-medium text-sm">
                        Select All ({selectableContacts.length})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleImportAll}
                      className="shrink-0"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Import All ({importableContacts.length})
                    </Button>
                  </div>
                )}

                {/* Contacts List */}
                <ScrollArea className="flex-1 -mx-6 px-6">
                  <div className="space-y-1 pb-4">
                    {filteredContacts.map((contact) => {
                      const isDuplicate = duplicateIds.has(contact.id);
                      const isSelected = selectedIds.has(contact.id);

                      return (
                        <div
                          key={contact.id}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                            isDuplicate
                              ? 'bg-muted/30 opacity-60'
                              : isSelected
                              ? 'bg-primary/10'
                              : 'hover:bg-muted/50'
                          } ${!isDuplicate ? 'cursor-pointer' : ''}`}
                          onClick={() => !isDuplicate && toggleContact(contact.id)}
                        >
                          {isDuplicate ? (
                            <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
                          ) : (
                            <Checkbox checked={isSelected} className="shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{contact.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[contact.phone, contact.email, contact.company]
                                .filter(Boolean)
                                .join(' • ') || 'No details'}
                            </p>
                          </div>
                          {isDuplicate && (
                            <span className="text-xs text-muted-foreground">Already added</span>
                          )}
                        </div>
                      );
                    })}

                    {filteredContacts.length === 0 && (
                      <div className="flex flex-col items-center py-8 text-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery ? 'No contacts match your search' : 'No contacts found'}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t mt-2">
                  <Button onClick={handleClose} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportSelected}
                    disabled={selectedIds.size === 0}
                    className="flex-1"
                  >
                    Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Importing State */}
            {state === 'importing' && (
              <motion.div
                key="importing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8"
              >
                <div className="w-full mb-4">
                  <Progress value={importProgress} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Importing {importedCount} of {selectedIds.size || importableContacts.length} contacts...
                </p>
              </motion.div>
            )}

            {/* Complete State */}
            {state === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8 text-center"
              >
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Import Complete</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {importedCount} contact{importedCount !== 1 ? 's' : ''} imported
                  {skippedCount > 0 && `, ${skippedCount} skipped`}
                </p>
                <Button onClick={handleClose} className="w-full">
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
