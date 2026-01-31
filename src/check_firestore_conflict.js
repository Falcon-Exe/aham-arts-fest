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

async function checkFirestore() {
    console.log("Checking Firestore...");
    try {
        const q = query(collection(db, "registrations"));
        const snapshot = await getDocs(q);

        console.log(`Total Firestore Registrations: ${snapshot.size}`);

        snapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.fullName || "").toLowerCase();
            const chest = (data.chestNumber || "").toString();

            if (name.includes("afnan") || name.includes("rafih") || chest === "256") {
                console.log("------------------------");
                console.log(`ID: ${doc.id}`);
                console.log(`Name: ${data.fullName}`);
                console.log(`Chest: ${data.chestNumber}`);
                console.log(`Team: ${data.team}`);
            }
        });
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit();
}

checkFirestore();
