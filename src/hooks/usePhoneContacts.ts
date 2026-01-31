import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Contacts, PermissionStatus } from '@capacitor-community/contacts';
import { ContactInsert } from './useContacts';

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
  permissionStatus: PermissionStatus['contacts'] | null;
  isNative: boolean;
  checkPermission: () => Promise<PermissionStatus['contacts']>;
  requestPermission: () => Promise<PermissionStatus['contacts']>;
  fetchContacts: () => Promise<PhoneContact[]>;
  mapToAppContact: (contact: PhoneContact) => ContactInsert;
}

export function usePhoneContacts(): UsePhoneContactsReturn {
  const [phoneContacts, setPhoneContacts] = useState<PhoneContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus['contacts'] | null>(null);

  const isNative = Capacitor.isNativePlatform();

  const checkPermission = useCallback(async () => {
    if (!isNative) {
      return 'denied' as const;
    }
    
    try {
      const status = await Contacts.checkPermissions();
      setPermissionStatus(status.contacts);
      return status.contacts;
    } catch (err) {
      console.error('Error checking contacts permission:', err);
      setError('Failed to check contacts permission');
      return 'denied' as const;
    }
  }, [isNative]);

  const requestPermission = useCallback(async () => {
    if (!isNative) {
      return 'denied' as const;
    }

    try {
      const status = await Contacts.requestPermissions();
      setPermissionStatus(status.contacts);
      return status.contacts;
    } catch (err) {
      console.error('Error requesting contacts permission:', err);
      setError('Failed to request contacts permission');
      return 'denied' as const;
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
