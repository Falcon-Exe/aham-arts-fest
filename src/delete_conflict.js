import { initializeApp } from "firebase/app";
import { getFirestore, doc, deleteDoc, getDoc } from "firebase/firestore";
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

async function fixConflict() {
    const docId = "GET82LsYJsqbZbTNgktT"; // The incorrect 'Afnan - 256' record
    console.log(`Attempting to delete doc: ${docId}`);

    try {
        const docRef = doc(db, "registrations", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Deleting Record:", data.fullName, "| Chest:", data.chestNumber);
            await deleteDoc(docRef);
            console.log("Successfully deleted.");
        } else {
            console.log("Document does not exist.");
        }
    } catch (e) {
        console.error("Error deleting:", e);
    }
    process.exit();
}

fixConflict();
