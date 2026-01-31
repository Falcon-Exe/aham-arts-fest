import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listCEvents() {
    try {
        const q = query(collection(db, "events"), where("category", "==", "C"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No events found in Category C.");
            return;
        }

        console.log("\n--- Category C Events ---");
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`- ${data.name}`);
        });
        console.log("-------------------------\n");
    } catch (e) {
        console.error("Error fetching events:", e);
    }
    process.exit();
}

listCEvents();
