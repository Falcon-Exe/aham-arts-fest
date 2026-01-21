import { memo, useEffect, useState } from "react";
import "./Header.css";

function Header() {
  const [scrolled, setScrolled] = useState(false);

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

  return (
    <header className={`island-header ${scrolled ? "hidden" : "visible"}`}>
      <div className="island-capsule">
        {/* LOGO ICON */}
        <div className="island-logo">
          <img src="/pwa-512x512.png" alt="Logo" />
        </div>

        {/* TITLE COMPACT */}
        <div className="island-title">
          <span className="bold">AHAM</span>
          <span className="thin">2026</span>
        </div>

        {/* LIVE INDICATOR */}
        <div className="island-status">
          <span className="pulse-dot"></span>
          LIVE
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
