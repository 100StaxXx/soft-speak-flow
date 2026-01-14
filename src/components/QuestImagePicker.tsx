import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuestImagePicker } from '@/hooks/useQuestImagePicker';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface QuestImagePickerProps {
  onImageSelected: (imageUrl: string) => void;
  className?: string;
  variant?: 'icon' | 'button';
  disabled?: boolean;
}

export function QuestImagePicker({
  onImageSelected,
  className,
  variant = 'icon',
  disabled = false,
}: QuestImagePickerProps) {
  const { pickImage, isUploading } = useQuestImagePicker();
  const { tap } = useHapticFeedback();

  const handleClick = async () => {
    if (isUploading || disabled) return;
    tap();
    
    const imageUrl = await pickImage();
    if (imageUrl) {
      onImageSelected(imageUrl);
    }
  };

  if (variant === 'button') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isUploading || disabled}
        className={cn("gap-2", className)}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {isUploading ? 'Uploading...' : 'Add Photo'}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isUploading || disabled}
      className={cn(
        "h-5 w-5 rounded-full",
        isUploading && "animate-pulse",
        className
      )}
    >
      {isUploading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Camera className="h-3 w-3 text-muted-foreground" />
      )}
    </Button>
  );
}
