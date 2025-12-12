/**
 * Shared utility for calling Gemini API directly
 * Replaces Lovable AI Gateway calls
 */

interface GeminiConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  model?: string;
}

interface GeminiResponse {
  text: string;
  rawResponse: any;
}

/**
 * Call Gemini API with a prompt
 */
export async function callGemini(
  prompt: string,
  systemPrompt?: string,
  config: GeminiConfig = {},
  apiKey?: string
): Promise<GeminiResponse> {
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const {
    temperature = 0.9,
    topK = 40,
    topP = 0.95,
    maxOutputTokens = 2048,
    model = "gemini-2.0-flash-exp",
  } = config;

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: fullPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          topK,
          topP,
          maxOutputTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", errorText);
    throw new Error(`Gemini API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini API did not return content");
  }

  return {
    text,
    rawResponse: data,
  };
}

/**
 * Parse JSON from Gemini response (handles markdown code blocks)
 */
export function parseGeminiJSON<T = any>(text: string): T {
  try {
    // Extract JSON if wrapped in markdown code blocks
    const jsonMatch =
      text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
      text.match(/(\{[\s\S]*\})/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", text);
    throw new Error("Gemini response was not valid JSON");
  }
}

