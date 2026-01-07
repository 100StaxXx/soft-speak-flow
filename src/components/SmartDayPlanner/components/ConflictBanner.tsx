import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimeConflict } from '../utils/planAnalyzer';
import { cn } from '@/lib/utils';

interface ConflictBannerProps {
  conflicts: TimeConflict[];
  onAutoFix: () => void;
  isFixing: boolean;
}

export function ConflictBanner({ conflicts, onAutoFix, isFixing }: ConflictBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (conflicts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-amber-500/50 bg-amber-500/10 overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {conflicts.length} time conflict{conflicts.length > 1 ? 's' : ''} detected
          </span>
        </div>
        <ChevronDown 
          className={cn(
            "h-4 w-4 text-amber-500 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {conflicts.map((conflict, i) => (
                <div 
                  key={i}
                  className="text-xs text-muted-foreground bg-background/50 rounded p-2"
                >
                  <span className="font-medium text-foreground">{conflict.taskATitle}</span>
                  {' overlaps with '}
                  <span className="font-medium text-foreground">{conflict.taskBTitle}</span>
                  {' by '}
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {conflict.overlapMinutes}m
                  </span>
                </div>
              ))}
              
              <Button
                size="sm"
                variant="outline"
                onClick={onAutoFix}
                disabled={isFixing}
                className="w-full mt-2 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                {isFixing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    Auto-fix all conflicts
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
