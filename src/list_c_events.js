import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { firebaseConfig } from "./firebase.js"; // Adjust import if needed

// Initialize Firebase (using existing config if exportable, otherwise copy-paste)
// Since firebase.js might export 'db' directly:
import { db } from "./firebase.js";

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
