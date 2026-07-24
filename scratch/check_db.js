import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwlBBI571J4F8WToO38trYmt9nqwYn_rE",
  authDomain: "artsfestapp.firebaseapp.com",
  projectId: "artsfestapp",
  storageBucket: "artsfestapp.firebasestorage.app",
  messagingSenderId: "426212877978",
  appId: "1:426212877978:web:da996630c39a25bd20a123",
  measurementId: "G-MPKKW2YM7J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("Fetching registrations...");
  const snap = await getDocs(collection(db, "registrations"));
  console.log(`Found ${snap.size} registrations.`);
  const regs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Find any chest number that has multiple registrations
  const counts = {};
  regs.forEach(r => {
    if (r.chestNumber) {
      const chest = r.chestNumber.toUpperCase().trim();
      counts[chest] = (counts[chest] || 0) + 1;
    }
  });
  
  console.log("=== DUPLICATE REGISTRATIONS ===");
  Object.keys(counts).forEach(chest => {
    if (counts[chest] > 1) {
      console.log(`Chest ${chest}: ${counts[chest]} documents`);
      regs.filter(r => r.chestNumber && r.chestNumber.toUpperCase().trim() === chest).forEach(r => {
        console.log(`  - Doc ID: ${r.id}, Name: ${r.fullName}, Events: ${JSON.stringify(r.events)}, OnStage: ${JSON.stringify(r.onStageEvents)}, OffStage: ${JSON.stringify(r.offStageEvents)}`);
      });
    }
  });

  console.log("=== FIRST 10 REGISTRATIONS ===");
  regs.slice(0, 10).forEach(r => {
     console.log(`ID: ${r.id}, Chest: ${r.chestNumber}, Name: ${r.fullName}, Team: ${r.team}, Events: ${JSON.stringify(r.events)}`);
  });
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
