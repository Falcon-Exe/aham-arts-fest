import { useState, useEffect, memo } from "react";
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
import "./Gallery.css";

const images = [pic1, pic2, pic3, pic4, pic5, pic6, p1, p2, p3, p4];

function Gallery() {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [fullscreenMode, setFullscreenMode] = useState(null); // "slideshow" | "grid"
  const [activeIndex, setActiveIndex] = useState(0);

  /* AUTO FEATURED SLIDE */
  useEffect(() => {
    const interval = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  /* SLIDESHOW AUTO */
  useEffect(() => {
    if (fullscreenMode !== "slideshow") return;

    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % images.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [fullscreenMode]);

  return (
    <>
      {/* FEATURED IMAGE */}
      <div
        className="featured-image"
        onClick={() => {
          setActiveIndex(featuredIndex);
          setFullscreenMode("slideshow");
        }}
      >
        <img src={images[featuredIndex]} alt="Featured" />
      </div>

      {/* SLIDER */}
      <div className="slider-container">
        <div className="slider-track">
          {[...images, ...images].map((src, i) => (
            <img
              key={i}
              src={src}
              alt="Slide"
              onClick={() => {
                setActiveIndex(i % images.length);
                setFullscreenMode("grid");
              }}
            />
          ))}
        </div>
      </div>

      {/* FULLSCREEN OVERLAY */}
      {fullscreenMode && (
        <div className="fullscreen" onClick={() => setFullscreenMode(null)}>
          
          {/* SLIDESHOW MODE */}
          {fullscreenMode === "slideshow" && (
            <div className="slideshow" onClick={(e) => e.stopPropagation()}>
              <img src={images[activeIndex]} alt="Slide view" />

              <button
                className="nav prev"
                onClick={() =>
                  setActiveIndex(
                    (i) => (i - 1 + images.length) % images.length
                  )
                }
              >
                ‹
              </button>

              <button
                className="nav next"
                onClick={() =>
                  setActiveIndex((i) => (i + 1) % images.length)
                }
              >
                ›
              </button>
            </div>
          )}

          {/* GRID MODE */}
          {fullscreenMode === "grid" && (
            <div className="fullscreen-grid" onClick={(e) => e.stopPropagation()}>
              {images.map((src, i) => (
                <img key={i} src={src} alt={`Grid ${i}`} />
              ))}
            </div>
          )}

        </div>
      )}
    </>
  );
}

export default memo(Gallery);
