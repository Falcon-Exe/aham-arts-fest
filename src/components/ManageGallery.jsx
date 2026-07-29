import { useState, useEffect } from "react";
import { collection, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

export default function ManageGallery() {
    const [metaItems, setMetaItems] = useState({});
    const [instaPosts, setInstaPosts] = useState([]);
    const [loadingInsta, setLoadingInsta] = useState(true);
    
    const [formData, setFormData] = useState({
        instaId: "",
        src: "",
        title: "",
        category: "INSTAGRAM",
        videoUrl: "",
        mediaType: "IMAGE",
        link: "",
        isPinned: false
    });
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();

    const showToast = (message, type = 'info') => setToast({ message, type });
    const handleToastClose = () => setToast(null);

    // Fetch all gallery meta items (pinned state and custom captions)
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

    // Fetch Live Instagram Posts
    useEffect(() => {
        const fetchInsta = async () => {
            try {
                const res = await fetch('https://api-insta-ebon.vercel.app/api/instagram/posts?limit=30');
                const data = await res.json();
                if (data.posts) setInstaPosts(data.posts);
            } catch (err) {
                console.error(err);
                showToast("Failed to fetch live Instagram posts.", "error");
            } finally {
                setLoadingInsta(false);
            }
        };
        fetchInsta();
    }, []);

    const handleSelectInstaPost = (post) => {
        const existingMeta = metaItems[post.id];
        setFormData({
            instaId: post.id,
            src: post.url,
            title: existingMeta ? existingMeta.title : (post.alt || "Instagram Post"),
            category: existingMeta ? existingMeta.category : "INSTAGRAM",
            videoUrl: post.videoUrl || "",
            mediaType: post.media_type || "IMAGE",
            link: post.link || `https://www.instagram.com/p/${post.id}`,
            isPinned: existingMeta ? existingMeta.isPinned : false
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSaveCaption = async (e) => {
        if (e) e.preventDefault();
        if (!formData.instaId) return;

        try {
            await setDoc(doc(db, "gallery", formData.instaId), {
                ...formData,
                updatedAt: serverTimestamp(),
                createdAt: metaItems[formData.instaId]?.createdAt || serverTimestamp()
            });
            showToast("Caption saved successfully!", "success");
        } catch (err) {
            console.error(err);
            showToast("Error saving caption", "error");
        }
    };

    const handleTogglePin = async () => {
        if (!formData.instaId) return;
        const newPinnedState = !formData.isPinned;
        
        try {
            await setDoc(doc(db, "gallery", formData.instaId), {
                ...formData,
                isPinned: newPinnedState,
                updatedAt: serverTimestamp(),
                createdAt: metaItems[formData.instaId]?.createdAt || serverTimestamp()
            });
            setFormData(prev => ({ ...prev, isPinned: newPinnedState }));
            showToast(newPinnedState ? "Pinned to Homepage Spotlight 📌" : "Unpinned from Spotlight", "success");
        } catch (err) {
            console.error(err);
            showToast("Error updating pin state", "error");
        }
    };

    const handleCancelEdit = () => {
        setFormData({ instaId: "", src: "", title: "", category: "INSTAGRAM", videoUrl: "", mediaType: "IMAGE", link: "", isPinned: false });
    };

    const pinnedList = Object.entries(metaItems)
        .map(([id, data]) => ({ id, ...data }))
        .filter(item => item.isPinned)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    return (
        <div className="manage-gallery">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}
            
            <h3 className="section-title">Spotlight & Caption Manager</h3>
            <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
                Select a post, edit its custom caption for the main gallery, and choose whether to pin it to the homepage spotlight.
            </p>

            <div className="admin-form" style={{ position: 'sticky', top: '20px', zIndex: 10 }}>
                <div style={{ marginBottom: '15px', color: formData.instaId ? 'var(--primary)' : 'var(--text-main)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{formData.instaId ? `Editing Post` : "Select a Post to Edit"}</span>
                    {formData.isPinned && <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>📌 Pinned to Spotlight</span>}
                </div>
                
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    {/* Image Preview */}
                    <div style={{ width: '120px', height: '120px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', overflow: 'hidden', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {formData.src ? (
                            <img src={formData.src} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>Select an image below</span>
                        )}
                    </div>
                    
                    {/* Inputs */}
                    <div className="form-grid" style={{ flex: 1, marginTop: 0 }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Custom Caption (Overrides Instagram Caption)</label>
                            <textarea 
                                className="admin-input full-width" 
                                placeholder="Edit the caption..." 
                                value={formData.title} 
                                onChange={e => setFormData({ ...formData, title: e.target.value })} 
                                rows={3}
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category Label</label>
                            <input 
                                className="admin-input full-width" 
                                placeholder="Category (e.g. INSTAGRAM, HIGHLIGHT)" 
                                value={formData.category} 
                                onChange={e => setFormData({ ...formData, category: e.target.value })} 
                            />
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <button onClick={handleSaveCaption} className="submit-btn" disabled={!formData.instaId} style={{ flex: 1, opacity: !formData.instaId ? 0.5 : 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
                        💾 Save Caption Only
                    </button>
                    <button onClick={handleTogglePin} disabled={!formData.instaId} style={{ flex: 1, opacity: !formData.instaId ? 0.5 : 1, background: formData.isPinned ? 'var(--bg-tertiary)' : 'var(--primary)', color: formData.isPinned ? 'var(--text-main)' : 'white', border: formData.isPinned ? '1px solid var(--border-soft)' : 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                        {formData.isPinned ? "❌ Unpin from Spotlight" : "📌 Pin to Spotlight"}
                    </button>
                    {formData.instaId && (
                        <button type="button" onClick={handleCancelEdit} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* TWO COLUMN LAYOUT FOR LISTS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px', alignItems: 'start' }}>
                
                {/* LEFT COLUMN: Pinned Items */}
                <div>
                    <h4 style={{ marginBottom: '16px', color: 'var(--primary)' }}>📌 Currently Pinned (Homepage)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pinnedList.length > 0 ? pinnedList.map(item => (
                            <div key={item.id} style={{ display: 'flex', gap: '15px', background: formData.instaId === item.id ? 'var(--bg-tertiary)' : 'var(--surface)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-soft)' }}>
                                <img src={item.src} alt="thumb" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>{item.category}</div>
                                    <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '8px' }}>{item.title}</div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => {
                                            setFormData(item);
                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                        }} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px', color: 'var(--text-main)', cursor: 'pointer' }}>Edit</button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '30px', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border-soft)' }}>
                                No items pinned to spotlight.
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Live Instagram Feed Picker */}
                <div>
                    <h4 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>📱 Live Instagram Feed Picker</h4>
                    {loadingInsta ? (
                        <p style={{ color: 'var(--text-muted)' }}>Loading live posts...</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {instaPosts.map(post => {
                                const isPinned = metaItems[post.id]?.isPinned;
                                const hasCustomCaption = metaItems[post.id] && metaItems[post.id].title !== post.alt;
                                
                                return (
                                    <div 
                                        key={post.id} 
                                        onClick={() => handleSelectInstaPost(post)}
                                        style={{ 
                                            aspectRatio: '1/1', 
                                            position: 'relative', 
                                            borderRadius: '8px', 
                                            overflow: 'hidden', 
                                            cursor: 'pointer',
                                            border: formData.instaId === post.id ? '2px solid var(--primary)' : '2px solid transparent',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { if(formData.instaId !== post.id) e.currentTarget.style.border = '2px solid rgba(255,255,255,0.3)' }}
                                        onMouseLeave={e => { if(formData.instaId !== post.id) e.currentTarget.style.border = '2px solid transparent' }}
                                    >
                                        <img src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isPinned ? 0.7 : 1 }} alt="ig post" loading="lazy" />
                                        
                                        {/* Status Indicators */}
                                        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: '4px' }}>
                                            {isPinned && <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold' }}>📌</span>}
                                            {hasCustomCaption && !isPinned && <span style={{ background: 'var(--bg-tertiary)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.6rem', border: '1px solid var(--border-soft)' }}>📝</span>}
                                        </div>

                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', padding: '20px 8px 8px', fontSize: '0.7rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {metaItems[post.id]?.title || post.alt || "Select to Edit"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
