import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  calendar_id: string | null;
  calendar_email: string | null;
  primary_calendar_id?: string | null;
  primary_calendar_name?: string | null;
  sync_enabled: boolean;
  sync_mode?: 'send_only' | 'full_sync';
  last_synced_at: string | null;
  created_at: string | null;
}

export function useGoogleCalendarConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch existing connection
  const { data: connection, isLoading } = useQuery({
    queryKey: ['google-calendar-connection', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('sync_enabled', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching calendar connection:', error);
        return null;
      }
      
      return data as CalendarConnection | null;
    },
    enabled: !!user?.id,
  });

  // Get OAuth URL to initiate connection
  const getAuthUrl = async (redirectUri: string): Promise<string | null> => {
    try {
      setIsConnecting(true);
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'getAuthUrl', redirectUri },
      });

      if (error) {
        console.error('Error getting auth URL:', error);
        toast.error('Failed to start Google Calendar connection');
        return null;
      }

      return data?.url || data?.auth_url || null;
    } catch (err) {
      console.error('Error in getAuthUrl:', err);
      toast.error('Failed to connect to Google Calendar');
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  // Exchange authorization code for tokens
  const exchangeCode = useMutation({
    mutationFn: async ({ code, redirectUri }: { code: string; redirectUri: string }) => {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'exchangeCode', code, redirectUri },
      });

      if (error) {
        throw new Error(error.message || 'Failed to exchange code');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      queryClient.invalidateQueries({ queryKey: ['external-calendar-events'] });
      toast.success('Google Calendar connected successfully!');
    },
    onError: (error) => {
      console.error('Error exchanging code:', error);
      toast.error('Failed to connect Google Calendar');
    },
  });

  // Disconnect calendar
  const disconnect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect' },
      });

      if (error) {
        throw new Error(error.message || 'Failed to disconnect');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      queryClient.invalidateQueries({ queryKey: ['external-calendar-events'] });
      toast.success('Google Calendar disconnected');
    },
    onError: (error) => {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect Google Calendar');
    },
  });

  // Check connection status
  const checkStatus = async (): Promise<{ connected: boolean; email?: string } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'status' },
      });

      if (error) {
        console.error('Error checking status:', error);
        return null;
      }

      return data ? { connected: !!data.connected, email: data.calendarEmail || data.email } : null;
    } catch (err) {
      console.error('Error in checkStatus:', err);
      return null;
    }
  };

  return {
    connection,
    isLoading,
    isConnecting,
    isConnected: !!connection,
    getAuthUrl,
    exchangeCode,
    disconnect,
    checkStatus,
  };
}
