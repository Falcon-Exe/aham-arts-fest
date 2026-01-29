import { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Helmet } from "react-helmet-async";
import "./GalleryPage.css";

export default function GalleryPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedImg, setSelectedImg] = useState(null);

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const q = query(collection(db, "gallery"), orderBy("title"));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setItems(list);
            } catch (err) {
                console.error("Error fetching gallery:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchGallery();
    }, []);

    const openLightbox = (item) => {
        setSelectedImg(item);
        document.body.style.overflow = "hidden"; // Prevent background scroll
    };

    const closeLightbox = () => {
        setSelectedImg(null);
        document.body.style.overflow = "auto";
    };

    return (
        <div className="gallery-page">
            <Helmet>
                <title>Gallery | AHAM Arts Fest 2026</title>
                <meta name="description" content="View the highlights and moments from AHAM Arts Fest 2026." />
            </Helmet>

            <header className="gallery-page-header">
                <h2>Event Gallery</h2>
                <p>Capturing the moments of glory and creativity.</p>
            </header>

            {loading ? (
                <div style={{ textAlign: "center", padding: "50px", color: "var(--muted)" }}>
                    Loading gallery...
                </div>
            ) : (
                <div className="gallery-grid">
                    {items.length > 0 ? items.map((item) => (
                        <div key={item.id} className="gallery-item" onClick={() => openLightbox(item)}>
                            <img src={item.src} alt={item.title} loading="lazy" />
                            <div className="item-overlay">
                                <div className="item-title">{item.title}</div>
                                <div className="item-category">{item.category}</div>
                            </div>
                        </div>
                    )) : (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "#666" }}>
                            No images uploaded yet.
                        </div>
                    )}
                </div>
            )}

            {/* LIGHTBOX */}
            {selectedImg && (
                <div className="lightbox-overlay" onClick={closeLightbox}>
                    <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                        <button className="lightbox-close" onClick={closeLightbox}>&times;</button>
                        <img src={selectedImg.src} alt={selectedImg.title} className="lightbox-img" />
                        <div className="lightbox-info">
                            <h3>{selectedImg.title}</h3>
                            <span>{selectedImg.category}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
