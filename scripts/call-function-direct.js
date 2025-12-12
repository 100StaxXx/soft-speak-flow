/**
 * Direct HTTP call to Firebase callable function
 * This bypasses authentication for testing purposes (if the function allows it)
 * 
 * Note: Callable functions typically require authentication
 * This script uses a direct HTTP POST to the function URL
 */

import https from 'https';
import { URL } from 'url';

const PROJECT_ID = 'cosmiq-prod';
const FUNCTION_NAME = 'generateDailyMentorPepTalks';
const REGION = 'us-central1';

const functionUrl = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}`;

console.log(`🚀 Calling function: ${functionUrl}`);

const data = JSON.stringify({ data: {} });

const url = new URL(functionUrl);
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${responseData}`);
    
    if (res.statusCode === 200 || res.statusCode === 204) {
      console.log('✅ Function called successfully!');
      try {
        const parsed = JSON.parse(responseData);
        console.log('\n📊 Results:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Response (not JSON):', responseData);
      }
    } else {
      console.error('❌ Error:', responseData);
      if (res.statusCode === 401) {
        console.error('\n⚠️  Authentication required. The function requires a valid auth token.');
        console.error('To call this function, you need to:');
        console.error('1. Log in to the app');
        console.error('2. Use the Admin page button');
        console.error('3. Or use a script with Firebase Admin SDK and proper auth');
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(data);
req.end();
