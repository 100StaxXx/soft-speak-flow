import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MentorContentSchema = z.object({
  contentType: z.enum(['quote', 'lesson']),
  mentorId: z.string().uuid(),
  count: z.number().int().min(1).max(10).default(1)
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const validation = MentorContentSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validation.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contentType, mentorId, count } = validation.data;
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get mentor details
    const { data: mentor, error: mentorError } = await supabase
      .from("mentors")
      .select("*")
      .eq("id", mentorId)
      .single();

    if (mentorError || !mentor) {
      throw new Error("Mentor not found");
    }

    console.log(`Generating ${contentType} for mentor: ${mentor.name}`);

    let systemPrompt = "";
    let userPrompt = "";

    if (contentType === "quote") {
      systemPrompt = `You are ${mentor.name}, a motivational mentor. Your tone is ${mentor.tone_description}. 
Your style is ${mentor.style || 'supportive'}. You speak to ${mentor.target_user_type || 'people seeking growth'}.

CRITICAL RULES:
- Do NOT use em-dashes (—) or long dashes in any text
- Use only regular hyphens (-) if needed
- Keep quotes concise and powerful (under 150 characters)
- Match the mentor's personality and themes: ${mentor.themes?.join(', ') || 'general motivation'}
- Return ONLY the quote text, nothing else
- Do not include quotation marks
- Do not include attribution or author name`;

      userPrompt = `Generate ${count} powerful, inspiring quote${count > 1 ? 's' : ''} that ${mentor.name} would say. 
Each quote should be unique and reflect their ${mentor.tone_description} tone.
${count > 1 ? 'Separate multiple quotes with ||' : ''}`;
    } else if (contentType === "lesson") {
      systemPrompt = `You are ${mentor.name}, a motivational mentor creating daily lessons. Your tone is ${mentor.tone_description}.
Your teaching style is ${mentor.style || 'supportive and actionable'}.

CRITICAL RULES:
- Do NOT use em-dashes (—) or long dashes in any text
- Use only regular hyphens (-) if needed
- Create practical, actionable lessons
- Match the mentor's personality and themes: ${mentor.themes?.join(', ') || 'personal growth'}
- Return in this exact format: TITLE||DESCRIPTION||CONTENT
- Title should be catchy and under 60 characters
- Description should be one sentence summarizing the lesson
- Content should be 3-4 paragraphs of practical guidance`;

      userPrompt = `Create an inspiring daily lesson that ${mentor.name} would teach. 
Focus on one key concept that helps people grow and take action today.
Remember: NO em-dashes, use regular hyphens only.`;
    } else {
      throw new Error("Invalid content type. Use 'quote' or 'lesson'");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your OpenAI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log("Generated content:", generatedContent);

    // Remove any em-dashes that might have been generated despite instructions
    const cleanedContent = generatedContent.replace(/—/g, '-');

    // Validate output
    const validationRules = contentType === 'quote' 
      ? { maxLength: 150, forbiddenPhrases: ['—', '–'] }
      : { requiredFields: ['title', 'description', 'content'] };
    const validator = new OutputValidator(validationRules, {});
    const validationResult = validator.validate(cleanedContent);

    if (!validationResult.isValid) {
      console.warn('Content validation warnings:', validator.getValidationSummary(validationResult));
    }

    let result;
    if (contentType === "quote") {
      const quotes = cleanedContent.split('||').map((q: string) => q.trim());
      const insertedQuotes = [];

      for (const quoteText of quotes) {
        const { data: insertedQuote, error: insertError } = await supabase
          .from("quotes")
          .insert({
            text: quoteText,
            mentor_id: mentorId,
            category: mentor.themes?.[0] || "motivation",
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting quote:", insertError);
        } else {
          insertedQuotes.push(insertedQuote);
        }
      }

      result = { quotes: insertedQuotes };
    } else if (contentType === "lesson") {
      const [title, description, content] = cleanedContent.split('||').map((s: string) => s.trim());

      const { data: insertedLesson, error: insertError } = await supabase
        .from("lessons")
        .insert({
          title: title || "Daily Lesson",
          description: description || "A lesson for growth",
          content: content || generatedContent,
          mentor_id: mentorId,
          category: mentor.themes?.[0] || "personal-growth",
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      result = { lesson: insertedLesson };
    }

    // Log generation metrics
    const responseTime = Date.now() - startTime;
    await supabase
      .from('ai_output_validation_log')
      .insert({
        template_key: `mentor_content_${contentType}`,
        input_data: { contentType, mentorId, count },
        output_data: result,
        validation_passed: validationResult.isValid,
        validation_errors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-mentor-content:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
