import { useState, memo, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import "./Gallery.css";

import pic1 from "../assets/pic1.jpg";
import pic2 from "../assets/pic2.jpg";
import pic3 from "../assets/pic3.jpg";
import pic4 from "../assets/pic4.jpg";

const defaultItems = [
  { src: pic1, title: "PYRA '26", category: "GRAND INAUGURAL" },
  { src: pic2, title: "KALA", category: "ARTISTIC DUEL" },
  { src: pic3, title: "MOSAIC", category: "LITERARY FEST" },
  { src: pic4, title: "VISION", category: "CULTURAL NIGHT" },
];

function Gallery() {
  const [paused, setPaused] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "gallery"), orderBy("title"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setItems(list.length > 0 ? list : defaultItems);
    });
    return () => unsubscribe();
  }, []);

  // For seamless scroll, we double the items
  const displayItems = [...items, ...items];

  return (
    <div
      className="featured-gallery-container"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`featured-track ${paused ? "paused" : ""}`}>
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
