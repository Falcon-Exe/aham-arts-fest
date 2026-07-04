import { useEffect, useRef } from "react";

const CustomCursor = () => {
  const cursorDotRef = useRef(null);
  const cursorRingRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    // Disable entirely on touch devices
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let ringX = cursorX;
    let ringY = cursorY;
    let requestRef;

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
    };
    
    // Lerp animation for smooth trailing ring
    const updateRing = () => {
      ringX += (cursorX - ringX) * 0.15;
      ringY += (cursorY - ringY) * 0.15;
      
      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate(${ringX}px, ${ringY}px)`;
        cursorRingRef.current.style.opacity = "1";
      }
      
      requestRef = requestAnimationFrame(updateRing);
    };
    requestRef = requestAnimationFrame(updateRing);

    // Expand ring on interactive elements
    const handleMouseOver = (e) => {
      if (e.target.closest('a, button, .bento-card, .list-item, input, select, textarea, .glass-card, .event-card')) {
         if (cursorRingRef.current) cursorRingRef.current.classList.add('cursor-hovering');
      } else {
         if (cursorRingRef.current) cursorRingRef.current.classList.remove('cursor-hovering');
      }
    };

    const handleMouseLeave = () => {
        if (cursorDotRef.current) cursorDotRef.current.style.opacity = "0";
        if (cursorRingRef.current) cursorRingRef.current.style.opacity = "0";
        if (glowRef.current) glowRef.current.style.opacity = "0";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    document.body.addEventListener("mouseleave", handleMouseLeave);
    
    return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseover", handleMouseOver);
        document.body.removeEventListener("mouseleave", handleMouseLeave);
        cancelAnimationFrame(requestRef);
    };
  }, []);

  return (
    <>
      <div ref={glowRef} className="ambient-cursor-glow"></div>
      <div ref={cursorRingRef} className="custom-cursor-ring"></div>
      <div ref={cursorDotRef} className="custom-cursor-dot"></div>
    </>
  );
};

export default CustomCursor;
