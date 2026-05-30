/**
  * CompanionTalkPopup - stylized companion feedback popup with portrait, quote, and optional action
  */
 
 import { memo, useEffect, useState, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
 import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Sparkles, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
import { Progress } from "@/components/ui/progress";
import {
  isCompanionSceneImageSource,
  shouldContainCompanionSceneImage,
} from "@/lib/companionImageFocal";
import type { CompletionCompanionTone } from "@/types/completionFeedback";
import type { CompanionTalkPopupAction } from "@/contexts/TalkPopupContext";
 
 interface CompanionTalkPopupProps {
   isVisible: boolean;
   onDismiss: () => void;
   message: string;
   tone?: CompletionCompanionTone | null;
   mentor?: {
     personality: string;
     message: string;
   } | null;
   action?: CompanionTalkPopupAction | null;
   companionName: string;
   companionImageUrl: string | null;
   companionImageFocalX?: number | null;
  companionImageFocalY?: number | null;
}

const usesPortraitAvatar = (imageUrl?: string | null) =>
  isCompanionSceneImageSource(imageUrl) && !shouldContainCompanionSceneImage(imageUrl);

// Keep the popup bottom and the toast stacking vars in lockstep so fixed layers do not drift.
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

const toneClassName: Record<CompletionCompanionTone, {
  shell: string;
  wash: string;
  icon: string;
  portrait: string;
  action: string;
}> = {
  proud: {
    shell: "border-primary/35 shadow-[0_18px_46px_hsl(var(--primary)/0.18)]",
    wash: "from-primary/16 via-transparent to-accent/12",
    icon: "bg-primary/15 text-primary ring-primary/25",
    portrait: "from-primary/80 via-primary/25 to-accent/70",
    action: "border-primary/35 bg-primary/12 text-primary hover:bg-primary/18",
  },
  locked_in: {
    shell: "border-emerald-300/35 shadow-[0_18px_46px_rgba(16,185,129,0.16)]",
    wash: "from-emerald-400/14 via-transparent to-cyan-300/10",
    icon: "bg-emerald-400/12 text-emerald-400 ring-emerald-300/25",
    portrait: "from-emerald-300/80 via-cyan-300/25 to-primary/60",
    action: "border-emerald-300/35 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/16",
  },
  recovery: {
    shell: "border-amber-300/40 shadow-[0_18px_46px_rgba(245,158,11,0.16)]",
    wash: "from-amber-300/14 via-transparent to-primary/10",
    icon: "bg-amber-300/14 text-amber-400 ring-amber-300/30",
    portrait: "from-amber-300/85 via-primary/20 to-accent/55",
    action: "border-amber-300/35 bg-amber-300/10 text-amber-400 hover:bg-amber-300/16",
  },
  calm: {
    shell: "border-sky-300/35 shadow-[0_18px_46px_rgba(56,189,248,0.16)]",
    wash: "from-sky-300/14 via-transparent to-primary/10",
    icon: "bg-sky-300/12 text-sky-400 ring-sky-300/25",
    portrait: "from-sky-300/80 via-primary/25 to-accent/60",
    action: "border-sky-300/35 bg-sky-300/10 text-sky-400 hover:bg-sky-300/16",
  },
  hype: {
    shell: "border-fuchsia-300/40 shadow-[0_18px_46px_rgba(217,70,239,0.18)]",
    wash: "from-fuchsia-300/16 via-transparent to-primary/12",
    icon: "bg-fuchsia-300/14 text-fuchsia-400 ring-fuchsia-300/28",
    portrait: "from-fuchsia-300/85 via-primary/30 to-accent/70",
    action: "border-fuchsia-300/35 bg-fuchsia-300/10 text-fuchsia-400 hover:bg-fuchsia-300/16",
  },
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
   action,
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
  const usesGeneratedSceneAvatar = shouldContainCompanionSceneImage(companionImageUrl);

  const updateToastStackOffsets = useCallback(() => {
    const popupElement = popupRef.current;
    if (!popupElement || typeof document === "undefined") return;

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
  }, []);

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

  useEffect(() => {
    return clearCompletionFeedbackToastOffsets;
  }, []);

  useEffect(() => {
    if (!isVisible || typeof window === "undefined") return;

    const popupElement = popupRef.current;
    if (!popupElement) return;

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

    // Leave active offsets in place across re-measurement setup; exit/unmount owns clearing them.
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
  }, [isVisible, updateToastStackOffsets]);

  useEffect(() => {
    if (isVisible) {
      updateToastStackOffsets();
    }
  }, [isVisible, message, mentor?.message, updateToastStackOffsets]);
   
   const handleDismiss = useCallback(() => {
     onDismiss();
   }, [onDismiss]);

  const handleActionSelect = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!action) return;

    event.stopPropagation();
    void Promise.resolve(action.onSelect()).finally(handleDismiss);
  }, [action, handleDismiss]);
   
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
             "relative overflow-hidden rounded-2xl border",
             "bg-card/82 text-card-foreground backdrop-blur-2xl",
             "shadow-lg",
             resolvedToneClassName.shell
           )}>
             <div
               className={cn(
                 "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
                 resolvedToneClassName.wash,
               )}
               aria-hidden="true"
             />
             <div
               className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent"
               aria-hidden="true"
             />
             {/* Main content */}
             <div className="relative flex items-start gap-3.5 p-4">
               {/* Companion portrait */}
               <div className="relative flex-shrink-0">
                 <div className={cn(
                   "rounded-2xl p-[2px]",
                   "bg-gradient-to-br shadow-[0_0_22px_hsl(var(--primary)/0.2)]",
                   resolvedToneClassName.portrait,
                 )}>
                   <Avatar
                     className={cn(
                       usesGeneratedSceneAvatar ? "h-12 w-16" : "h-16 w-16",
                       "rounded-[0.9rem] ring-1 ring-white/18",
                       usesGeneratedSceneAvatar ? "bg-black" : usesPortraitAvatar(companionImageUrl) && "bg-transparent",
                     )}
                   >
                     {companionImageUrl ? (
                       usesPortraitAvatar(companionImageUrl) ? (
                         <CompanionPortraitShell
                           src={companionImageUrl}
                           className="h-full w-full rounded-[0.9rem]"
                         >
                           <CompanionImage 
                             variant="avatar"
                             src={companionImageUrl} 
                             alt={companionName}
                             fit="portrait"
                             focalX={companionImageFocalX}
                             focalY={companionImageFocalY}
                             className="rounded-[0.9rem]"
                           />
                         </CompanionPortraitShell>
                       ) : (
                         <CompanionImage 
                           variant="avatar"
                           src={companionImageUrl} 
                           alt={companionName}
                           fit={usesGeneratedSceneAvatar ? "contain" : "cover"}
                           focalX={companionImageFocalX}
                           focalY={companionImageFocalY}
                           containerAspectRatio={usesGeneratedSceneAvatar ? 4 / 3 : 1}
                           className="rounded-[0.9rem]"
                         />
                       )
                     ) : null}
                     <AvatarFallback className="rounded-[0.9rem] bg-primary/20 text-primary text-lg font-bold">
                       {companionName.charAt(0)}
                     </AvatarFallback>
                   </Avatar>
                 </div>
                 <div
                   className={cn(
                     "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full ring-1",
                     resolvedToneClassName.icon,
                   )}
                   aria-hidden="true"
                 >
                   <Sparkles className="h-3 w-3" />
                 </div>
               </div>
               
               {/* Quote bubble */}
               <div className="flex-1 min-w-0">
                 <div className="space-y-1">
                   <div className="flex items-start gap-2.5">
                     <span
                       className={cn(
                         "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ring-1",
                         resolvedToneClassName.icon,
                       )}
                       aria-hidden="true"
                     >
                       <Sparkles className="h-3.5 w-3.5" />
                     </span>
                     <p className="text-[0.98rem] font-medium leading-relaxed text-foreground">
                       "{message}"
                     </p>
                   </div>
                 </div>
                {mentor?.message ? (
                  <div className="mt-3 border-t border-border/45 pt-2.5">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <UserRound className="h-3 w-3" aria-hidden="true" />
                      <span>{mentor.personality}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      "{mentor.message}"
                    </p>
                  </div>
                ) : null}
                <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
                  {hasCompanionName ? (
                    <p className="text-sm font-medium text-muted-foreground">
                      {companionName}
                    </p>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {action ? (
                    <button
                      type="button"
                      onClick={handleActionSelect}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold",
                        "backdrop-blur-md transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-primary/45 focus:ring-offset-2 focus:ring-offset-background",
                        resolvedToneClassName.action,
                      )}
                      aria-label={action.ariaLabel ?? action.label}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{action.label}</span>
                    </button>
                  ) : null}
                </div>
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
             <div className="relative px-4 pb-3">
               <Progress 
                 value={progress} 
                 className="h-1 bg-foreground/8 shadow-inner"
               />
             </div>
           </div>
         </motion.div>
       )}
     </AnimatePresence>
   );
 });
 
 CompanionTalkPopup.displayName = 'CompanionTalkPopup';
