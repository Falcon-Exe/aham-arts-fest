import { useState, memo, useEffect, useRef } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import "./Gallery.css";

import pic1 from "../assets/pic1.jpg";
import pic2 from "../assets/pic2.jpg";
import pic3 from "../assets/pic3.jpg";
// import pic4 from "../assets/pic4.jpg";

const defaultItems = [
  { src: pic1, title: "COMMITTE" },
  { src: pic2, title: "LOGO LAUNCHING" },
  { src: pic3, title: "LOGO DETAILS" },
  // { src: pic4, title: "VISION" },
];

function Gallery() {
  const [items, setItems] = useState([]);
  const scrollerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "gallery"), orderBy("title"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setItems(list.length > 0 ? list : defaultItems);
    });
    return () => unsubscribe();
  }, []);

  // Duplicate items for seamless loop
  const displayItems = [...items, ...items, ...items]; // Triple for smoother safety buffer

  useEffect(() => {
    const scroller = scrollerRef.current;
    let animationId;

    const scrollStep = () => {
      if (!scroller) return;
      if (!isHovered) {
        scroller.scrollLeft += 1; // Speed of scroll

        // Reset if reached halfway (infinite loop logic)
        // We use scrollWidth / 3 because we tripled the items
        if (scroller.scrollLeft >= scroller.scrollWidth / 3) {
          scroller.scrollLeft = 0; // Reset to start instantly without visual jump
        }
      }
      animationId = requestAnimationFrame(scrollStep);
    };

    animationId = requestAnimationFrame(scrollStep);
    return () => cancelAnimationFrame(animationId);
  }, [isHovered, items]); // Re-run if paused state changes or items load

  return (
    <div
      className="featured-gallery-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setTimeout(() => setIsHovered(false), 2000)} // Resume after 2s on mobile
    >
      <div className="featured-track" ref={scrollerRef}>
        {displayItems.map((item, i) => (
          <div className="featured-frame" key={i}>
            <div className="image-wrapper">
              <img src={item.src} alt={item.title} loading="lazy" />
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
