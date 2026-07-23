import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Page-based cursor color config
const PAGE_COLORS = {
  "/": { color: "#4F46E5", glow: "rgba(79, 70, 229, 0.15)", label: "FESTIVAL" },
  "/results": { color: "#F59E0B", glow: "rgba(245, 158, 11, 0.15)", label: "RESULTS" },
  "/events": { color: "#06B6D4", glow: "rgba(6, 182, 212, 0.15)", label: "EVENTS" },
  "/register": { color: "#10B981", glow: "rgba(16, 185, 129, 0.15)", label: "REGISTER" },
  "/gallery": { color: "#EC4899", glow: "rgba(236, 72, 153, 0.15)", label: "GALLERY" },
  "/participants": { color: "#8B5CF6", glow: "rgba(139, 92, 246, 0.15)", label: "TEAMS" },
  "/dashboard": { color: "#EF4444", glow: "rgba(239, 68, 68, 0.15)", label: "ADMIN" },
  "/admin": { color: "#EF4444", glow: "rgba(239, 68, 68, 0.15)", label: "ADMIN" },
};

const getPageTheme = (path) => {
  const key = Object.keys(PAGE_COLORS).find((k) => path.startsWith(k) && k !== "/") ||
    (path === "/" ? "/" : null);
  return PAGE_COLORS[key] || PAGE_COLORS["/"];
};

const MAX_TRAIL = 8;

const CustomCursor = () => {
  const location = useLocation();
  const cursorDotRef = useRef(null);
  const cursorRingRef = useRef(null);
  const glowRef = useRef(null);
  const badgeRef = useRef(null);
  const trailRefs = useRef([]);
  const [liveFlash, setLiveFlash] = useState(false);
  const liveTimerRef = useRef(null);

  // Page color theme
  const theme = getPageTheme(location.pathname);

  // ── Feature 1: Listen for new Firestore results → flash LIVE badge ──
  useEffect(() => {
    let isFirst = true;
    const unsub = onSnapshot(collection(db, "results"), (snap) => {
      if (isFirst) { isFirst = false; return; }
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          setLiveFlash(true);
          clearTimeout(liveTimerRef.current);
          liveTimerRef.current = setTimeout(() => {
            setLiveFlash(false);
          }, 3500);
        }
      });
    });
    return () => { unsub(); clearTimeout(liveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Feature 2: Update glow color when route changes ──
  useEffect(() => {
    document.documentElement.style.setProperty("--cursor-color", theme.color);
    document.documentElement.style.setProperty("--cursor-glow", theme.glow);
  }, [location.pathname, theme]);

  // ── Main cursor logic ──
  useEffect(() => {
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let ringX = cursorX, ringY = cursorY;
    let requestRef;
    const trailPositions = Array.from({ length: MAX_TRAIL }, () => ({ x: cursorX, y: cursorY }));

    const handleMouseMove = (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;

      if (cursorDotRef.current) {
        cursorDotRef.current.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
        cursorDotRef.current.style.opacity = "1";
      }
      if (glowRef.current) {
        glowRef.current.style.left = `${cursorX}px`;
        glowRef.current.style.top = `${cursorY}px`;
        glowRef.current.style.opacity = "1";
      }
      if (badgeRef.current) {
        badgeRef.current.style.transform = `translate(${cursorX + 14}px, ${cursorY - 14}px)`;
        badgeRef.current.style.opacity = "1";
      }
    };

    // ── Feature 5: Trail animation in rAF loop ──
    const updateRing = () => {
      ringX += (cursorX - ringX) * 0.15;
      ringY += (cursorY - ringY) * 0.15;

      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate(${ringX}px, ${ringY}px)`;
        cursorRingRef.current.style.opacity = "1";
      }

      // Shift trail buffer
      trailPositions.unshift({ x: cursorX, y: cursorY });
      trailPositions.length = MAX_TRAIL;

      trailRefs.current.forEach((el, i) => {
        if (!el) return;
        const lag = trailPositions[i] || trailPositions[trailPositions.length - 1];
        const scale = 1 - i / MAX_TRAIL;
        const opacity = (1 - i / MAX_TRAIL) * 0.45;
        el.style.transform = `translate(${lag.x}px, ${lag.y}px) scale(${scale})`;
        el.style.opacity = String(opacity);
      });

      requestRef = requestAnimationFrame(updateRing);
    };
    requestRef = requestAnimationFrame(updateRing);

    // Ring hover expand (no badge text changes)
    const handleMouseOver = (e) => {
      const isInteractive = e.target.closest("a, button, [role='button'], .bento-card, .list-item, input, select, textarea, .glass-card, .event-card");
      if (isInteractive) {
        if (cursorRingRef.current) cursorRingRef.current.classList.add("cursor-hovering");
      } else {
        if (cursorRingRef.current) cursorRingRef.current.classList.remove("cursor-hovering");
      }
    };

    // ── Feature 3: Click ripple ──
    const handleClick = (e) => {
      const ripple = document.createElement("div");
      ripple.className = "cursor-click-ripple";
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    };

    const handleMouseLeave = () => {
      if (cursorDotRef.current) cursorDotRef.current.style.opacity = "0";
      if (cursorRingRef.current) cursorRingRef.current.style.opacity = "0";
      if (glowRef.current) glowRef.current.style.opacity = "0";
      if (badgeRef.current) badgeRef.current.style.opacity = "0";
      trailRefs.current.forEach((el) => { if (el) el.style.opacity = "0"; });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    window.addEventListener("click", handleClick);
    document.body.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("click", handleClick);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(requestRef);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFlash, location.pathname]);

  return (
    <>
      {/* Ambient glow */}
      <div ref={glowRef} className="ambient-cursor-glow" />

      {/* Feature 5: Particle trail dots */}
      {Array.from({ length: MAX_TRAIL }).map((_, i) => (
        <div
          key={i}
          ref={(el) => (trailRefs.current[i] = el)}
          className="cursor-trail-dot"
          style={{ transitionDelay: `${i * 10}ms` }}
        />
      ))}

      {/* Ring */}
      <div ref={cursorRingRef} className="custom-cursor-ring" />

      {/* Sharp dot */}
      <div ref={cursorDotRef} className="custom-cursor-dot" />

      {/* Feature 1+4: Dynamic badge */}
      <div ref={badgeRef} className={`cursor-badge${liveFlash ? " cursor-badge--live" : ""}`}>
        <span className="cursor-badge-label">
          {liveFlash ? "🏆 LIVE" : theme.label}
        </span>
      </div>
    </>
  );
};

export default CustomCursor;
