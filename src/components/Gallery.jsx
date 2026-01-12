import { useState, useRef, useEffect } from "react";
import pic1 from "../assets/pic1.jpg";
import pic2 from "../assets/pic2.jpg";
import pic3 from "../assets/pic3.jpg";
import pic4 from "../assets/pic4.jpg";
import pic5 from "../assets/pic5.jpg";
import pic6 from "../assets/pic6.jpg";
import "./Gallery.css";

const images = [pic1, pic2, pic3, pic4, pic5, pic6];

function Gallery() {
  const [currentIndex, setCurrentIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const touchStartX = useRef(0);
  const slideshowRef = useRef(null);

  const openImage = (index) => setCurrentIndex(index);
  const closeImage = () => setCurrentIndex(null);

  const nextImage = () =>
    setCurrentIndex((i) => (i + 1) % images.length);

  const prevImage = () =>
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);

  /* ===============================
     AUTO SLIDESHOW (PERFORMANCE SAFE)
     =============================== */
  useEffect(() => {
    if (currentIndex === null || !isPlaying) return;

    slideshowRef.current = setInterval(nextImage, 3000);

    return () => clearInterval(slideshowRef.current);
  }, [currentIndex, isPlaying]);

  /* ===============================
     TOUCH SWIPE
     =============================== */
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 50) prevImage();
    if (diff < -50) nextImage();
  };

  /* ===============================
     KEYBOARD SUPPORT
     =============================== */
  useEffect(() => {
    if (currentIndex === null) return;

    const handleKey = (e) => {
      if (e.key === "Escape") closeImage();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex]);

  return (
    <>
      {/* GALLERY GRID */}
<div className="gallery-masonry">
  {images.map((src, i) => (
    <img
      key={i}
      src={src}
      alt={`Gallery ${i + 1}`}
      className="gallery-image"
      loading="lazy"
      onClick={() => openImage(i)}
    />
  ))}
</div>

      {/* LIGHTBOX */}
      {currentIndex !== null && (
        <div
          className="lightbox"
          onClick={closeImage}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={images[currentIndex]}
            alt="Full view"
            className="lightbox-image"
            loading="eager"
            onClick={(e) => e.stopPropagation()}
          />

          {/* COUNTER */}
          <div className="lightbox-counter">
            {currentIndex + 1} / {images.length}
          </div>

          {/* PLAY / PAUSE */}
          <button
            className="lightbox-play"
            onClick={(e) => {
              e.stopPropagation();
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
        </div>
      )}
    </>
  );
}
import { memo } from "react";

export default memo(Gallery);

