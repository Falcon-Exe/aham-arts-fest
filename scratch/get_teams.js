import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwlBBI571J4F8WToO38trYmt9nqwYn_rE",
  authDomain: "artsfestapp.firebaseapp.com",
  projectId: "artsfestapp",
  storageBucket: "artsfestapp.firebasestorage.app",
  messagingSenderId: "426212877978",
  appId: "1:426212877978:web:da996630c39a25bd20a123"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

try {
  const querySnapshot = await getDocs(collection(db, "teams"));
  console.log("=== TEAMS ===");
  querySnapshot.forEach((doc) => {
    console.log(doc.id, "=>", doc.data());
  });
} catch (e) {
  console.error("Error fetching teams:", e);
}
process.exit(0);
