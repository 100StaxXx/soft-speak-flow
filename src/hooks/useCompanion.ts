import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocument, setDocument, updateDocument, getDocuments, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { useAchievements } from "./useAchievements";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import { useRef, useMemo, useCallback } from "react";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useEvolutionThresholds } from "./useEvolutionThresholds";
import { SYSTEM_XP_REWARDS } from "@/config/xpRewards";
import type { CompleteReferralStage3Result, CreateCompanionIfNotExistsResult } from "@/types/referral-functions";
import { logger } from "@/utils/logger";
import { completeReferralStage3 } from "@/lib/firebase/functions";

export interface Companion {
  id: string;
  user_id: string;
  favorite_color: string;
  spirit_animal: string;
  core_element: string;
  current_stage: number;
  current_xp: number;
  current_image_url: string | null;
  eye_color?: string;
  fur_color?: string;
  body?: number;
  mind?: number;
  soul?: number;
  last_energy_update?: string;
  display_name?: string; // Generated companion name
  created_at: string;
  updated_at: string;
}

export const XP_REWARDS = SYSTEM_XP_REWARDS;

export const useCompanion = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkCompanionAchievements } = useAchievements();
  const { isEvolvingLoading, setIsEvolvingLoading } = useEvolution();
  const { getThreshold, shouldEvolve } = useEvolutionThresholds();

  // Prevent duplicate evolution/XP/companion creation requests during lag
  const evolutionInProgress = useRef(false);
  const evolutionPromise = useRef<Promise<unknown> | null>(null);
  const xpInProgress = useRef(false);
  const companionCreationInProgress = useRef(false);

  const { data: companion, isLoading, error } = useQuery({
    queryKey: ["companion", user?.uid],
    queryFn: async () => {
      if (!user) return null;
      
      const data = await getDocument<Companion>("user_companion", user.uid);
      
      if (!data) return null;
      
      // Convert Firestore timestamps to ISO strings
      return {
        ...data,
        created_at: timestampToISO(data.created_at as any) || data.created_at || new Date().toISOString(),
        updated_at: timestampToISO(data.updated_at as any) || data.updated_at || new Date().toISOString(),
        last_energy_update: timestampToISO(data.last_energy_update as any) || data.last_energy_update || undefined,
      } as Companion;
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds - prevents unnecessary refetches
    retry: 3, // Increased from 2 to 3 for better reliability after onboarding
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });

  const createCompanion = useMutation({
    mutationFn: async (data: {
      favoriteColor: string;
      spiritAnimal: string;
      coreElement: string;
      storyTone: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Prevent duplicate companion creation during rapid clicks
      if (companionCreationInProgress.current) {
        throw new Error("Companion creation already in progress");
      }
      companionCreationInProgress.current = true;

      try {
        logger.log("Starting companion creation process...");

        // Determine consistent colors for the companion's lifetime
        const eyeColor = `glowing ${data.favoriteColor}`;
        const furColor = data.favoriteColor;

        // Use placeholder image for now (will be replaced with Firebase Cloud Function later)
        logger.log("Using placeholder companion image...");
        const imageData = {
          imageUrl: "/placeholder-companion.svg" // Placeholder image - will be replaced with generated image later
        };

      logger.log("Creating companion record in Firestore...");

        // Check if companion already exists
        const existingCompanion = await getDocument("user_companion", user.uid);
        let companionData: any;
        let isNewCompanion = false;

        if (existingCompanion) {
          // Companion already exists, return existing data
          logger.log("Companion already exists, returning existing data");
          companionData = existingCompanion;
          isNewCompanion = false;
        } else {
          // Create new companion
          const companionId = user.uid; // Use user ID as companion ID
          
          // Generate AI companion name via Cloud Function
          let displayName: string | null = null;
          try {
            const { getFunctions, httpsCallable } = await import("firebase/functions");
            const { firebaseApp } = await import("@/lib/firebase");
            
            const functions = getFunctions(firebaseApp);
            const generateCompanionName = httpsCallable(functions, "generateCompanionName");
            
            const result = await generateCompanionName({
              spiritAnimal: data.spiritAnimal,
              favoriteColor: data.favoriteColor,
              coreElement: data.coreElement,
              userAttributes: {
                body: 0,
                mind: 0,
                soul: 0,
              },
            });
            
            const nameData = result.data as { name?: string };
            if (nameData?.name) {
              displayName = nameData.name;
              logger.log("Generated AI companion name:", displayName);
            }
          } catch (nameError) {
            logger.warn("Failed to generate AI companion name (non-critical):", nameError);
            // Continue without name - it can be generated later
          }
          
          const newCompanion = {
            id: companionId,
            user_id: user.uid,
            favorite_color: data.favoriteColor,
            spirit_animal: data.spiritAnimal,
            core_element: data.coreElement,
            story_tone: data.storyTone,
            current_image_url: imageData.imageUrl,
            initial_image_url: imageData.imageUrl,
            eye_color: eyeColor,
            fur_color: furColor,
            current_stage: 0,
            current_xp: 0,
            body: 0,
            mind: 0,
            soul: 0,
            ...(displayName && { display_name: displayName }),
          };
          
          logger.log("Writing companion to Firestore:", { companionId, newCompanion });
          try {
            await setDocument("user_companion", companionId, newCompanion, false);
            logger.log("Companion created successfully in Firestore");
          } catch (firestoreError) {
            logger.error("Firestore write error:", firestoreError);
            throw new Error(`Failed to create companion in Firestore: ${firestoreError instanceof Error ? firestoreError.message : String(firestoreError)}`);
          }
          companionData = { ...newCompanion, is_new: true };
          isNewCompanion = true;
        }

      logger.log(`Companion ${isNewCompanion ? 'created' : 'already exists'}:`, companionData.id);

        // Check if stage 0 evolution exists (regardless of whether companion is new)
        const existingEvolutions = await getDocuments(
          "companion_evolutions",
          [
            ["companion_id", "==", companionData.id],
            ["stage", "==", 0],
          ]
        );

        // Create stage 0 evolution if missing
        if (existingEvolutions.length === 0) {
          logger.log("Creating stage 0 evolution...");
          const evolutionId = `${companionData.id}_stage_0`;
          try {
            await setDocument("companion_evolutions", evolutionId, {
              id: evolutionId,
              companion_id: companionData.id,
              stage: 0,
              image_url: imageData.imageUrl,
              xp_at_evolution: 0,
            }, false);
            logger.log("Stage 0 evolution created successfully");
          } catch (evolutionError) {
            logger.error("Failed to create stage 0 evolution (non-critical):", evolutionError);
            // Don't throw - evolution creation is not critical for companion creation
          }

        // Generate stage 0 card in background (don't await - don't block onboarding)
        const generateStageZeroCard = async () => {
          try {
            const fullCompanionData = await getDocument("user_companion", companionData.id);
            
            // Get evolution ID for stage 0
            const evolutionRecords = await getDocuments(
              "companion_evolutions",
              [
                ["companion_id", "==", companionData.id],
                ["stage", "==", 0],
              ]
            );
            
            const evolutionId = evolutionRecords[0]?.id || `${companionData.id}_stage_0`;
            
            // Call Firebase Cloud Function to generate evolution card
            const { generateEvolutionCard } = await import("@/lib/firebase/functions");
            await generateEvolutionCard({
              companionId: companionData.id,
              evolutionId,
              stage: 0,
              species: fullCompanionData?.spirit_animal || "Unknown",
              element: fullCompanionData?.core_element || "Unknown",
              color: fullCompanionData?.favorite_color || "#000000",
              userAttributes: {
                mind: fullCompanionData?.mind || 0,
                body: fullCompanionData?.body || 0,
                soul: fullCompanionData?.soul || 0,
              },
            });
            
            queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
          } catch (cardError) {
            console.error("Stage 0 card generation failed (non-critical):", cardError);
          }
        };

        generateStageZeroCard(); // Fire and forget - don't block onboarding
      }

      // Generate story only for new companions
      if (isNewCompanion) {
        // Auto-generate the first chapter of the companion's story in background with retry
        const generateStoryWithRetry = async (attempts = 3) => {
          for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
              const { generateCompanionStory } = await import("@/lib/firebase/functions");
              await generateCompanionStory({
                companionId: companion.id,
                stage: 0,
              });
              logger.log("Stage 0 story generated successfully");
              queryClient.invalidateQueries({ queryKey: ["companion-story"] });
              queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
              return;
            } catch (storyError) {
              const errorMessage = storyError instanceof Error ? storyError.message : String(storyError);
              const isTransient = errorMessage.includes('network') ||
                                 errorMessage.includes('timeout') ||
                                 errorMessage.includes('temporarily unavailable');

              if (attempt < attempts && isTransient) {
                logger.log(`Story generation attempt ${attempt} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                continue;
              }

              console.error(`Failed to auto-generate stage 0 story after ${attempt} attempts:`, storyError);
              break;
            }
          }
        };

        // Start story generation in background (don't await)
        generateStoryWithRetry().catch((error) => {
          console.warn('Story generation failed (non-critical):', error?.message || error);
        });
      }

      return companionData;
      } catch (error) {
        // Reset flag on error
        companionCreationInProgress.current = false;
        throw error;
      }
    },
    onSuccess: () => {
      companionCreationInProgress.current = false;
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      logger.log("Companion creation successful!");
      // Don't show toast here - let the parent component handle success message
    },
    onError: (error) => {
      companionCreationInProgress.current = false;
      console.error("Failed to create companion:", error);
      // Don't show toast here - let the parent component handle error display
    },
  });

  const awardXP = useMutation({
    mutationFn: async ({
      eventType,
      xpAmount,
      metadata = {},
    }: {
      eventType: string;
      xpAmount: number;
      metadata?: Record<string, string | number | boolean | undefined>;
    }) => {
      if (!user) throw new Error("No user found");
      
      // Prevent duplicate XP awards - check and set flag IMMEDIATELY before any async operations
      if (xpInProgress.current) {
        throw new Error("XP award already in progress");
      }
      xpInProgress.current = true;
      
      try {
        // CRITICAL: Ensure companion is loaded before awarding XP
        let companionToUse = companion;
        
        if (!companionToUse) {
          logger.warn('Companion not loaded yet, fetching...');
          // Refetch companion data and wait for it to complete
          await queryClient.refetchQueries({ queryKey: ["companion", user.uid] });
          companionToUse = queryClient.getQueryData(["companion", user.uid]) as Companion | null;
          
          if (!companionToUse) {
            throw new Error("No companion found. Please create one first.");
          }
        }
        
        return await performXPAward(companionToUse, xpAmount, eventType, metadata, user);
      } finally {
        // Always reset flag in finally block to ensure cleanup
        xpInProgress.current = false;
      }
    },
    onSuccess: async ({ shouldEvolve, newStage, newXP }) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      
      if (shouldEvolve && companion) {
        // Check for companion stage achievements
        await checkCompanionAchievements(newStage);
        
        // Show overlay immediately BEFORE toast
        setIsEvolvingLoading(true);
        
        // Notify walkthrough that evolution loading has started (for hiding tooltips)
        window.dispatchEvent(new CustomEvent('evolution-loading-start'));
        
        toast.success("🎉 Your companion is ready to evolve!");
        // Trigger evolution
        evolveCompanion.mutate({ newStage, currentXP: newXP });
      }
    },
    onError: (error) => {
      console.error('XP award failed:', error);
      toast.error("Failed to award XP. Please try again.");
    },
  });

  // Helper function to perform XP award logic
  const performXPAward = async (
    companionData: Companion,
    xpAmount: number,
    eventType: string,
    metadata: Record<string, string | number | boolean | undefined>,
    currentUser: typeof user
  ) => {
    if (!currentUser?.uid) {
      throw new Error("Not authenticated");
    }
    // Note: xpInProgress flag is managed by the caller (awardXP mutation)
    // Setting it here would cause issues with error handling

    const newXP = companionData.current_xp + xpAmount;
    const nextStage = companionData.current_stage + 1;
    const nextThreshold = getThreshold(nextStage);
    
    logger.log('[XP Award Debug]', {
      currentStage: companionData.current_stage,
      currentXP: companionData.current_xp,
      xpAmount,
      newXP,
      nextStage,
      nextThreshold,
      willEvolve: nextThreshold && newXP >= nextThreshold
    });
    
    // Check if evolution is needed using centralized logic
    const shouldEvolveNow = shouldEvolve(companionData.current_stage, newXP);
    let newStage = companionData.current_stage;
    
    if (shouldEvolveNow) {
      newStage = nextStage;
      logger.log('[Evolution Triggered]', { newStage, newXP, nextThreshold });
    }

    // XP events are logged server-side via triggers/functions
    // Client-side insert removed due to RLS policy restrictions


    // Update companion XP
    await updateDocument("user_companion", companionData.id, {
      current_xp: newXP,
    });

    return { shouldEvolve: shouldEvolveNow, newStage, newXP };
  };


  // Helper function to validate referral when user reaches Stage 3
  const validateReferralAtStage3 = async () => {
    if (!user) return;

    try {
      // Check if user was referred by someone
      const profile = await getDocument<{ referred_by: string | null }>("profiles", user.uid);

      if (!profile?.referred_by) return;

      // FIX Bugs #14, #16, #17, #21, #24: Use atomic function with retry logic and type safety
      const result = await retryWithBackoff<CompleteReferralStage3Result>(
        async () => {
          const response = await completeReferralStage3({
            referee_id: user.uid,
            referrer_id: profile.referred_by
          });
          // Map response to match CompleteReferralStage3Result type
          return {
            success: response.success,
            reason: response.reason,
            message: response.message,
            new_count: response.newCount,
            milestone_reached: response.milestoneReached,
            skin_unlocked: response.skinUnlocked,
          } as CompleteReferralStage3Result;
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          shouldRetry: (error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            
            // Don't retry business logic errors
            if (msg.includes('already_completed') ||
                msg.includes('concurrent_completion') ||
                msg.includes('not found')) {
              return false;
            }
            
            // Retry network/transient errors
            return msg.includes('network') ||
                   msg.includes('timeout') ||
                   msg.includes('temporarily unavailable') ||
                   msg.includes('connection') ||
                   msg.includes('ECONNRESET') ||
                   msg.includes('fetch');
          }
        }
      );

      if (!result || !result.success) {
        // Referral already completed or concurrent request (not an error)
        logger.log('Referral not completed:', result?.reason ?? 'unknown', result?.message ?? '');
        return;
      }

      // Success! Log the result with safe access
      logger.log('Referral completed successfully:', {
        newCount: result.new_count ?? 0,
        milestoneReached: result.milestone_reached ?? false,
        skinUnlocked: result.skin_unlocked ?? false
      });

    } catch (error) {
      console.error("Failed to validate referral after retries:", error);
      // Don't throw - this shouldn't block evolution
    }
  };

  const evolveCompanion = useMutation({
    mutationFn: async ({ newStage, currentXP }: { newStage: number; currentXP: number }) => {
      // Prevent duplicate evolution requests - wait for any ongoing evolution
      if (evolutionInProgress.current) {
        logger.log('Evolution already in progress, rejecting duplicate request');
        if (evolutionPromise.current) {
          // Wait for existing evolution to complete
          await evolutionPromise.current;
        }
        // Return null to indicate this call was skipped
        return null;
      }

      // Set flag immediately before any async operations
      evolutionInProgress.current = true;

      // Create a promise to track this evolution
      const evolutionExecution = (async () => {
        if (!user || !companion) {
          evolutionInProgress.current = false;
          throw new Error("No companion found");
        }

        setIsEvolvingLoading(true);

        try {
        // Update companion stage and XP in Firestore
        const oldStage = companion.current_stage;
        
        await updateDocument('user_companion', companion.id, {
          current_stage: newStage,
          current_xp: currentXP,
        });

        logger.log(`Companion evolved from stage ${oldStage} to stage ${newStage}`);

        // FIX Bug #9: Check if we CROSSED Stage 3 (not just landed on it)
        // This handles cases where user skips from Stage 2 to Stage 4+
        if (oldStage < 3 && newStage >= 3) {
          await validateReferralAtStage3();
        }

        // Create evolution record
        const evolutionId = `${companion.id}_stage_${newStage}_${Date.now()}`;
        await setDocument('companion_evolutions', evolutionId, {
          id: evolutionId,
          companion_id: companion.id,
          stage: newStage,
          image_url: companion.current_image_url || null,
          xp_at_evolution: currentXP,
          evolved_at: new Date().toISOString(),
        }, false);

        // Generate evolution cards for all stages up to current stage
        try {
          // Check which cards already exist
          const existingCards = await getDocuments(
            "companion_evolution_cards",
            [["companion_id", "==", companion.id]]
          );

          const existingStages = new Set(existingCards?.map((c: any) => c.evolution_stage) || []);

          // Generate cards for missing stages (stage 0 through current stage)
          for (let stage = 0; stage <= newStage; stage++) {
            if (!existingStages.has(stage)) {
              logger.log(`Generating card for stage ${stage}`);
              
              // Get the evolution record for this stage
              const evolutionRecords = await getDocuments(
                "companion_evolutions",
                [
                  ["companion_id", "==", companion.id],
                  ["stage", "==", stage],
                ]
              );
              
              // Special handling for stage 0 - ensure evolution record exists
              let stageEvolutionId = evolutionRecords[0]?.id;
              
              if (stage === 0 && evolutionRecords.length === 0) {
                logger.log("Stage 0 evolution record not found, creating one...");
                
                // Get the companion's initial image
                const companionData = await getDocument("user_companion", companion.id);
                
                // Create stage 0 evolution record
                const evolutionId = `${companion.id}_stage_0`;
                await setDocument("companion_evolutions", evolutionId, {
                  id: evolutionId,
                  companion_id: companion.id,
                  stage: 0,
                  image_url: companionData?.initial_image_url || null,
                  xp_at_evolution: 0,
                  evolved_at: companionData?.created_at || new Date().toISOString(),
                }, false);
                
                stageEvolutionId = evolutionId;
                logger.log("Created stage 0 evolution record:", stageEvolutionId);
              }
              
              // Generate evolution card using Firebase Cloud Function
              if (stageEvolutionId) {
                const companionData = await getDocument("user_companion", companion.id);
                const { generateEvolutionCard } = await import("@/lib/firebase/functions");
                await generateEvolutionCard({
                  companionId: companion.id,
                  evolutionId: stageEvolutionId,
                  stage: stage,
                  species: companionData?.spirit_animal || "Unknown",
                  element: companionData?.core_element || "Unknown",
                  color: companionData?.favorite_color || "#000000",
                  userAttributes: {
                    mind: companionData?.mind || 0,
                    body: companionData?.body || 0,
                    soul: companionData?.soul || 0,
                  },
                });
                logger.log(`Generated evolution card for stage ${stage}`);
              }
            }
          }
        } catch (cardError) {
          console.error("Failed to generate evolution card:", cardError);
          // Don't fail the evolution if card generation fails
        }

        // Auto-generate story chapter for this evolution stage
        const existingStories = await getDocuments(
          "companion_stories",
          [
            ["companion_id", "==", companion.id],
            ["stage", "==", newStage],
          ]
        );

        if (existingStories.length === 0) {
          // Generate story chapter in the background - properly handled promise
          (async () => {
            try {
              const { generateCompanionStory } = await import("@/lib/firebase/functions");
              await generateCompanionStory({
                companionId: companion.id,
                stage: newStage,
              });
              logger.log(`Generated story for stage ${newStage}`);
              queryClient.invalidateQueries({ queryKey: ["companion-story"] });
              queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.warn(`Failed to auto-generate story for stage ${newStage} (non-critical):`, errorMessage);
              // Don't throw - story generation is not critical to evolution
            }
          })().catch((error) => {
            console.warn('Story generation promise rejected:', error?.message || error);
          });
        }

        return companion.current_image_url || null;
        } catch (error) {
          evolutionInProgress.current = false;
          setIsEvolvingLoading(false);
          throw error;
        }
      })();

      // Track the promise for race condition prevention
      evolutionPromise.current = evolutionExecution;

      try {
        return await evolutionExecution;
      } finally {
        evolutionPromise.current = null;
      }
    },
    onSuccess: (imageUrl) => {
      evolutionInProgress.current = false;
      // Only invalidate queries if evolution actually happened
      if (imageUrl) {
        // Don't hide overlay here - let CompanionEvolution handle it
        // The overlay will remain visible until the animation completes
        queryClient.invalidateQueries({ queryKey: ["companion"] });
        queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
        queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
      }
    },
    onError: (error) => {
      evolutionInProgress.current = false;
      setIsEvolvingLoading(false);
      console.error("Evolution failed:", error);
      toast.error(error instanceof Error ? error.message : "Unable to evolve your companion. Please try again.");
    },
  });

  // Memoize calculated values to prevent unnecessary recalculations
  const nextEvolutionXP = useMemo(() => {
    if (!companion) return null;
    return getThreshold(companion.current_stage + 1);
  }, [companion, getThreshold]);

  const progressToNext = useMemo(() => {
    if (!companion || !nextEvolutionXP) return 0;
    return ((companion.current_xp / nextEvolutionXP) * 100);
  }, [companion, nextEvolutionXP]);

  return {
    companion,
    isLoading,
    error,
    createCompanion,
    awardXP,
    evolveCompanion,
    nextEvolutionXP,
    progressToNext,
    isEvolvingLoading,
  };
};