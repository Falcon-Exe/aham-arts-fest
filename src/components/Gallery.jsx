import { useState, useRef, memo } from "react";
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

const featuredItems = [
  { src: pic1, title: "PYRA '26", category: "GRAND INAUGURAL" },
  { src: pic2, title: "KALA", category: "ARTISTIC DUEL" },
  { src: pic3, title: "MOSAIC", category: "LITERARY FEST" },
  { src: pic4, title: "VISION", category: "CULTURAL NIGHT" },
  { src: p1, title: "HARMONY", category: "MUSIC STAGE" },
  { src: p2, title: "LEGACY", category: "HISTORIC WIN" },
  { src: pic1, title: "PYRA '26", category: "GRAND INAUGURAL" },
  { src: pic2, title: "KALA", category: "ARTISTIC DUEL" },
];

function Gallery() {
  const [paused, setPaused] = useState(false);

  return (
    <div
      className="featured-gallery-container"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`featured-track ${paused ? "paused" : ""}`}>
        {featuredItems.map((item, i) => (
          <div className="featured-frame" key={i}>
            <div className="image-wrapper">
              <img src={item.src} alt={item.title} />
              <div className="frame-overlay"></div>
            </div>
            <div className="frame-info">
              <span className="frame-category">{item.category}</span>
              <h3 className="frame-title">{item.title}</h3>
            </div>
          </div>
        ))}
        {/* Loop for seamless scroll */}
        {featuredItems.map((item, i) => (
          <div className="featured-frame" key={`dup-${i}`}>
            <div className="image-wrapper">
              <img src={item.src} alt={item.title} />
              <div className="frame-overlay"></div>
            </div>
            <div className="frame-info">
              <span className="frame-category">{item.category}</span>
              <h3 className="frame-title">{item.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(Gallery);
