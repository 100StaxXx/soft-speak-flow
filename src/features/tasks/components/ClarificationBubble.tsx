import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClarificationBubbleProps {
  question: string;
  onAnswer: (answer: string) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export function ClarificationBubble({ 
  question, 
  onAnswer, 
  onSkip, 
  isLoading = false 
}: ClarificationBubbleProps) {
  const [response, setResponse] = useState('');

  const handleSubmit = () => {
    if (response.trim()) {
      onAnswer(response.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && response.trim()) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onSkip();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative bg-muted/50 backdrop-blur-sm rounded-lg p-3 space-y-3 border border-border/50"
    >
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        title="Skip clarification"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* AI Avatar + Question */}
      <div className="flex items-start gap-2 pr-6">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{question}</p>
      </div>
      
      {/* Quick response input */}
      <div className="flex gap-2">
        <Input
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Type your answer..."
          className={cn(
            "h-9 text-sm bg-background/50",
            isLoading && "opacity-50"
          )}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoFocus
        />
        <Button 
          size="sm" 
          onClick={handleSubmit}
          disabled={!response.trim() || isLoading}
          className="h-9 px-3"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
      
      {/* Skip option */}
      <button 
        onClick={onSkip} 
        disabled={isLoading}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors disabled:opacity-50"
      >
        Skip and extract anyway
      </button>
    </motion.div>
  );
}
