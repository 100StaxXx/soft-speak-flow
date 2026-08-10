 /**
  * TalkPopupContext - Global context for the companion talk popup
  * Provides popup state and trigger function to entire app
  */
 
import { createContext, useContext, ReactNode, memo, useState, useCallback, useRef } from "react";
import { useCompanion } from "@/hooks/useCompanion";
import { CompanionTalkPopup } from "@/components/companion/CompanionTalkPopup";
import { resolveCompanionName } from "@/lib/companionName";
import type { CompletionCompanionTone } from "@/types/completionFeedback";
import type {
  CompanionTalkPopupAction,
  CompanionTalkPopupShowOptions,
} from "@/types/companionTalkPopup";

export type { CompanionTalkPopupAction } from "@/types/companionTalkPopup";
 
 interface TalkPopupContextType {
   show: (options: CompanionTalkPopupShowOptions) => Promise<void>;
   replaceCurrent: (options: CompanionTalkPopupShowOptions, expectedCurrentMessage?: string) => Promise<boolean>;
   dismiss: () => void;
   isVisible: boolean;
 }
 
const TalkPopupContext = createContext<TalkPopupContextType | null>(null);
 
 interface TalkPopupProviderProps {
   children: ReactNode;
 }
 
export const TalkPopupProvider = memo(({ children }: TalkPopupProviderProps) => {
  const { companion } = useCompanion();
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<CompletionCompanionTone | null>(null);
  const [mentor, setMentor] = useState<CompanionTalkPopupShowOptions["mentor"] | null>(null);
  const [action, setAction] = useState<CompanionTalkPopupAction | null>(null);
  const [companionName, setCompanionName] = useState("");
  const [companionImageUrl, setCompanionImageUrl] = useState<string | null>(null);
  const [companionImageFocalX, setCompanionImageFocalX] = useState<number | null>(null);
  const [companionImageFocalY, setCompanionImageFocalY] = useState<number | null>(null);
   
   // Queue for pending messages
   const queueRef = useRef<CompanionTalkPopupShowOptions[]>([]);
   const isShowingRef = useRef(false);
   const currentMessageRef = useRef("");
 
  const applyPopupOptions = useCallback(async (options: CompanionTalkPopupShowOptions) => {
    const name = await resolveCompanionName({
      companion,
      overrideName: options.companionName,
      fallback: "empty",
    });
    const imageUrl = options.companionImageUrl || companion?.current_image_url || null;
    const imageFocalX = options.companionImageFocalX ?? companion?.current_image_focal_x ?? null;
    const imageFocalY = options.companionImageFocalY ?? companion?.current_image_focal_y ?? null;
     
    currentMessageRef.current = options.message;
    setMessage(options.message);
    setTone(options.tone ?? null);
    setMentor(options.mentor ?? null);
    setAction(options.action ?? null);
    setCompanionName(name);
    setCompanionImageUrl(imageUrl);
    setCompanionImageFocalX(imageFocalX);
    setCompanionImageFocalY(imageFocalY);
  }, [companion]);

  // Show the popup with a message
  const show = useCallback(async (options: CompanionTalkPopupShowOptions) => {
     // If already showing, add to queue
     if (isShowingRef.current) {
       queueRef.current.push(options);
       return;
     }
     
     isShowingRef.current = true;
     await applyPopupOptions(options);
     setIsVisible(true);
  }, [applyPopupOptions]);

  const replaceCurrent = useCallback(async (
    options: CompanionTalkPopupShowOptions,
    expectedCurrentMessage?: string,
  ): Promise<boolean> => {
    if (!isShowingRef.current) return false;
    if (expectedCurrentMessage && currentMessageRef.current !== expectedCurrentMessage) return false;

    await applyPopupOptions(options);
    setIsVisible(true);
    return true;
  }, [applyPopupOptions]);
   
   // Dismiss the current popup and show next in queue
   const dismiss = useCallback(() => {
     currentMessageRef.current = "";
     setIsVisible(false);
     isShowingRef.current = false;
     
     // Check queue for next message
     const next = queueRef.current.shift();
     if (next) {
       // Small delay before showing next
       setTimeout(() => show(next), 300);
     }
   }, [show]);
 
   return (
     <TalkPopupContext.Provider value={{ show, replaceCurrent, dismiss, isVisible }}>
       {children}
       <CompanionTalkPopup
         isVisible={isVisible}
         onDismiss={dismiss}
         message={message}
         tone={tone}
         mentor={mentor}
         action={action}
         companionName={companionName}
         companionImageUrl={companionImageUrl}
         companionImageFocalX={companionImageFocalX}
         companionImageFocalY={companionImageFocalY}
       />
     </TalkPopupContext.Provider>
   );
 });
 
 TalkPopupProvider.displayName = 'TalkPopupProvider';
 
 export const useTalkPopupContext = () => {
   const context = useContext(TalkPopupContext);
   if (!context) {
     throw new Error('useTalkPopupContext must be used within TalkPopupProvider');
   }
   return context;
 };

// Safe version that returns no-op functions when context is unavailable
// Use this in hooks/components that may render outside the provider
export const useTalkPopupContextSafe = () => {
  const context = useContext(TalkPopupContext);
  if (!context) {
    return {
      show: async () => {},
      replaceCurrent: async () => false,
      dismiss: () => {},
      isVisible: false,
    };
  }
  return context;
};
