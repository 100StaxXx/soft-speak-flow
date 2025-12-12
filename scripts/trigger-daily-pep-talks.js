/**
 * Script to manually trigger daily pep talk generation
 * Run this from the browser console on the Admin page, or use Node.js with Firebase Admin SDK
 * 
 * Browser console usage:
 * 1. Open Admin page in browser
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 */

// Browser console version - paste this into the browser console
(async () => {
  try {
    console.log('🚀 Triggering daily pep talk generation...');
    
    // Import Firebase functions dynamically (browser)
    const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
    
    // Get your Firebase config from the app
    // For browser console, use the existing Firebase app instance
    const { firebaseApp } = await import('/src/lib/firebase/firebase.ts');
    const functions = getFunctions(firebaseApp);
    const generateDailyPepTalks = httpsCallable(functions, 'generateDailyMentorPepTalks');
    
    const result = await generateDailyPepTalks({});
    
    console.log('✅ Success!', result.data);
    alert(`Daily pep talks generated!\n\nResults: ${JSON.stringify(result.data, null, 2)}`);
  } catch (error) {
    console.error('❌ Error:', error);
    alert(`Error: ${error.message}`);
  }
})();

// Alternative: Simple fetch-based approach for browser console
/*
(async () => {
  const { firebaseAuth } = await import('/src/lib/firebase/auth.ts');
  const user = firebaseAuth.currentUser;
  if (!user) {
    alert('Please log in first');
    return;
  }
  
  const token = await user.getIdToken();
  const functions = getFunctions();
  const url = `https://${functions.region}-${functions.app.options.projectId}.cloudfunctions.net/generateDailyMentorPepTalks`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ data: {} })
  });
  
  const result = await response.json();
  console.log('Result:', result);
  alert('Done! Check console for results');
})();
*/
