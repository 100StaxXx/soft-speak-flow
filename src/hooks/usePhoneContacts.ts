import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ContactInsert } from './useContacts';

// Local type definitions to avoid importing from the native plugin
type ContactsPermissionStatus = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

export interface PhoneContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
}

interface UsePhoneContactsReturn {
  phoneContacts: PhoneContact[];
  isLoading: boolean;
  error: string | null;
  permissionStatus: ContactsPermissionStatus | null;
  isNative: boolean;
  checkPermission: () => Promise<ContactsPermissionStatus>;
  requestPermission: () => Promise<ContactsPermissionStatus>;
  fetchContacts: () => Promise<PhoneContact[]>;
  mapToAppContact: (contact: PhoneContact) => ContactInsert;
}

export function usePhoneContacts(): UsePhoneContactsReturn {
  const [phoneContacts, setPhoneContacts] = useState<PhoneContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<ContactsPermissionStatus | null>(null);

  const isNative = Capacitor.isNativePlatform();

  const checkPermission = useCallback(async (): Promise<ContactsPermissionStatus> => {
    if (!isNative) {
      return 'denied';
    }
    
    try {
      // Dynamic import - only loads on native platforms
      const { Contacts } = await import('@capacitor-community/contacts');
      const status = await Contacts.checkPermissions();
      const permStatus = status.contacts as ContactsPermissionStatus;
      setPermissionStatus(permStatus);
      return permStatus;
    } catch (err) {
      console.error('Error checking contacts permission:', err);
      setError('Failed to check contacts permission');
      return 'denied';
    }
  }, [isNative]);

  const requestPermission = useCallback(async (): Promise<ContactsPermissionStatus> => {
    if (!isNative) {
      return 'denied';
    }

    try {
      // Dynamic import - only loads on native platforms
      const { Contacts } = await import('@capacitor-community/contacts');
      const status = await Contacts.requestPermissions();
      const permStatus = status.contacts as ContactsPermissionStatus;
      setPermissionStatus(permStatus);
      return permStatus;
    } catch (err) {
      console.error('Error requesting contacts permission:', err);
      setError('Failed to request contacts permission');
      return 'denied';
    }
  }, [isNative]);

  const fetchContacts = useCallback(async (): Promise<PhoneContact[]> => {
    if (!isNative) {
      setError('Contacts sync is only available in the native app');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import - only loads on native platforms
      const { Contacts } = await import('@capacitor-community/contacts');
      
      // Check permission first
      let status = await checkPermission();
      
      if (status === 'prompt' || status === 'prompt-with-rationale') {
        status = await requestPermission();
      }

      if (status !== 'granted') {
        setError('Contacts permission denied. Please enable in Settings.');
        setIsLoading(false);
        return [];
      }

      // Fetch contacts using the community plugin
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
          emails: true,
          organization: true,
        },
      });

      const mappedContacts: PhoneContact[] = result.contacts
        .filter(contact => contact.name?.display) // Only include contacts with names
        .map(contact => ({
          id: contact.contactId || crypto.randomUUID(),
          name: contact.name?.display || 'Unknown',
          email: contact.emails?.[0]?.address || null,
          phone: contact.phones?.[0]?.number || null,
          company: contact.organization?.company || null,
          role: contact.organization?.jobTitle || null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setPhoneContacts(mappedContacts);
      setIsLoading(false);
      return mappedContacts;
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('Failed to fetch contacts from device');
      setIsLoading(false);
      return [];
    }
  }, [isNative, checkPermission, requestPermission]);

  const mapToAppContact = useCallback((contact: PhoneContact): ContactInsert => {
    return {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      role: contact.role,
      notes: null,
      avatar_url: null,
      is_favorite: false,
      tags: [],
    };
  }, []);

  return {
    phoneContacts,
    isLoading,
    error,
    permissionStatus,
    isNative,
    checkPermission,
    requestPermission,
    fetchContacts,
    mapToAppContact,
  };
}
