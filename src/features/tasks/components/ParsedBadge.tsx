import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ParsedBadgeProps {
  icon: LucideIcon;
  label: string;
  colorClass: string;
  onRemove?: () => void;
  index: number;
}

export function ParsedBadge({ 
  icon: Icon, 
  label, 
  colorClass, 
  onRemove,
  index 
}: ParsedBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      transition={{ 
        delay: index * 0.05,
        type: "spring",
        stiffness: 500,
        damping: 30
      }}
    >
      <Badge 
        variant="outline" 
        className={cn(
          "text-xs gap-1 border cursor-pointer group transition-all duration-150",
          "hover:pr-1",
          colorClass
        )}
        onClick={onRemove}
      >
        <Icon className="h-3 w-3" />
        <span>{label}</span>
        {onRemove && (
          <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
        )}
      </Badge>
    </motion.div>
  );
}
