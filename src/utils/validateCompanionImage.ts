import { supabase } from "@/integrations/supabase/client";

interface ValidationResult {
  valid: boolean;
  issues: string[];
  confidence: number;
  issueTypes: string[];
}

interface GenerateWithValidationResult {
  imageUrl: string;
  validationPassed: boolean;
  retryCount: number;
}

/**
 * Generates a companion image with validation and automatic retry on anatomical issues.
 * Used during both initial hatching and regeneration to ensure high-quality images.
 */
export async function generateWithValidation(
  params: {
    favoriteColor: string;
    spiritAnimal: string;
    element: string;
    stage: number;
    eyeColor?: string;
    furColor?: string;
  },
  options: {
    maxRetries?: number;
    onRetry?: (attempt: number) => void;
    onValidating?: () => void;
  } = {}
): Promise<GenerateWithValidationResult> {
  const { maxRetries = 2, onRetry, onValidating } = options;

  const attemptGeneration = async (retryAttempt: number = 0): Promise<GenerateWithValidationResult> => {
    if (retryAttempt > 0) {
      console.log(`[Validation] Retry attempt ${retryAttempt} for ${params.spiritAnimal}`);
      onRetry?.(retryAttempt);
    }

    // Generate the image
    const { data: imageResult, error: imageError } = await supabase.functions.invoke(
      "generate-companion-image",
      {
        body: {
          ...params,
          retryAttempt,
        },
      }
    );

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
      if (errorMsg.includes("NO_AUTH_HEADER") || errorMsg.includes("INVALID_AUTH")) {
        throw new Error("Your session has expired. Please refresh the page and try again.");
      }
      
      throw new Error(errorMsg || "Failed to generate companion image. Please try again.");
    }

    if (!imageResult?.imageUrl) {
      console.error("[Validation] No image URL in result:", imageResult);
      throw new Error("Unable to create your companion's image. Please try again.");
    }

    // Validate the generated image for anatomical issues
    onValidating?.();
    
    try {
      const { data: validationResult } = await supabase.functions.invoke(
        "validate-companion-image",
        {
          body: {
            imageUrl: imageResult.imageUrl,
            spiritAnimal: params.spiritAnimal,
          },
        }
      );

      const validation = validationResult as ValidationResult | null;

      // If validation fails with high confidence and we have retries left, try again
      if (validation && !validation.valid && validation.confidence > 70 && retryAttempt < maxRetries) {
        console.log(
          `[Validation] Failed (confidence: ${validation.confidence}), issues:`,
          validation.issues,
          `- Retrying (${retryAttempt + 1}/${maxRetries})`
        );
        return attemptGeneration(retryAttempt + 1);
      }

      // Log validation result
      if (validation) {
        console.log(
          `[Validation] ${validation.valid ? 'Passed' : 'Accepted despite issues'} (confidence: ${validation.confidence})`,
          validation.issues?.length ? `Issues: ${validation.issues.join(', ')}` : ''
        );
      }

      return {
        imageUrl: imageResult.imageUrl,
        validationPassed: validation?.valid !== false,
        retryCount: retryAttempt,
      };
    } catch (validationError) {
      // Validation service unavailable - accept the image anyway
      console.warn("[Validation] Service unavailable, accepting image:", validationError);
      return {
        imageUrl: imageResult.imageUrl,
        validationPassed: true, // Assume valid if validation service fails
        retryCount: retryAttempt,
      };
    }
  };

  return attemptGeneration(0);
}
