import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PromptTemplate {
  template_key: string;
  system_prompt: string;
  user_prompt_template: string;
  variables: string[];
  validation_rules: Record<string, unknown>;
  output_constraints: Record<string, unknown>;
}

interface UserPreferences {
  tone_preference: string;
  detail_level: string;
  formality: string;
  avoid_topics: string[];
  preferred_length: string;
  response_style: string;
  // Learned communication preferences
  avg_message_length?: number;
  message_count?: number;
  uses_emojis?: boolean | null;
  prefers_formal_language?: boolean | null;
  prefers_direct_answers?: boolean | null;
  engagement_patterns?: Record<string, number>;
}

interface PromptContext {
  templateKey: string;
  variables: Record<string, unknown>;
  userId?: string;
  mentorTone?: string;
  mentorName?: string;
}

export class PromptBuilder {
  private supabase: ReturnType<typeof createClient>;
  private template: PromptTemplate | null = null;
  private userPrefs: UserPreferences | null = null;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async loadTemplate(templateKey: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('prompt_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new Error(`Template ${templateKey} not found`);
    }

    this.template = data as PromptTemplate;
  }

  async loadUserPreferences(userId: string): Promise<void> {
    const { data } = await this.supabase
      .from('user_ai_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Use defaults if no preferences exist
    this.userPrefs = data || {
      tone_preference: 'balanced',
      detail_level: 'medium',
      formality: 'casual',
      avoid_topics: [],
      preferred_length: 'concise',
      response_style: 'encouraging',
      avg_message_length: 0,
      message_count: 0,
      uses_emojis: null,
      prefers_formal_language: null,
      prefers_direct_answers: null,
      engagement_patterns: {},
    };
  }

  private replaceVariables(text: string, vars: Record<string, unknown>): string {
    let result = text;
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
    return result;
  }

  private applyPersonalization(text: string): string {
    if (!this.userPrefs) return text;

    // Apply tone adjustments
    const toneMap: Record<string, string> = {
      'gentle': 'Use softer language and more encouragement.',
      'direct': 'Be straightforward and concise.',
      'enthusiastic': 'Show high energy and excitement.',
      'balanced': 'Maintain a balanced, supportive tone.'
    };

    // Apply detail level
    const lengthMap: Record<string, number> = {
      'brief': 2,
      'concise': 3,
      'detailed': 5
    };

    let enhanced = text;
    
    // Add personality modifiers based on preferences
    const modifiers: string[] = [];
    
    if (this.userPrefs.tone_preference !== 'balanced') {
      modifiers.push(toneMap[this.userPrefs.tone_preference] || '');
    }
    
    if (this.userPrefs.detail_level === 'brief') {
      modifiers.push('Keep your response extremely concise.');
    } else if (this.userPrefs.detail_level === 'detailed') {
      modifiers.push('Provide more context and examples.');
    }

    if (this.userPrefs.avoid_topics && this.userPrefs.avoid_topics.length > 0) {
      modifiers.push(`Avoid mentioning: ${this.userPrefs.avoid_topics.join(', ')}.`);
    }

    // Apply learned communication style adjustments
    const learnedModifiers = this.getLearnedCommunicationModifiers();
    if (learnedModifiers.length > 0) {
      modifiers.push(...learnedModifiers);
    }

    if (modifiers.length > 0) {
      enhanced = enhanced.replace(/\{\{personalityAdjustments\}\}/g, modifiers.join('\n'));
      enhanced = enhanced.replace(/\{\{personalityModifiers\}\}/g, modifiers.join(' '));
    } else {
      // Remove placeholders if no modifiers
      enhanced = enhanced.replace(/\{\{personalityAdjustments\}\}/g, '');
      enhanced = enhanced.replace(/\{\{personalityModifiers\}\}/g, '');
    }

    // Apply length preferences
    const maxSentences = lengthMap[this.userPrefs.preferred_length] || 3;
    enhanced = enhanced.replace(/\{\{maxSentences\}\}/g, String(maxSentences));
    enhanced = enhanced.replace(/\{\{responseLength\}\}/g, this.userPrefs.preferred_length || 'concise');

    return enhanced;
  }

  // Generate communication style hints based on learned patterns
  private getLearnedCommunicationModifiers(): string[] {
    if (!this.userPrefs || !this.userPrefs.message_count || this.userPrefs.message_count < 5) {
      return []; // Not enough data to make recommendations
    }

    const hints: string[] = [];
    const avgLength = this.userPrefs.avg_message_length || 0;

    // Length-based adjustments
    if (avgLength < 50) {
      hints.push('This user prefers brief exchanges. Keep responses under 3 sentences.');
    } else if (avgLength > 150) {
      hints.push('This user writes detailed messages. You can provide more thorough responses.');
    }

    // Emoji usage
    if (this.userPrefs.uses_emojis === true) {
      hints.push('This user uses emojis - you may include 1-2 relevant emojis occasionally.');
    } else if (this.userPrefs.uses_emojis === false) {
      hints.push('This user does not use emojis. Keep responses text-only.');
    }

    // Formality
    if (this.userPrefs.prefers_formal_language === true) {
      hints.push('This user communicates formally. Avoid slang and maintain professional tone.');
    } else if (this.userPrefs.prefers_formal_language === false) {
      hints.push('This user prefers casual conversation. Use a relaxed, friendly tone.');
    }

    // Direct answers preference
    if (this.userPrefs.prefers_direct_answers === true) {
      hints.push('This user asks direct questions. Lead with the answer, then explain if needed.');
    }

    return hints;
  }

  async build(context: PromptContext): Promise<{ 
    systemPrompt: string; 
    userPrompt: string;
    validationRules: Record<string, unknown>;
    outputConstraints: Record<string, unknown>;
  }> {
    if (!this.template) {
      await this.loadTemplate(context.templateKey);
    }

    if (context.userId) {
      await this.loadUserPreferences(context.userId);
    }

    if (!this.template) {
      throw new Error('Template not loaded');
    }

    // Build base prompts
    let systemPrompt = this.replaceVariables(this.template.system_prompt, context.variables);
    let userPrompt = this.replaceVariables(this.template.user_prompt_template, context.variables);

    // Apply personalization
    systemPrompt = this.applyPersonalization(systemPrompt);
    userPrompt = this.applyPersonalization(userPrompt);

    // Clean up any remaining placeholders
    systemPrompt = systemPrompt.replace(/\{\{[^}]+\}\}/g, '');
    userPrompt = userPrompt.replace(/\{\{[^}]+\}\}/g, '');

    return {
      systemPrompt,
      userPrompt,
      validationRules: this.template.validation_rules || {},
      outputConstraints: this.template.output_constraints || {}
    };
  }

  // These methods are not needed - validation rules and constraints are returned by build()
}
