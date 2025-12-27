import { useState, useRef, useEffect } from 'react';
import { Plus, Mic, MicOff, Inbox, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTaskInbox } from '../hooks/useTaskInbox';
import { toast } from 'sonner';

interface QuickCaptureButtonProps {
  className?: string;
}

export function QuickCaptureButton({ className }: QuickCaptureButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToInbox, isAdding } = useTaskInbox();

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleCapture = () => {
    if (!text.trim()) return;
    
    addToInbox({ 
      text: text.trim(), 
      source: 'manual' 
    });
    
    setText('');
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCapture();
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
      setText('');
    }
  };

  const toggleVoice = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice input not supported in this browser');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        setIsExpanded(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setText(prev => prev + (prev ? ' ' : '') + transcript);
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied');
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (error) {
      console.error('Speech recognition error:', error);
      toast.error('Failed to start voice input');
    }
  };

  if (!isExpanded) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleVoice}
          className="h-10 w-10 rounded-full"
          aria-label="Voice capture"
        >
          <Mic className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={() => setIsExpanded(true)}
          className="h-12 w-12 rounded-full shadow-lg"
          aria-label="Quick capture"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-full bg-background border shadow-lg",
      "animate-in fade-in zoom-in-95 duration-200",
      className
    )}>
      <Button
        variant={isRecording ? "destructive" : "ghost"}
        size="icon"
        onClick={toggleVoice}
        className="h-10 w-10 rounded-full flex-shrink-0"
        aria-label={isRecording ? "Stop recording" : "Start voice capture"}
      >
        {isRecording ? (
          <MicOff className="h-4 w-4 animate-pulse" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Capture a thought..."
        className="flex-1 border-0 focus-visible:ring-0 bg-transparent"
        disabled={isAdding}
      />

      {text.trim() && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setText('')}
          className="h-8 w-8 rounded-full flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="default"
        size="icon"
        onClick={handleCapture}
        disabled={!text.trim() || isAdding}
        className="h-10 w-10 rounded-full flex-shrink-0"
        aria-label="Save to inbox"
      >
        <Inbox className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setIsExpanded(false);
          setText('');
        }}
        className="h-8 w-8 rounded-full flex-shrink-0"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
