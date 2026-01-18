import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import "./Ticker.css";

export default function AnnouncementTicker() {
  const [ticker, setTicker] = useState(null);

  useEffect(() => {
    // Listen to real-time updates from Firestore
    const unsub = onSnapshot(doc(db, "announcements", "ticker"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.active) {
          setTicker(data.message);
        } else {
          setTicker(null);
        }
      }
    });
    return () => unsub();
  }, []);

  if (!ticker) return null;

  return (
    <div className="ticker">
      <span>
        🔴 {ticker}
      </span>
    </div>
  );
}
