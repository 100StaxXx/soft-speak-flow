 /**
  * TalkPopupContext - Global context for the companion talk popup
  * Provides popup state and trigger function to entire app
  */
 
 import { createContext, useContext, ReactNode, memo, useState, useCallback, useRef } from "react";
 import { useCompanion } from "@/hooks/useCompanion";
 import { supabase } from "@/integrations/supabase/client";
 import { CompanionTalkPopup } from "@/components/companion/CompanionTalkPopup";
 
 interface ShowOptions {
   message: string;
   companionName?: string;
   companionImageUrl?: string;
 }
 
 interface TalkPopupContextType {
   show: (options: ShowOptions) => Promise<void>;
   dismiss: () => void;
   isVisible: boolean;
 }
 
 const TalkPopupContext = createContext<TalkPopupContextType | null>(null);
 
 // Capitalize first letter of each word
 const capitalizeWords = (str: string): string => {
   return str.replace(/\b\w/g, (char) => char.toUpperCase());
 };
 
 interface TalkPopupProviderProps {
   children: ReactNode;
 }
 
 export const TalkPopupProvider = memo(({ children }: TalkPopupProviderProps) => {
   const { companion } = useCompanion();
   const [isVisible, setIsVisible] = useState(false);
   const [message, setMessage] = useState("");
   const [companionName, setCompanionName] = useState("Companion");
   const [companionImageUrl, setCompanionImageUrl] = useState<string | null>(null);
   
   // Queue for pending messages
   const queueRef = useRef<ShowOptions[]>([]);
   const isShowingRef = useRef(false);
 
   // Get companion name using fallback chain
   const getCompanionName = useCallback(async (): Promise<string> => {
     if (!companion) return "Companion";
     
     // 1. Check cached_creature_name (fastest)
     const cachedName = (companion as any).cached_creature_name;
     if (cachedName) {
       return cachedName;
     }
     
     // 2. Query evolution cards for current stage
     try {
       const { data } = await supabase
         .from('companion_evolution_cards')
         .select('creature_name')
         .eq('companion_id', companion.id)
         .eq('evolution_stage', companion.current_stage)
         .maybeSingle();
       
       if (data?.creature_name) {
         // Cache it for next time (fire and forget)
         supabase
           .from('user_companion')
           .update({ cached_creature_name: data.creature_name })
           .eq('id', companion.id)
           .then(() => {});
         
         return data.creature_name;
       }
     } catch (error) {
       console.error('Failed to fetch creature name:', error);
     }
     
     // 3. Fallback to spirit_animal
     if (companion.spirit_animal) {
       return capitalizeWords(companion.spirit_animal);
     }
     
     // 4. Default
     return "Companion";
   }, [companion]);
   
   // Show the popup with a message
   const show = useCallback(async (options: ShowOptions) => {
     // If already showing, add to queue
     if (isShowingRef.current) {
       queueRef.current.push(options);
       return;
     }
     
     isShowingRef.current = true;
     
     const name = options.companionName || await getCompanionName();
     const imageUrl = options.companionImageUrl || companion?.current_image_url || null;
     
     setMessage(options.message);
     setCompanionName(name);
     setCompanionImageUrl(imageUrl);
     setIsVisible(true);
   }, [companion, getCompanionName]);
   
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