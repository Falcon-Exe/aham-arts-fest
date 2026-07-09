const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc, getDoc } = require("firebase/firestore");
const fs = require('fs');
const path = require('path');

// Parse .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val.replace(/^["']|["']$/g, ''); // strip optional quotes
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const ref = doc(db, "settings", "publicConfig");
  const docSnap = await getDoc(ref);
  console.log("Current Settings:", docSnap.exists() ? docSnap.data() : "No config doc found");

  await setDoc(ref, {
    showPoints: true,
    showHomePoints: true,
    showResultsPoints: true
  }, { merge: true });

  console.log("Settings successfully updated!");
  const updatedSnap = await getDoc(ref);
  console.log("New Settings:", updatedSnap.data());
}

main().catch(console.error);
