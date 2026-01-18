import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export default function ManageGallery() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        src: "",
        title: "",
        category: ""
    });

    useEffect(() => {
        const q = query(collection(db, "gallery"), orderBy("title"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.src || !formData.title) return;

        try {
            await addDoc(collection(db, "gallery"), formData);
            setFormData({ src: "", title: "", category: "" });
            alert("Gallery item added!");
        } catch (err) {
            console.error(err);
            alert("Error adding item");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Remove this image from spotlight?")) return;
        try {
            await deleteDoc(doc(db, "gallery", id));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="manage-gallery">
            <h3 className="section-title">Manage Featured Spotlight</h3>
            <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
                Add URLs of photos to display them in the homepage carousel.
            </p>

            <form onSubmit={handleSubmit} className="admin-form">
                <div className="form-grid">
                    <input className="admin-input full-width" placeholder="Image URL (Direct Link)" value={formData.src} onChange={e => setFormData({ ...formData, src: e.target.value })} required />
                    <input className="admin-input" placeholder="Title (e.g. PYRA '26)" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                    <input className="admin-input" placeholder="Category (e.g. GRAND INAUGURAL)" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                </div>
                <button type="submit" className="submit-btn" style={{ marginTop: '20px' }}>Add to Spotlight +</button>
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
