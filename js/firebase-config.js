/*
  firebase-config.js
  --------
  Your Firebase project's config. These values identify the project — they
  are not secrets, and are safe to ship in client-side code. Real access
  control comes from Firebase Authentication (who can sign in) and the
  Firestore/Storage security rules (firestore.rules, storage.rules), not
  from hiding this file.

  Where to get these values:
    Firebase console → Project settings (gear icon) → General →
    "Your apps" → Web app → SDK setup and configuration → Config.

  See README.md for the full Firebase setup steps.
*/
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

firebase.initializeApp(firebaseConfig);
