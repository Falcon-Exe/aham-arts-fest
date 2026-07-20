import { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import "./GalleryPage.css";

export default function GalleryPage() {
    const [items, setItems] = useState([]);
    const [metaItems, setMetaItems] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [apiFailed, setApiFailed] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [selectedImg, setSelectedImg] = useState(null);
    const [colCount, setColCount] = useState(3);
    const observer = useRef();

    useEffect(() => {
        const q = query(collection(db, "gallery"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const map = {};
            snapshot.docs.forEach(doc => {
                map[doc.id] = doc.data();
            });
            setMetaItems(map);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleResize = () => {
            // FIX MOBILE VIEW: 2 columns on mobile instead of 1 so images aren't massive
            if (window.innerWidth <= 600) setColCount(2);
            else if (window.innerWidth <= 992) setColCount(3);
            else setColCount(4); // 4 columns on large desktop
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchPosts = async (after = null) => {
        try {
            const url = `https://api-insta-ebon.vercel.app/api/instagram/posts?limit=24${after ? `&after=${after}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("API Proxy returned an error");
            const data = await response.json();
            
            if (data.posts && data.posts.length > 0) {
                const formattedPosts = data.posts.map((post) => ({
                    id: post.id,
                    src: post.url,
                    title: post.alt ? (post.alt.length > 80 ? post.alt.substring(0, 80) + '...' : post.alt) : "Instagram Post",
                    category: post.media_type === "VIDEO" ? "VIDEO" : "PHOTO",
                    mediaType: post.media_type,
                    videoUrl: post.videoUrl,
                    link: post.link || `https://www.instagram.com/p/${post.id}`
                }));
                
                if (after) {
                    setItems(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const uniqueNew = formattedPosts.filter(p => !existingIds.has(p.id));
                        return [...prev, ...uniqueNew];
                    });
                } else {
                    setItems(formattedPosts);
                }
            }
            if (data.paging && data.paging.cursors && data.paging.cursors.after) {
                setNextCursor(data.paging.cursors.after);
            } else {
                setNextCursor(null);
            }
        } catch (err) {
            console.error("Error fetching Instagram gallery, falling back to cache:", err);
            // Mark API as failed so the useEffect takes over syncing from metaItems
            if (!after) {
                setApiFailed(true);
                setItems(Object.values(metaItems));
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    // Sync items from metaItems if the API has failed and metaItems finishes loading later
    useEffect(() => {
        if (apiFailed) {
            setItems(Object.values(metaItems));
        }
    }, [metaItems, apiFailed]);

    const lastElementRef = useCallback(node => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && nextCursor) {
                setLoadingMore(true);
                fetchPosts(nextCursor);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, nextCursor]);

    const openLightbox = (item) => {
        setSelectedImg(item);
        document.body.style.overflow = "hidden";
    };

    const closeLightbox = () => {
        setSelectedImg(null);
        document.body.style.overflow = "auto";
    };

    const columns = Array.from({ length: colCount }, () => []);
    items.forEach((item, i) => {
        columns[i % colCount].push(item);
    });

    const renderMediaIcon = (mediaType) => {
        if (mediaType === "VIDEO") {
            return (
                <svg className="media-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            );
        }
        if (mediaType === "CAROUSEL_ALBUM") {
            return (
                <svg className="media-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 14H10V6h8v10zm-4-4h2v2h-2v-2zm-2 0h-2v2h2v-2zm0-4h-2v2h2V8zm4 0h-2v2h2V8z" opacity="0"/>
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
                </svg>
            );
        }
        return null;
    };

    const appName = localStorage.getItem("branding_appName") || "HAMARTIA";

    return (
        <div className="gallery-page">
            <Helmet>
                <title>{`Gallery | ${appName}`}</title>
                <meta name="description" content={`View the highlights and moments from ${appName}.`} />
            </Helmet>

            <header className="gallery-page-header">
                <h2>Event Gallery</h2>
                <p>Capturing the moments of glory and creativity.</p>
            </header>

            {loading ? (
                <div className="gallery-masonry skeleton-grid">
                    {Array.from({ length: colCount }).map((_, c) => (
                        <div key={c} className="masonry-column">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div 
                                    key={i} 
                                    className="gallery-item skeleton-item" 
                                    style={{ height: `${Math.floor(Math.random() * 150) + 250}px` }}
                                ></div>
                            ))}
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    <div className="gallery-masonry stagger-reveal-grid">
                        {columns.map((col, colIdx) => (
                            <div key={colIdx} className="masonry-column">
                                {col.map((item) => (
                                    <div key={item.id} className="gallery-item" onClick={() => openLightbox(item)}>
                                        {item.mediaType === "VIDEO" && item.videoUrl ? (
                                            <video src={item.videoUrl} muted loop playsInline autoPlay />
                                        ) : (
                                            <img 
                                                src={item.src} 
                                                alt={item.title} 
                                                loading="lazy" 
                                                onError={(e) => { e.target.style.display = 'none'; }} 
                                            />
                                        )}
                                        
                                        {renderMediaIcon(item.mediaType)}
                                        
                                        <div className="item-overlay">
                                            <div className="item-title">{metaItems[item.id]?.title || item.title}</div>
                                            <div className="item-category">{metaItems[item.id]?.category || item.category}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div style={{ width: "100%", textAlign: "center", padding: "40px", color: "#666" }}>
                                No images found.
                            </div>
                        )}
                    </div>
                    
                    {/* Intersection Observer target for infinite scroll */}
                    <div ref={lastElementRef} className="infinite-scroll-trigger">
                        {loadingMore && <div className="loading-spinner"></div>}
                    </div>
                </>
            )}

            {/* LIGHTBOX */}
            {selectedImg && (
                <div className="lightbox-overlay" onClick={closeLightbox}>
                    <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                        <button className="lightbox-close" onClick={closeLightbox}>&times;</button>
                        
                        <div className="lightbox-media-wrapper">
                            {selectedImg.mediaType === "VIDEO" && selectedImg.videoUrl ? (
                                <video src={selectedImg.videoUrl} controls autoPlay className="lightbox-video" />
                            ) : (
                                <img src={selectedImg.src} alt={selectedImg.title} className="lightbox-img" />
                            )}
                        </div>
                        
                        <div className="lightbox-info">
                            <h3>{metaItems[selectedImg.id]?.title || selectedImg.title}</h3>
                            <a 
                                href={selectedImg.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="insta-link-btn"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                </svg>
                                View on Instagram
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
