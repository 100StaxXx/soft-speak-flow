import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNaturalLanguageParser, ParsedTask, parseNaturalLanguage } from '../hooks/useNaturalLanguageParser';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { QuickSuggestionChips } from './QuickSuggestionChips';
import { PermissionRequestDialog } from '@/components/PermissionRequestDialog';
import { AudioReactiveWaveform } from '@/components/AudioReactiveWaveform';
import { toast } from 'sonner';

interface CompactSmartInputProps {
  onSubmit: (parsed: ParsedTask) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CompactSmartInput({
  onSubmit,
  placeholder = "Add quest...",
  disabled = false,
  className,
}: CompactSmartInputProps) {
  const { input, setInput, parsed, reset } = useNaturalLanguageParser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const { medium, success, light, tap } = useHapticFeedback();

  const { isRecording, isSupported, permissionStatus, toggleRecording, requestPermission } = useVoiceInput({
    onInterimResult: (text) => {
      setInterimText(text);
    },
    onFinalResult: (text) => {
      setInput((prev) => (prev ? prev + ' ' + text : text).trim());
      setInterimText('');
      success();
    },
    onError: (error) => {
      toast.error(error);
    },
    onPermissionNeeded: () => {
      setShowPermissionDialog(true);
    },
  });

  const handleRequestPermission = async () => {
    const status = await requestPermission();
    
    if (status === 'granted') {
      setShowPermissionDialog(false);
      toggleRecording();
    }
  };

  const handleVoiceToggle = useCallback(() => {
    if (isRecording) {
      success();
    } else {
      medium();
    }
    toggleRecording();
  }, [isRecording, success, medium, toggleRecording]);

  const displayText = interimText ? `${input} ${interimText}`.trim() : input;

  const handleSubmit = () => {
    if (!parsed || !parsed.text.trim()) return;
    
    success();
    onSubmit(parsed);
    reset();
    setInterimText('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      reset();
      setInterimText('');
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    tap();
    setInput(prev => `${prev} ${suggestion}`.trim());
    inputRef.current?.focus();
  };

  const hasContent = displayText.trim().length > 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative flex items-center gap-1.5">
        {/* Main input */}
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={displayText}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            placeholder={placeholder}
            disabled={disabled || isRecording}
            className={cn(
              "h-9 text-sm pl-3 pr-20 rounded-full bg-muted/50 border-muted-foreground/20",
              "focus:ring-1 focus:ring-primary/30 focus:border-primary/50",
              "placeholder:text-muted-foreground/50",
              isRecording && "border-primary/50 bg-primary/5"
            )}
          />
          
          {/* Recording waveform overlay */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <AudioReactiveWaveform isActive={isRecording} className="w-24 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Action buttons inside input */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {/* Mic button */}
            {isSupported && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleVoiceToggle}
                disabled={disabled}
                className={cn(
                  "h-7 w-7 rounded-full",
                  isRecording && "bg-primary/20 text-primary"
                )}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            )}
            
            {/* Send button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSubmit}
              disabled={disabled || !hasContent}
              className={cn(
                "h-7 w-7 rounded-full",
                hasContent && "text-primary hover:bg-primary/20"
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Quick suggestion chips - shown when focused */}
      <AnimatePresence>
        {isFocused && (
          <QuickSuggestionChips
            onSuggestionClick={handleSuggestionClick}
            currentInput={displayText}
            className="px-1"
          />
        )}
      </AnimatePresence>
      
      {/* Permission dialog */}
      <PermissionRequestDialog
        isOpen={showPermissionDialog}
        onClose={() => setShowPermissionDialog(false)}
        onRequestPermission={handleRequestPermission}
        permissionStatus={permissionStatus}
      />
    </div>
  );
}
