 /**
  * useTalkPopup - State management for the companion talk popup
  * Handles visibility, message queue, and companion info
  */
 
 import { useState, useCallback, useRef } from "react";
 import { useCompanion } from "@/hooks/useCompanion";
 import { supabase } from "@/integrations/supabase/client";
 
 interface TalkPopupState {
   isVisible: boolean;
   message: string | null;
   companionName: string;
   companionImageUrl: string | null;
 }
 
 interface ShowOptions {
   message: string;
   // Optional overrides for companion info
   companionName?: string;
   companionImageUrl?: string;
 }
 
 // Capitalize first letter of each word
 const capitalizeWords = (str: string): string => {
   return str.replace(/\b\w/g, (char) => char.toUpperCase());
 };
 
 export const useTalkPopup = () => {
   const { companion } = useCompanion();
   const [state, setState] = useState<TalkPopupState>({
     isVisible: false,
     message: null,
     companionName: "Companion",
     companionImageUrl: null,
   });
   
   // Queue for pending messages (future use for priority system)
   const queueRef = useRef<ShowOptions[]>([]);
   const isShowingRef = useRef(false);
 
   // Get companion name using fallback chain
   const getCompanionName = useCallback(async (): Promise<string> => {
     if (!companion) return "Companion";
     
     // 1. Check cached_creature_name (fastest) - use type assertion since column was just added
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
         // Cache it for next time
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
     
     const companionName = options.companionName || await getCompanionName();
     const companionImageUrl = options.companionImageUrl || companion?.current_image_url || null;
     
     setState({
       isVisible: true,
       message: options.message,
       companionName,
       companionImageUrl,
     });
   }, [companion, getCompanionName]);
   
   // Dismiss the current popup and show next in queue
   const dismiss = useCallback(() => {
     setState(prev => ({ ...prev, isVisible: false }));
     isShowingRef.current = false;
     
     // Check queue for next message
     const next = queueRef.current.shift();
     if (next) {
       // Small delay before showing next
       setTimeout(() => show(next), 300);
     }
   }, [show]);
   
   // Clear the queue
   const clearQueue = useCallback(() => {
     queueRef.current = [];
   }, []);
 
   return {
     isVisible: state.isVisible,
     message: state.message,
     companionName: state.companionName,
     companionImageUrl: state.companionImageUrl,
     show,
     dismiss,
     clearQueue,
   };
 };
 
 // Export types for use in other hooks
 export type { ShowOptions, TalkPopupState };
