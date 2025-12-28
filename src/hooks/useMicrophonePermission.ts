import { useState, useCallback, useEffect } from 'react';

export type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface UseMicrophonePermissionReturn {
  status: PermissionStatus;
  isLoading: boolean;
  checkPermission: () => Promise<PermissionStatus>;
  requestPermission: () => Promise<PermissionStatus>;
}

export function useMicrophonePermission(): UseMicrophonePermissionReturn {
  const [status, setStatus] = useState<PermissionStatus>('prompt');
  const [isLoading, setIsLoading] = useState(true);

  const checkPermission = useCallback(async (): Promise<PermissionStatus> => {
    // Check if we're in a browser that supports permissions API
    if (!navigator.permissions) {
      // Fall back to checking mediaDevices
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return 'unsupported';
      }
      // We can't check without prompting, assume 'prompt'
      setStatus('prompt');
      return 'prompt';
    }

    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      const mappedStatus = result.state === 'granted' ? 'granted' 
        : result.state === 'denied' ? 'denied' 
        : 'prompt';
      setStatus(mappedStatus);
      
      // Listen for permission changes
      result.onchange = () => {
        const newStatus = result.state === 'granted' ? 'granted' 
          : result.state === 'denied' ? 'denied' 
          : 'prompt';
        setStatus(newStatus);
      };
      
      return mappedStatus;
    } catch {
      // Permission query not supported for microphone, assume 'prompt'
      setStatus('prompt');
      return 'prompt';
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<PermissionStatus> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return 'unsupported';
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
      setStatus('granted');
      return 'granted';
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setStatus('denied');
          return 'denied';
        }
        if (error.name === 'NotFoundError') {
          setStatus('unsupported');
          return 'unsupported';
        }
      }
      setStatus('denied');
      return 'denied';
    }
  }, []);

  // Check permission status on mount
  useEffect(() => {
    checkPermission().finally(() => setIsLoading(false));
  }, [checkPermission]);

  return {
    status,
    isLoading,
    checkPermission,
    requestPermission,
  };
}
