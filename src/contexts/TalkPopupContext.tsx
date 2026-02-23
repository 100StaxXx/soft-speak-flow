 /**
  * TalkPopupContext - Global context for the companion talk popup
  * Provides popup state and trigger function to entire app
  */
 
import { createContext, useContext, ReactNode, memo, useState, useCallback, useRef } from "react";
import { useCompanion } from "@/hooks/useCompanion";
import { CompanionTalkPopup } from "@/components/companion/CompanionTalkPopup";
import { resolveCompanionName } from "@/lib/companionName";
 
interface ShowOptions {
  message: string;
  companionName?: string | null;
  companionImageUrl?: string;
}
 
 interface TalkPopupContextType {
   show: (options: ShowOptions) => Promise<void>;
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
  const [companionName, setCompanionName] = useState("");
  const [companionImageUrl, setCompanionImageUrl] = useState<string | null>(null);
   
   // Queue for pending messages
   const queueRef = useRef<ShowOptions[]>([]);
   const isShowingRef = useRef(false);
 
  // Show the popup with a message
  const show = useCallback(async (options: ShowOptions) => {
     // If already showing, add to queue
     if (isShowingRef.current) {
       queueRef.current.push(options);
       return;
     }
     
     isShowingRef.current = true;
     
    const name = await resolveCompanionName({
      companion,
      overrideName: options.companionName,
      fallback: "empty",
    });
    const imageUrl = options.companionImageUrl || companion?.current_image_url || null;
     
     setMessage(options.message);
     setCompanionName(name);
     setCompanionImageUrl(imageUrl);
     setIsVisible(true);
  }, [companion]);
   
   // Dismiss the current popup and show next in queue
   const dismiss = useCallback(() => {
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
     <TalkPopupContext.Provider value={{ show, dismiss, isVisible }}>
       {children}
       <CompanionTalkPopup
         isVisible={isVisible}
         onDismiss={dismiss}
         message={message}
         companionName={companionName}
         companionImageUrl={companionImageUrl}
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
      dismiss: () => {},
      isVisible: false,
    };
  }
  return context;
};
