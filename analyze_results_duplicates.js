import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// Firebase configuration (from your firebase.js)
const firebaseConfig = {
    apiKey: "AIzaSyDCKiNdvVPE-nqJqxH7TIvmCOmxqFqMqGE",
    authDomain: "aham-arts-fest.firebaseapp.com",
    projectId: "aham-arts-fest",
    storageBucket: "aham-arts-fest.firebasestorage.app",
    messagingSenderId: "1091667024869",
    appId: "1:1091667024869:web:e7f2e0e1a7e7e7e7e7e7e7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function analyzeDuplicateResults() {
    console.log("📊 Analyzing Results Collection for Duplicates...\n");

    // Fetch all results
    const resultsSnapshot = await getDocs(collection(db, "results"));
    const results = resultsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    console.log(`Total results in database: ${results.length}\n`);

    // Group by student name
    const nameMap = new Map();
    results.forEach(result => {
        const name = (result.name || '').trim();
        if (!name) return;

        if (!nameMap.has(name)) {
            nameMap.set(name, []);
        }
        nameMap.get(name).push(result);
    });

    // Find duplicates (same name, different chest numbers)
    const duplicates = [];
    nameMap.forEach((entries, name) => {
        if (entries.length > 1) {
            const chestNumbers = new Set(entries.map(e => e.chestNo).filter(Boolean));
            if (chestNumbers.size > 1) {
                duplicates.push({ name, entries, chestNumbers: Array.from(chestNumbers) });
            }
        }
    });

    console.log("🔴 DUPLICATE STUDENTS FOUND IN RESULTS:\n");
    console.log(`Total students with duplicates: ${duplicates.length}\n`);

    if (duplicates.length === 0) {
        console.log("✅ No duplicates found! Your results are clean.");
        return;
    }

    // Display duplicates
    duplicates.forEach(({ name, entries, chestNumbers }, index) => {
        console.log(`${index + 1}. ${name}`);
        console.log(`   Chest Numbers: ${chestNumbers.join(', ')}`);
        console.log(`   Total entries: ${entries.length}`);

        entries.forEach((entry, idx) => {
            console.log(`   ${idx + 1}) Event: ${entry.eventName} | Prize: ${entry.place} | Chest: ${entry.chestNo || 'N/A'} | Team: ${entry.team} | Points: ${entry.points}`);
        });
        console.log('');
    });

    console.log("\n📋 SUMMARY:");
    console.log(`   Total duplicate students: ${duplicates.length}`);
    console.log(`   Total duplicate result entries: ${duplicates.reduce((sum, d) => sum + d.entries.length, 0)}`);

    console.log("\n💡 RECOMMENDED ACTIONS:");
    console.log("   1. Review the duplicates above");
    console.log("   2. Identify which chest number is correct for each student");
    console.log("   3. Use the Admin Dashboard to delete incorrect entries");
    console.log("   4. Or run a cleanup script to merge/remove duplicates");

    return duplicates;
}

// Run analysis
analyzeDuplicateResults()
    .then(() => {
        console.log("\n✅ Analysis complete!");
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ Error:", err);
        process.exit(1);
    });
