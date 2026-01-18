import { memo, useEffect, useState } from "react";
import "./Header.css";

const FEST_DATE = new Date("2026-02-10T09:00:00"); // 🔴 CHANGE FEST DATE HERE

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  /* SCROLL SHRINK */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* COUNTDOWN */
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = FEST_DATE - now;

      if (diff <= 0) {
        setTimeLeft("Live Now 🎉");
        clearInterval(timer);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);

      setTimeLeft(`${d}d ${h}h ${m}m`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className={`hero-header ${scrolled ? "shrink" : ""}`}>
      <div className="hero-content">
        {/* FEST BADGE */}
        <div className="fest-badge">FEB 2026</div>

        {/* LOGO */}
        <img
          src="/pwa-512x512.png"
          alt="AHAM Arts Fest official logo"
          className="hero-logo"
        />

        {/* TITLE */}
        <h1 className="hero-title">
          AHAM ARTS FEST
          <span>2025–26</span>
        </h1>

        {/* TAGLINE */}
        <p className="hero-tagline">
          Where talent meets tradition 🎭
        </p>

        {/* COUNTDOWN */}
        <div className="countdown">{timeLeft}</div>
      </div>
    </header>
  );
}

export default memo(Header);
