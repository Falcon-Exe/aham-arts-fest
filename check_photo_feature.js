// Check PHOTO FEATURE registrations
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const Papa = require('papaparse');

const firebaseConfig = {
    apiKey: "AIzaSyDlE8OiYLlgWgVPUqSQiPKpjXVdRDdGLfU",
    authDomain: "aham-arts-fest.firebaseapp.com",
    projectId: "aham-arts-fest",
    storageBucket: "aham-arts-fest.firebasestorage.app",
    messagingSenderId: "1026863889489",
    appId: "1:1026863889489:web:d6e1e2e8c6e1e2e8c6e1e2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWlJXWRlJXWRlJXWRlJXWRlJXWRlJXWRlJXWRlJXWRlJXWRlJXWRl/pub?output=csv";

async function checkPhotoFeature() {
    console.log("Checking PHOTO FEATURE registrations...\n");

    // Get Firestore registrations
    const snapshot = await getDocs(collection(db, "registrations"));
    const firestoreStudents = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const allEvents = [
            ...(data.onStageEvents || []),
            ...(data.offStageEvents || []),
            ...(data.generalEvents || [])
        ];

        if (allEvents.some(e => e.toUpperCase().includes("PHOTO FEATURE"))) {
            firestoreStudents.push({
                name: data.fullName,
                chest: data.chestNumber,
                source: 'Firestore'
            });
        }
    });

    console.log(`Found ${firestoreStudents.length} students in Firestore`);
    firestoreStudents.forEach(s => console.log(`  - ${s.name} (${s.chest})`));

    console.log("\nDone!");
}

checkPhotoFeature().catch(console.error);
