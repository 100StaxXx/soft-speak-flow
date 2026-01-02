import { Mic, MicOff, Settings } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { PermissionStatus } from '@/hooks/useMicrophonePermission';

interface PermissionRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestPermission: () => void;
  permissionStatus: PermissionStatus;
  isRequesting?: boolean;
}

export function PermissionRequestDialog({
  isOpen,
  onClose,
  onRequestPermission,
  permissionStatus,
  isRequesting = false,
}: PermissionRequestDialogProps) {
  const isDenied = permissionStatus === 'denied';
  const isUnsupported = permissionStatus === 'unsupported';

  const openSettings = () => {
    // For mobile apps, we'd use Capacitor to open settings
    // For web, we can only instruct the user
    onClose();
  };

  if (isUnsupported) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <MicOff className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">
              Voice Input Not Available
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Your device or browser doesn't support voice input. Try using a modern browser like Chrome or Safari.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction onClick={onClose}>Got It</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (isDenied) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <MicOff className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">
              Microphone Access Blocked
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-3 text-sm text-muted-foreground">
                <p>
                  You've previously denied microphone access. To use voice input, you'll need to enable it in your device settings.
                </p>
                <div className="bg-muted rounded-lg p-3 text-left text-sm">
                  <span className="font-medium block mb-1">How to enable:</span>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Go to your device Settings</li>
                    <li>Find Privacy & Security</li>
                    <li>Select Microphone</li>
                    <li>Enable access for this app</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={openSettings} className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Open Settings
            </Button>
            <AlertDialogCancel className="w-full mt-0">Maybe Later</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Default: prompt state - ask for permission
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Mic className="w-8 h-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center">
            Enable Voice Input?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Allow microphone access to create tasks and chat using your voice. This makes adding tasks faster and easier!
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <Button 
            onClick={onRequestPermission} 
            className="w-full"
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>Requesting Access...</>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Enable Microphone
              </>
            )}
          </Button>
          <AlertDialogCancel className="w-full mt-0">Maybe Later</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
