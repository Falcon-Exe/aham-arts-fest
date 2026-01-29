import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

export default function ManageGallery() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        src: "",
        title: "",
        category: ""
    });
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();

    // Cloudinary Config
    const CLOUD_NAME = "dncz0c7vu";
    const UPLOAD_PRESET = "aham-arts-fest";

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    useEffect(() => {
        const q = query(collection(db, "gallery"), orderBy("title"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", UPLOAD_PRESET);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: data
            });

            const fileData = await res.json();
            if (fileData.secure_url) {
                setFormData(prev => ({ ...prev, src: fileData.secure_url }));
                showToast("Image uploaded successfully!", "success");
            } else {
                throw new Error("Upload failed");
            }
        } catch (err) {
            console.error("Upload Error:", err);
            showToast("Failed to upload image. Please try again.", "error");
        }
        setUploading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.src || !formData.title) return;

        try {
            await addDoc(collection(db, "gallery"), formData);
            setFormData({ src: "", title: "", category: "" });
            showToast("Gallery item added!", "success");
        } catch (err) {
            console.error(err);
            showToast("Error adding item", "error");
        }
    };

    const handleDelete = async (id) => {
        if (!await confirm("Remove this image from spotlight?")) return;
        try {
            await deleteDoc(doc(db, "gallery", id));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="manage-gallery">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}
            <h3 className="section-title">Manage Featured Spotlight</h3>
            <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
                Add URLs of photos to display them in the homepage carousel.
            </p>

            <form onSubmit={handleSubmit} className="admin-form">
                <div className="form-grid">
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#888' }}>Upload Image (Cloudinary)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="admin-input full-width"
                            style={{ padding: '10px' }}
                        />
                        {uploading && <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '4px' }}>Uploading to cloud... ☁️</p>}
                    </div>

                    <input className="admin-input full-width" placeholder="Image URL (Auto-fills after upload)" value={formData.src} onChange={e => setFormData({ ...formData, src: e.target.value })} required />
                    <input className="admin-input" placeholder="Title (e.g. PYRA '26)" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                    <input className="admin-input" placeholder="Category (e.g. GRAND INAUGURAL)" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                </div>
                <button type="submit" className="submit-btn" style={{ marginTop: '20px' }} disabled={uploading}>
                    {uploading ? "Waiting for Upload..." : "Add to Spotlight +"}
                </button>
            </form>

            <h4 style={{ marginTop: '30px', marginBottom: '16px', color: 'var(--primary)' }}>Current Spotlight Items</h4>
            {loading ? <p>Loading gallery items...</p> : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Preview</th>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length > 0 ? items.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <img src={item.src} alt="preview" style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                    </td>
                                    <td style={{ fontWeight: '600' }}>{item.title}</td>
                                    <td>{item.category}</td>
                                    <td>
                                        <button onClick={() => handleDelete(item.id)} className="delete-btn">Remove</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '30px' }}>No items in spotlight yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
