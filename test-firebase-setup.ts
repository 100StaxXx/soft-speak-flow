/**
 * Test script to verify Firebase setup and Functions
 * Run with: npx tsx test-firebase-setup.ts
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env.local") });

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

console.log("🧪 Testing Firebase Setup...\n");

// Test 1: Verify environment variables
console.log("1️⃣ Checking environment variables...");
const requiredVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

let allVarsPresent = true;
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (!value || value.includes("your_") || value.includes("placeholder")) {
    console.log(`   ❌ ${varName}: Missing or placeholder`);
    allVarsPresent = false;
  } else {
    console.log(`   ✅ ${varName}: Set (${value.substring(0, 20)}...)`);
  }
}

if (!allVarsPresent) {
  console.error("\n❌ Missing required environment variables!");
  process.exit(1);
}

// Test 2: Initialize Firebase
console.log("\n2️⃣ Initializing Firebase...");
try {
  const app = initializeApp(firebaseConfig);
  console.log("   ✅ Firebase app initialized");
} catch (error) {
  console.error("   ❌ Failed to initialize Firebase:", error);
  process.exit(1);
}

// Test 3: Initialize Auth
console.log("\n3️⃣ Testing Firebase Auth...");
try {
  const auth = getAuth();
  console.log("   ✅ Firebase Auth initialized");
  
  // Try anonymous sign-in for testing
  console.log("   🔐 Attempting anonymous sign-in...");
  const userCredential = await signInAnonymously(auth);
  console.log(`   ✅ Signed in anonymously: ${userCredential.user.uid}`);
} catch (error: any) {
  console.error("   ❌ Auth test failed:", error.message);
  // Don't exit - auth might require different setup
}

// Test 4: Test Firebase Functions
console.log("\n4️⃣ Testing Firebase Functions...");
try {
  const functions = getFunctions();
  const testApiKeys = httpsCallable(functions, "testApiKeys");
  
  console.log("   📞 Calling testApiKeys function...");
  const result = await testApiKeys({});
  const data = result.data as any;
  
  if (data.success) {
    console.log("   ✅ testApiKeys function called successfully");
    console.log(`   📋 Message: ${data.message}`);
    console.log(`   🔑 Keys configured: ${data.allConfigured ? "✅ All" : "⚠️ Some missing"}`);
    
    if (data.keys) {
      console.log("   🔐 Key status:");
      for (const [key, value] of Object.entries(data.keys)) {
        const status = value ? "✅" : "❌";
        console.log(`      ${status} ${key}: ${value ? "Configured" : "Missing"}`);
      }
    }
  } else {
    console.error("   ❌ testApiKeys returned error:", data.message);
  }
} catch (error: any) {
  console.error("   ❌ Functions test failed:", error.message);
  if (error.code === "functions/unauthenticated") {
    console.log("   💡 Note: Function requires authentication");
  }
}

console.log("\n✅ Firebase setup test complete!");
console.log("\n📝 Next steps:");
console.log("   - Start dev server: npm run dev");
console.log("   - Check browser console for any errors");
console.log("   - Verify app loads correctly");

