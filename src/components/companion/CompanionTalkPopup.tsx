 /**
  * CompanionTalkPopup - RPG-style dialogue popup with companion portrait and quote
  * Clean, simple design: image + quote + tap to dismiss
  */
 
 import { memo, useEffect, useState, useCallback } from "react";
 import { motion, AnimatePresence } from "framer-motion";
 import { X } from "lucide-react";
 import { cn } from "@/lib/utils";
 import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
 import { Progress } from "@/components/ui/progress";
 
 interface CompanionTalkPopupProps {
   isVisible: boolean;
   onDismiss: () => void;
   message: string;
   companionName: string;
   companionImageUrl: string | null;
 }
 
 // Calculate auto-dismiss duration based on message length
 const getAutoDismissDuration = (message: string): number => {
   const length = message.length;
   // < 60 chars: 3.2s, 60-100: 4s, > 100: 5s
   return Math.min(5, Math.max(3.2, 3 + (length / 50)));
 };
 
 export const CompanionTalkPopup = memo(({
   isVisible,
   onDismiss,
   message,
   companionName,
   companionImageUrl,
 }: CompanionTalkPopupProps) => {
   const [progress, setProgress] = useState(0);
   const duration = getAutoDismissDuration(message);
   
   // Check for reduced motion preference
   const prefersReducedMotion = 
     typeof window !== 'undefined' && 
     window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   
   // Auto-dismiss timer with progress bar
   useEffect(() => {
     if (!isVisible) {
       setProgress(0);
       return;
     }
     
     const startTime = Date.now();
     const durationMs = duration * 1000;
     
     const interval = setInterval(() => {
       const elapsed = Date.now() - startTime;
       const newProgress = Math.min(100, (elapsed / durationMs) * 100);
       setProgress(newProgress);
       
       if (elapsed >= durationMs) {
         clearInterval(interval);
         onDismiss();
       }
     }, 50);
     
     return () => clearInterval(interval);
   }, [isVisible, duration, onDismiss]);
   
   const handleDismiss = useCallback(() => {
     onDismiss();
   }, [onDismiss]);
   
   // Handle keyboard dismiss
   useEffect(() => {
     if (!isVisible) return;
     
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
         e.preventDefault();
         handleDismiss();
       }
     };
     
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [isVisible, handleDismiss]);
 
   return (
     <AnimatePresence>
       {isVisible && (
         <motion.div
           initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
           transition={{ duration: 0.2, ease: "easeOut" }}
           className={cn(
             "fixed left-4 right-4 z-50 cursor-pointer",
             "max-w-[680px] mx-auto",
             // Position above nav bar with safe area
             "bottom-[calc(64px+env(safe-area-inset-bottom,0px)+12px)]"
           )}
           onClick={handleDismiss}
           role="dialog"
           aria-modal="false"
           aria-label={`${companionName} says: ${message}`}
         >
           <div className={cn(
             "relative rounded-2xl overflow-hidden",
             "bg-card/95 backdrop-blur-lg",
             "border border-primary/20",
             "shadow-lg shadow-primary/10"
           )}>
             {/* Main content */}
             <div className="flex items-start gap-4 p-4">
               {/* Companion portrait */}
               <div className="relative flex-shrink-0">
                 <div className={cn(
                   "rounded-xl overflow-hidden",
                   "ring-2 ring-primary/30",
                   "shadow-md shadow-primary/20"
                 )}>
                   <Avatar className="h-16 w-16 rounded-xl">
                     {companionImageUrl ? (
                       <AvatarImage 
                         src={companionImageUrl} 
                         alt={companionName}
                         className="object-cover"
                       />
                     ) : null}
                     <AvatarFallback className="rounded-xl bg-primary/20 text-primary text-lg font-bold">
                       {companionName.charAt(0)}
                     </AvatarFallback>
                   </Avatar>
                 </div>
                 {/* Subtle glow effect */}
                 <div className="absolute inset-0 rounded-xl bg-primary/10 blur-xl -z-10" />
               </div>
               
               {/* Quote bubble */}
               <div className="flex-1 min-w-0 pt-1">
                 <p className="text-foreground text-base leading-relaxed">
                   "{message}"
                 </p>
                 <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                   — {companionName} <span className="text-primary">✨</span>
                 </p>
               </div>
               
               {/* Dismiss button */}
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   handleDismiss();
                 }}
                 className={cn(
                   "flex-shrink-0 p-1.5 rounded-full",
                   "text-muted-foreground hover:text-foreground",
                   "hover:bg-muted/50 transition-colors",
                   "focus:outline-none focus:ring-2 focus:ring-primary/50"
                 )}
                 aria-label="Dismiss"
               >
                 <X className="h-4 w-4" />
               </button>
             </div>
             
             {/* Auto-dismiss progress bar */}
             <div className="px-4 pb-3">
               <Progress 
                 value={progress} 
                 className="h-1 bg-muted/30"
               />
             </div>
           </div>
         </motion.div>
       )}
     </AnimatePresence>
   );
 });
 
 CompanionTalkPopup.displayName = 'CompanionTalkPopup';