import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { firebaseConfig } from "./firebase.js";

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
