interface ValidationRule {
  maxLength?: number;
  minLength?: number;
  sentenceCount?: [number, number];
  requiredFields?: string[];
  outputFormat?: 'json' | 'text';
  arrayLength?: number;
  forbiddenPhrases?: string[];
  mustMentionMood?: boolean;
  mustMentionIntention?: boolean;
  requiredTone?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class OutputValidator {
  private rules: ValidationRule;
  private constraints: Record<string, any>;

  constructor(rules: ValidationRule, constraints: Record<string, any> = {}) {
    this.rules = rules;
    this.constraints = constraints;
  }

  validate(output: string | any, context: Record<string, any> = {}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // JSON format validation
    if (this.rules.outputFormat === 'json') {
      try {
        const parsed = typeof output === 'string' ? JSON.parse(output) : output;
        
        // Array length validation
        if (this.rules.arrayLength && Array.isArray(parsed)) {
          if (parsed.length !== this.rules.arrayLength) {
            errors.push(`Expected ${this.rules.arrayLength} items, got ${parsed.length}`);
          }
        }

        // Required fields validation
        if (this.rules.requiredFields && Array.isArray(parsed)) {
          for (const item of parsed) {
            for (const field of this.rules.requiredFields) {
              if (!(field in item)) {
                errors.push(`Missing required field: ${field}`);
              }
            }
          }
        }

        // Constraint validation for arrays
        if (this.constraints.exactCount && Array.isArray(parsed)) {
          if (parsed.length !== this.constraints.exactCount) {
            errors.push(`Must have exactly ${this.constraints.exactCount} items`);
          }
        }

        // XP range validation (for missions)
        if (this.constraints.xpRange && Array.isArray(this.constraints.xpRange) && Array.isArray(parsed)) {
          const [min, max] = this.constraints.xpRange;
          for (const item of parsed) {
            if (item.xp !== undefined && (item.xp < min || item.xp > max)) {
              errors.push(`XP must be between ${min} and ${max}, got ${item.xp}`);
            }
          }
        }

        // Nested array length validation (e.g., tasks arrays inside objects)
        if (this.constraints.requiredArrayLengths && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const requirements = this.constraints.requiredArrayLengths as Record<string, number>;
          for (const [field, expectedLength] of Object.entries(requirements)) {
            const value = (parsed as Record<string, any>)[field];
            if (Array.isArray(value) && typeof expectedLength === 'number') {
              if (value.length !== expectedLength) {
                errors.push(`Field "${field}" must contain ${expectedLength} items (received ${value.length})`);
              }
            }
          }
        }

      } catch (e) {
        errors.push('Invalid JSON format');
      }
    }

    // Text validation
    if (typeof output === 'string') {
      const text = output;
      
      // Length validation
      if (this.rules.maxLength && text.length > this.rules.maxLength) {
        errors.push(`Text too long: ${text.length} chars (max: ${this.rules.maxLength})`);
      }
      
      if (this.rules.minLength && text.length < this.rules.minLength) {
        errors.push(`Text too short: ${text.length} chars (min: ${this.rules.minLength})`);
      }

      // Sentence count validation
      if (this.rules.sentenceCount) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const [min, max] = this.rules.sentenceCount;
        if (sentences.length < min || sentences.length > max) {
          warnings.push(`Expected ${min}-${max} sentences, got ${sentences.length}`);
        }
      }

      // Forbidden phrases
      if (this.rules.forbiddenPhrases) {
        for (const phrase of this.rules.forbiddenPhrases) {
          if (text.toLowerCase().includes(phrase.toLowerCase())) {
            errors.push(`Contains forbidden phrase: "${phrase}"`);
          }
        }
      }

      // Context-specific validation
      if (this.rules.mustMentionMood && context?.userMood) {
        const mood = String(context.userMood).toLowerCase();
        if (mood && !text.toLowerCase().includes(mood)) {
          warnings.push('Should acknowledge user mood');
        }
      }

      if (this.rules.mustMentionIntention && context?.userIntention) {
        const intention = String(context.userIntention);
        if (intention) {
          // Check if any words from intention appear in response
          const intentionWords = intention.toLowerCase().split(/\s+/);
          const hasIntention = intentionWords.some((word: string) => 
            word.length > 3 && text.toLowerCase().includes(word)
          );
          if (!hasIntention) {
            warnings.push('Should reference user intention');
          }
        }
      }

      // Tone validation (check for tone markers)
      if (this.rules.requiredTone && this.constraints.toneMarkers) {
        const markers = this.constraints.toneMarkers as string[];
        const lowerText = text.toLowerCase();
        const hasAnyMarker = markers.some(marker => {
          // Simple heuristic: check for action words, questions, etc.
          if (marker === 'actionable') {
            return /\b(do|try|start|take|make|create|focus|practice)\b/i.test(text);
          }
          if (marker === 'supportive') {
            return /\b(you can|you've got|proud|good|great|awesome)\b/i.test(text);
          }
          return true; // Default pass for other markers
        });
        
        if (!hasAnyMarker) {
          warnings.push('Response may not match expected tone');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Format validation result for logging
  getValidationSummary(result: ValidationResult): string {
    if (result.isValid && result.warnings.length === 0) {
      return 'All validations passed';
    }
    
    const parts: string[] = [];
    if (result.errors.length > 0) {
      parts.push(`Errors: ${result.errors.join('; ')}`);
    }
    if (result.warnings.length > 0) {
      parts.push(`Warnings: ${result.warnings.join('; ')}`);
    }
    
    return parts.join(' | ');
  }
}
