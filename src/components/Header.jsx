import { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import "./Header.css";

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [hasTicker, setHasTicker] = useState(false);

  /* TICKER STATUS DETECTION */
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "announcements", "ticker"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHasTicker(!!(data && data.active && data.message));
      } else {
        setHasTicker(false);
      }
    });
    return () => unsub();
  }, []);

  /* SCROLL DIRECTION DETECTION */
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 50 && currentScrollY > lastScrollY); // Hide on scroll down
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const appName = localStorage.getItem("branding_appName") || "HAMARTIA Arts Fest";
  let mainTitle = "HAMARTIA";
  let lastWord = "Arts Fest";

  if (appName.toUpperCase().includes("HAMARTIA")) {
    mainTitle = "HAMARTIA";
    lastWord = appName.replace(/HAMARTIA/i, "").trim() || "Arts Fest";
  } else {
    const words = appName.trim().split(" ");
    lastWord = words.length > 1 ? words.pop() : appName;
    mainTitle = words.join(" ") || "HAMARTIA";
  }

  return (
    <header className={`island-header ${scrolled ? "hidden" : "visible"} ${hasTicker ? "has-ticker" : ""}`}>
      <div className="island-capsule">
        {/* COMPACT STATE */}
        <div className="island-compact">
          {/* LOGO ICON */}
          <div className="island-logo">
            <img src={localStorage.getItem("branding_logoUrl") || "/pwa-512x512.png"} alt="Logo" />
          </div>

          {/* TITLE COMPACT */}
          <div className="island-title">
            <span className="bold">{mainTitle}</span>
            <span className="thin">{lastWord || appName}</span>
          </div>

          {/* LIVE INDICATOR */}
          <div className="island-status">
            <div className="equalizer">
              <span className="bar"></span>
              <span className="bar"></span>
              <span className="bar"></span>
            </div>
            LIVE
          </div>
        </div>

        {/* EXPANDED MENU (Dynamic Island) */}
        <div className="island-expanded">
          <Link to="/" className="island-link">
            <span>🏠</span> Home
          </Link>
          <Link to="/gallery" className="island-link">
            <span>📸</span> Gallery
          </Link>
          <Link to="/results" className="island-link">
            <span>🏆</span> Results
          </Link>
          <Link to="/profile" className="island-link">
            <span>🎓</span> Profile
          </Link>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
