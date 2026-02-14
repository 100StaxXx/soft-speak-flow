import { Users, Settings, ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type ContactsPermissionStatus = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

interface ContactsPermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestPermission: () => void;
  permissionStatus: ContactsPermissionStatus | null;
  isRequesting?: boolean;
}

export function ContactsPermissionDialog({
  isOpen,
  onClose,
  onRequestPermission,
  permissionStatus,
  isRequesting = false,
}: ContactsPermissionDialogProps) {
  const isDenied = permissionStatus === 'denied';

  if (isDenied) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">
              Contacts Access Blocked
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-3 text-sm text-muted-foreground">
                <p>
                  You've previously denied contacts access. To import contacts, you'll need to enable it in your device settings.
                </p>
                <div className="bg-muted rounded-lg p-3 text-left text-sm">
                  <span className="font-medium block mb-1">How to enable:</span>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Open iPhone Settings</li>
                    <li>Scroll down and tap this app</li>
                    <li>Toggle on "Contacts"</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={onClose} className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Got It
            </Button>
            <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
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
              <Users className="w-8 h-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center">
            Import Contacts?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Allow access to your contacts to quickly import them into the app. You can select which contacts to add.
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
                <Users className="w-4 h-4 mr-2" />
                Allow Access
              </>
            )}
          </Button>
          <AlertDialogCancel className="w-full mt-0">Maybe Later</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
