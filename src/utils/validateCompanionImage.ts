import { supabase } from "@/integrations/supabase/client";
import { TimeoutError, withTimeout } from "@/utils/asyncTimeout";

interface GenerateWithValidationResult {
  imageUrl: string;
  validationPassed: boolean;
  retryCount: number;
}

const GENERATION_TIMEOUT_MS = 90_000;

/**
 * Generates a companion image with built-in quality scoring and automatic retry.
 * The generate-companion-image edge function now handles validation internally,
 * so this utility simply invokes it and returns the result.
 */
export async function generateWithValidation(
  params: {
    favoriteColor: string;
    spiritAnimal: string;
    element: string;
    stage: number;
    eyeColor?: string;
    furColor?: string;
    storyTone?: string;
  },
  options: {
    maxRetries?: number;
    onRetry?: (attempt: number) => void;
    onValidating?: () => void;
  } = {}
): Promise<GenerateWithValidationResult> {
  const { onRetry, onValidating } = options;

  // Notify that we're starting generation (which includes validation)
  onValidating?.();

  // Generate the image - the edge function handles quality scoring and retries internally
  let imageResult:
    | {
        imageUrl?: string;
        qualityScore?: {
          overallScore?: number;
          shouldRetry?: boolean;
          retryCount?: number;
        };
      }
    | null = null;
  let imageError: Error | null = null;

  try {
    const invokeResult = await withTimeout(
      () =>
        supabase.functions.invoke("generate-companion-image", {
          body: {
            ...params,
            ...(typeof options.maxRetries === "number" ? { maxInternalRetries: options.maxRetries } : {}),
          },
        }),
      {
        timeoutMs: GENERATION_TIMEOUT_MS,
        operation: "Companion image generation",
        timeoutCode: "GENERATION_TIMEOUT",
      },
    );
    imageResult = (invokeResult?.data ?? null) as typeof imageResult;
    imageError = (invokeResult?.error as Error | null) ?? null;
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new Error(
        "GENERATION_TIMEOUT: Companion creation is taking longer than expected. Please try again.",
      );
    }
    throw error;
  }

  if (imageError) {
    const errorMsg = imageError.message || String(imageError);
    console.error("[Validation] Image generation error:", errorMsg);
    
    // Map error codes to user-friendly messages
    if (errorMsg.includes("INSUFFICIENT_CREDITS") || errorMsg.includes("Insufficient AI credits")) {
      throw new Error("The companion creation service is temporarily unavailable. Please contact support.");
    }
    if (errorMsg.includes("RATE_LIMITED") || errorMsg.includes("busy")) {
      throw new Error("The service is currently busy. Please wait a moment and try again.");
    }
    if (
      errorMsg.includes("AI_TIMEOUT") ||
      errorMsg.includes("GENERATION_TIMEOUT") ||
      errorMsg.toLowerCase().includes("timed out")
    ) {
      throw new Error("GENERATION_TIMEOUT: Companion creation is taking longer than expected. Please try again.");
    }
    if (errorMsg.includes("NO_AUTH_HEADER") || errorMsg.includes("INVALID_AUTH")) {
      throw new Error("Your session has expired. Please refresh the page and try again.");
    }
    
    throw new Error(errorMsg || "Failed to generate companion image. Please try again.");
  }

  if (!imageResult?.imageUrl) {
    console.error("[Validation] No image URL in result:", imageResult);
    throw new Error("Unable to create your companion's image. Please try again.");
  }

  // Extract quality score info from the response (if available)
  const qualityScore = imageResult.qualityScore;
  const retryCount = qualityScore?.retryCount || 0;
  
  // Notify about retries if any occurred
  if (retryCount > 0 && onRetry) {
    onRetry(retryCount);
  }

  // Determine validation status from quality score
  const validationPassed = qualityScore 
    ? (qualityScore.overallScore >= 70 || !qualityScore.shouldRetry)
    : true; // Assume valid if no quality score returned

  console.log(
    `[Validation] Complete - Score: ${qualityScore?.overallScore || 'N/A'}, ` +
    `Retries: ${retryCount}, Passed: ${validationPassed}`
  );

  return {
    imageUrl: imageResult.imageUrl,
    validationPassed,
    retryCount,
  };
}
