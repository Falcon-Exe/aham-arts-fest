import { useState, useEffect, memo } from "react";
import "./Gallery.css";

import pic1 from "../assets/pic1.jpg";
import pic2 from "../assets/pic2.jpg";
import pic3 from "../assets/pic3.jpg";
import pic4 from "../assets/pic4.jpg";
import pic5 from "../assets/pic5.jpg";
import pic6 from "../assets/pic6.jpg";
import p1 from "../assets/p1.jpeg";
import p2 from "../assets/p2.png";
import p3 from "../assets/p3.jpeg";
import p4 from "../assets/p4.jpeg";

const images = [pic1, pic2, pic3, pic4, pic5, pic6, p1, p2, p3, p4];

function Gallery() {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  /* AUTO FEATURED ROTATION */
  useEffect(() => {
    const interval = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % images.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* FEATURED IMAGE */}
      <div
        className="featured-image"
        onClick={() => {
          setActiveIndex(featuredIndex);
          setIsFullscreen(true);
        }}
      >
        <img src={images[featuredIndex]} alt="Featured" />
      </div>

      {/* 3×3 MASONRY GRID */}
      <div className="masonry-grid">
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Gallery ${i}`}
            onClick={() => {
              setActiveIndex(i);
              setIsFullscreen(true);
            }}
          />
        ))}
      </div>

      {/* FULLSCREEN VIEW */}
      {isFullscreen && (
        <div className="fullscreen" onClick={() => setIsFullscreen(false)}>
          <button
            className="close-btn"
            onClick={() => setIsFullscreen(false)}
          >
            ✕
          </button>

          <button
            className="nav prev"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex(
                (i) => (i - 1 + images.length) % images.length
              );
            }}
          >
            ‹
          </button>

          <img
            className="fullscreen-img"
            src={images[activeIndex]}
            alt="Fullscreen"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className="nav next"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex((i) => (i + 1) % images.length);
            }}
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}

export default memo(Gallery);
