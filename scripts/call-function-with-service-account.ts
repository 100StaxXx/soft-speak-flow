/**
 * Script to call Firebase callable function using service account
 * This creates a custom token and uses it to call the function
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as https from 'https';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';

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

const auth = getAuth(app);

async function getAccessToken(): Promise<string> {
  // Get an OAuth2 access token using the service account
  const jwtPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  const jwtToken = jwt.sign(jwtPayload, serviceAccount.private_key, {
    algorithm: 'RS256',
  });

  return new Promise((resolve, reject) => {
    const data = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwtToken)}`;

    const options = {
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed.access_token);
          } catch (e) {
            reject(new Error('Failed to parse access token response'));
          }
        } else {
          reject(new Error(`Failed to get access token: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function callFunction(accessToken: string): Promise<any> {
  // Create a custom token for a user, then use that to call the function
  // Actually, for callable functions, we need a user ID token, not service account
  
  // Better approach: Use the service account to directly invoke via HTTP with proper auth
  // But callable functions expect user auth... 
  
  // Let's try creating a custom token for a test user
  // We'll use a placeholder UID - but this requires the user to exist
  
  // Actually, the simplest is to call it as an HTTP function using the service account token
  // But wait - the function checks request.auth which requires a Firebase user token
  
  // Let me check the function again - it uses onCall which requires user authentication
  // Service accounts can't directly call callable functions
  
  // Alternative: Call the scheduled function logic directly via Firestore triggers
  // Or: Temporarily modify the function to allow service account calls
  
  console.log('⚠️  Note: Callable functions require user authentication, not service account.');
  console.log('To trigger this, you need to either:');
  console.log('1. Use the Admin UI in the app (requires login)');
  console.log('2. Create a test user and get their ID token');
  console.log('3. Temporarily modify the function to allow service account calls');
  
  // For now, let's try to get the GEMINI_API_KEY from Firebase Functions secrets
  // and call the generation logic directly
  
  throw new Error('Cannot call callable function with service account - need user auth');
}

async function main() {
  try {
    console.log('🚀 Attempting to trigger daily pep talk generation...\n');
    
    const accessToken = await getAccessToken();
    console.log('✅ Got access token');
    
    await callFunction(accessToken);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Alternative: The function needs user authentication.');
    console.log('The easiest way is to use the Admin page button in the app.');
    process.exit(1);
  }
}

main();
