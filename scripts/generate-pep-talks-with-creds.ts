/**
 * Script to generate daily pep talks using service account credentials
 * Run with: npx tsx scripts/generate-pep-talks-with-creds.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
// Using native fetch (available in Node.js 18+)

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Service account credentials - load from environment variable or file
// Set GOOGLE_APPLICATION_CREDENTIALS to path of service account JSON file
// OR set FIREBASE_SERVICE_ACCOUNT_JSON to the JSON string
let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
} else {
  console.error('⚠️  Service account credentials not found.');
  console.error('   Set GOOGLE_APPLICATION_CREDENTIALS to path of service account JSON file');
  console.error('   OR set FIREBASE_SERVICE_ACCOUNT_JSON to the JSON string');
  process.exit(1);
}

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount as any),
  projectId: 'cosmiq-prod',
});

const db = getFirestore(app);

// Call Gemini API - using fetch to match the actual function implementation
async function callGemini(prompt: string, systemInstruction: string): Promise<any> {
  // Try multiple sources for the API key (dotenv already loaded at top)
  const apiKey = process.env.GEMINI_API_KEY 
    || process.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('⚠️  GEMINI_API_KEY not found. Please set it as an environment variable:');
    console.error('   export GEMINI_API_KEY=your_key_here');
    console.error('   or add it to .env file');
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  // Combine system instruction with prompt (as the actual function does)
  const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
  const model = 'gemini-2.0-flash-exp'; // Use the same model as the actual function

  // Use fetch like the actual function does
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }],
        }],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini API did not return content");
  }

  return { text };
}

function parseGeminiJSON(text: string): any {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // If parsing fails, try to construct a basic structure
      return {
        script: text,
        title: text.split('\n')[0] || 'Daily Pep Talk',
        summary: text.substring(0, 200),
      };
    }
  }
  return {
    script: text,
    title: 'Daily Pep Talk',
    summary: text.substring(0, 200),
  };
}

async function generateDailyPepTalks(onlyFailed: boolean = false, failedMentorSlugs?: string[]) {
  const today = new Date().toISOString().split("T")[0];
  const allMentorSlugs = ["atlas", "darius", "eli", "nova", "sienna", "lumi", "kai", "stryker", "solace"];
  // If retrying, only process the failed mentors
  const mentorSlugs = onlyFailed && failedMentorSlugs ? failedMentorSlugs : allMentorSlugs;
  const results: any[] = [];

  console.log(`🚀 Generating daily pep talks for ${today}${onlyFailed ? ' (retrying failed ones)' : ''}...\n`);

  for (const mentorSlug of mentorSlugs) {
    try {
      console.log(`Processing ${mentorSlug}...`);

      // Check if already generated (always check to avoid duplicates)
      const existingSnapshot = await db
        .collection("daily_pep_talks")
        .where("mentor_slug", "==", mentorSlug)
        .where("for_date", "==", today)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        console.log(`  ⏭️  Skipped (already exists)`);
        results.push({ mentor: mentorSlug, status: "skipped" });
        continue;
      }

      // Get mentor document
      const mentorSnapshot = await db
        .collection("mentors")
        .where("slug", "==", mentorSlug)
        .limit(1)
        .get();

      if (mentorSnapshot.empty) {
        console.log(`  ❌ Error: Mentor not found`);
        results.push({ mentor: mentorSlug, status: "error", error: "Mentor not found" });
        continue;
      }

      const mentor = mentorSnapshot.docs[0].data();
      const mentorId = mentorSnapshot.docs[0].id;

      console.log(`  📝 Calling AI to generate pep talk...`);

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate pep talk using Gemini
      // Escape any special characters in description that might break JSON
      const mentorDesc = (mentor.description || "motivational and inspiring")
        .replace(/"/g, "'")
        .replace(/\n/g, " ")
        .replace(/\r/g, " ")
        .replace(/\t/g, " ")
        .substring(0, 500); // Limit description length to avoid issues
      
      const prompt = `Generate a daily motivational pep talk for mentor ${mentorSlug}. The mentor's personality is: ${mentorDesc}. Return JSON: {"script": "Full pep talk script (2-3 minutes of speaking)", "title": "Engaging title", "summary": "Brief summary"}`;

      let response;
      let retries = 5; // More retries for persistent errors
      
      // Special handling for sienna - log the prompt for debugging
      if (mentorSlug === 'sienna') {
        console.log(`  🔍 Debug: Prompt length: ${prompt.length} chars`);
        console.log(`  🔍 Debug: Description length: ${mentorDesc.length} chars`);
      }
      while (retries > 0) {
        try {
          response = await callGemini(
            prompt,
            "You are a motivational speaker. Always respond with valid JSON only."
          );
          break;
        } catch (error: any) {
          if ((error.message.includes('429') || error.message.includes('502') || error.message.includes('400')) && retries > 1) {
            // Rate limited or server error - wait and retry
            const waitTime = 15000; // Wait 15 seconds
            console.log(`  ⏳ Error occurred (${error.message.substring(0, 50)}...), waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries--;
          } else {
            throw error;
          }
        }
      }

      // Ensure response was set (TypeScript safety)
      if (!response) {
        throw new Error("Failed to get response from Gemini API after all retries");
      }

      const pepTalk = parseGeminiJSON(response.text);

      if (!pepTalk.script || !pepTalk.title) {
        console.log(`  ❌ Error: Invalid AI response`);
        results.push({ mentor: mentorSlug, status: "error", error: "Invalid response from AI" });
        continue;
      }

      // Save to Firestore
      await db.collection("daily_pep_talks").add({
        mentor_slug: mentorSlug,
        mentor_id: mentorId,
        title: pepTalk.title,
        summary: pepTalk.summary || "",
        script: pepTalk.script,
        audio_url: null,
        for_date: today,
        topic_category: "motivation",
        intensity: "balanced",
        emotional_triggers: [],
        created_at: new Date(),
      });

      console.log(`  ✅ Generated successfully!`);
      results.push({ mentor: mentorSlug, status: "generated" });
      
    } catch (error: any) {
      console.error(`  ❌ Error for ${mentorSlug}:`, error.message);
      results.push({ mentor: mentorSlug, status: "error", error: error.message });
    }
  }

  console.log(`\n📊 Final Results:`, results);
  return results;
}

async function main() {
  try {
    // First attempt
    let results = await generateDailyPepTalks(false);
    
    // If there were errors, retry just the failed ones
    const failedMentors = results.filter(r => r.status === "error").map(r => r.mentor);
    if (failedMentors.length > 0) {
      console.log(`\n🔄 Retrying ${failedMentors.length} failed mentor(s): ${failedMentors.join(', ')}\n`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
      
      // Retry only the failed mentors
      const retryResults = await generateDailyPepTalks(true, failedMentors);
      
      // Update results with retry outcomes
      results = results.map(r => {
        const retry = retryResults.find(rt => rt.mentor === r.mentor);
        return retry || r;
      });
    }
    const successCount = results.filter(r => r.status === "generated").length;
    const skippedCount = results.filter(r => r.status === "skipped").length;
    const errorCount = results.filter(r => r.status === "error").length;
    
    console.log(`\n✅ Script completed!`);
    console.log(`   Generated: ${successCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
