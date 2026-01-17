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
  const [fullscreen, setFullscreen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  /* FEATURED AUTO ROTATE */
  useEffect(() => {
    const id = setInterval(
      () => setFeaturedIndex((i) => (i + 1) % images.length),
      3500
    );
    return () => clearInterval(id);
  }, []);

  /* SLIDESHOW AUTO */
  useEffect(() => {
    if (!fullscreen) return;

    const id = setInterval(
      () => setActiveIndex((i) => (i + 1) % images.length),
      2800
    );
    return () => clearInterval(id);
  }, [fullscreen]);

  return (
    <>
      {/* FEATURED IMAGE */}
      <div
        className="featured-image"
        onClick={() => {
          setActiveIndex(featuredIndex);
          setFullscreen(true);
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
                setFullscreen(true);
              }}
            />
          ))}
        </div>
      </div>

      {/* FULLSCREEN SLIDESHOW */}
      {fullscreen && (
        <div className="fullscreen-overlay">
          <button
            className="close-btn"
            onClick={() => setFullscreen(false)}
          >
            ✕
          </button>

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

          <img
            className="fullscreen-img"
            src={images[activeIndex]}
            alt="Fullscreen"
          />

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
    </>
  );
}

export default memo(Gallery);
