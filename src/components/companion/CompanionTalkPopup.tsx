 /**
  * CompanionTalkPopup - RPG-style dialogue popup with companion portrait and quote
  * Clean, simple design: image + quote + tap to dismiss
  */
 
 import { memo, useEffect, useState, useCallback, useRef } from "react";
 import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
import { Progress } from "@/components/ui/progress";
import { isCompanionPresetImageSource } from "@/lib/companionImageFocal";
import type { CompletionCompanionTone } from "@/types/completionFeedback";
 
 interface CompanionTalkPopupProps {
   isVisible: boolean;
   onDismiss: () => void;
   message: string;
   tone?: CompletionCompanionTone | null;
   mentor?: {
     personality: string;
     message: string;
   } | null;
   companionName: string;
   companionImageUrl: string | null;
   companionImageFocalX?: number | null;
  companionImageFocalY?: number | null;
}

const usesPortraitAvatar = (imageUrl?: string | null) => isCompanionPresetImageSource(imageUrl);

const COMPLETION_FEEDBACK_POPUP_BOTTOM_OFFSET_TERMS = "64px + env(safe-area-inset-bottom, 0px) + 12px";
const COMPLETION_FEEDBACK_POPUP_BOTTOM_OFFSET = `calc(${COMPLETION_FEEDBACK_POPUP_BOTTOM_OFFSET_TERMS})`;
const COMPLETION_FEEDBACK_TOAST_GAP_PX = 12;
const COMPLETION_FEEDBACK_TOAST_STACK_OFFSET_VAR = "--completion-feedback-toast-stack-offset";
const COMPLETION_FEEDBACK_TOAST_BOTTOM_OFFSET_VAR = "--completion-feedback-toast-bottom-offset";

const clearCompletionFeedbackToastOffsets = () => {
  if (typeof document === "undefined") return;

  const rootStyle = document.documentElement.style;
  rootStyle.removeProperty(COMPLETION_FEEDBACK_TOAST_STACK_OFFSET_VAR);
  rootStyle.removeProperty(COMPLETION_FEEDBACK_TOAST_BOTTOM_OFFSET_VAR);
};

const toneClassName: Record<CompletionCompanionTone, string> = {
  proud: "border-primary/25 shadow-primary/10",
  locked_in: "border-emerald-300/30 shadow-emerald-400/10",
  recovery: "border-amber-300/35 shadow-amber-400/10",
  calm: "border-sky-300/30 shadow-sky-400/10",
  hype: "border-fuchsia-300/35 shadow-fuchsia-400/10",
};
 
 // Calculate auto-dismiss duration based on message length
 const getAutoDismissDuration = (message: string, mentorMessage?: string | null): number => {
   const length = message.length + (mentorMessage?.length ?? 0);
   // < 60 chars: 3.2s, 60-100: 4s, > 100: 5s
   return Math.min(6.2, Math.max(3.2, 3 + (length / 50)));
 };
 
export const CompanionTalkPopup = memo(({
   isVisible,
   onDismiss,
   message,
   tone,
   mentor,
   companionName,
   companionImageUrl,
   companionImageFocalX,
   companionImageFocalY,
}: CompanionTalkPopupProps) => {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const duration = getAutoDismissDuration(message, mentor?.message);
  const hasCompanionName = companionName.trim().length > 0;
  const resolvedToneClassName = tone ? toneClassName[tone] : toneClassName.proud;
   
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
     
     setProgress(0);
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

  useEffect(() => clearCompletionFeedbackToastOffsets, []);

  useEffect(() => {
    if (!isVisible || typeof window === "undefined") return;

    const popupElement = popupRef.current;
    if (!popupElement) return;

    const updateToastStackOffsets = () => {
      const popupHeight = Math.ceil(
        popupElement.getBoundingClientRect().height || popupElement.offsetHeight,
      );
      if (!Number.isFinite(popupHeight) || popupHeight <= 0) return;

      const stackOffset = `${popupHeight + COMPLETION_FEEDBACK_TOAST_GAP_PX}px`;
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty(COMPLETION_FEEDBACK_TOAST_STACK_OFFSET_VAR, stackOffset);
      rootStyle.setProperty(
        COMPLETION_FEEDBACK_TOAST_BOTTOM_OFFSET_VAR,
        `calc(${COMPLETION_FEEDBACK_POPUP_BOTTOM_OFFSET_TERMS} + ${stackOffset})`,
      );
    };

    updateToastStackOffsets();

    let animationFrame: number | null = null;
    if (typeof window.requestAnimationFrame === "function") {
      animationFrame = window.requestAnimationFrame(updateToastStackOffsets);
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateToastStackOffsets);
      resizeObserver.observe(popupElement);
    } else {
      window.addEventListener("resize", updateToastStackOffsets);
      window.addEventListener("orientationchange", updateToastStackOffsets);
    }

    return () => {
      if (animationFrame !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(animationFrame);
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", updateToastStackOffsets);
        window.removeEventListener("orientationchange", updateToastStackOffsets);
      }
    };
  }, [isVisible, message, mentor?.message]);
   
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
     <AnimatePresence onExitComplete={clearCompletionFeedbackToastOffsets}>
       {isVisible && (
         <motion.div
           ref={popupRef}
           initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
           transition={{ duration: 0.2, ease: "easeOut" }}
           style={{ bottom: COMPLETION_FEEDBACK_POPUP_BOTTOM_OFFSET }}
           className={cn(
             "fixed left-4 right-4 z-50 cursor-pointer",
             "max-w-[680px] mx-auto"
           )}
         onClick={handleDismiss}
         role="dialog"
          aria-modal="false"
          aria-label={hasCompanionName ? `${companionName} says: ${message}` : `Companion says: ${message}`}
        >
           <div className={cn(
             "relative rounded-2xl overflow-hidden",
             "bg-card/95 backdrop-blur-lg",
             "border shadow-lg",
             resolvedToneClassName
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
                   <Avatar className={cn("h-16 w-16 rounded-xl", usesPortraitAvatar(companionImageUrl) && "bg-transparent")}>
                     {companionImageUrl ? (
                       usesPortraitAvatar(companionImageUrl) ? (
                         <CompanionPortraitShell
                           src={companionImageUrl}
                           className="h-full w-full rounded-xl"
                         >
                           <CompanionImage 
                             variant="avatar"
                             src={companionImageUrl} 
                             alt={companionName}
                             fit="portrait"
                             focalX={companionImageFocalX}
                             focalY={companionImageFocalY}
                             className="rounded-xl"
                           />
                         </CompanionPortraitShell>
                       ) : (
                         <CompanionImage 
                           variant="avatar"
                           src={companionImageUrl} 
                           alt={companionName}
                           focalX={companionImageFocalX}
                           focalY={companionImageFocalY}
                           className="object-cover"
                         />
                       )
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
                 <div className="space-y-1">
                   <div className="flex items-start gap-2">
                     <Sparkles className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                     <p className="text-foreground text-base leading-relaxed">
                       "{message}"
                     </p>
                   </div>
                 </div>
                {hasCompanionName ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {companionName}
                  </p>
                ) : null}
                {mentor?.message ? (
                  <div className="mt-3 border-t border-border/45 pt-2">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      <UserRound className="h-3 w-3" aria-hidden="true" />
                      <span>{mentor.personality}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      "{mentor.message}"
                    </p>
                  </div>
                ) : null}
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
