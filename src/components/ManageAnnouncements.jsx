import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";

// We'll use a single document 'config/ticker' for the global announcement
const DOC_REF = doc(db, "announcements", "ticker");

export default function ManageAnnouncements() {
    const [message, setMessage] = useState("");
    const [active, setActive] = useState(true);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    useEffect(() => {
        const fetchTicker = async () => {
            try {
                const snap = await getDoc(DOC_REF);
                if (snap.exists()) {
                    const data = snap.data();
                    setMessage(data.message || "");
                    setActive(data.active ?? true);
                }
            } catch (err) {
                console.error("Error loading ticker:", err);
            }
        };
        fetchTicker();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await setDoc(DOC_REF, { message, active });
            showToast("Announcement updated!", "success");
        } catch (err) {
            console.error(err);
            showToast("Error updating announcement", "error");
        }
        setLoading(false);
    };

    return (
        <div className="manage-announcements">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            <h3 className="section-title">
                Manage Announcement Ticker
                {active && (
                    <span className="live-pill" style={{
                        marginLeft: '15px',
                        fontSize: '0.7rem',
                        background: 'rgba(230, 57, 70, 0.1)',
                        color: '#e63946',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: '1px solid #e63946',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        verticalAlign: 'middle'
                    }}>
                        • Live Now
                    </span>
                )}
            </h3>
            <p style={{ color: "var(--muted)", marginBottom: "20px", fontSize: "0.95rem" }}>
                This message will scroll at the top of every page.
            </p>

            <form onSubmit={handleSave} className="admin-form">
                <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "var(--text-color)" }}>
                        Announcement Message
                    </label>
                    <input
                        className="admin-input"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="e.g. Results for Dance are out!"
                    />
                </div>

                <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "1rem" }}>
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={e => setActive(e.target.checked)}
                            style={{ width: "20px", height: "20px", accentColor: "var(--primary)" }}
                        />
                        <span style={{ fontWeight: "500" }}>Show Ticker on Website</span>
                    </label>
                </div>

                <button disabled={loading} type="submit" className="submit-btn" style={{ width: "auto", padding: "12px 30px" }}>
                    {loading ? "Saving..." : "Update Announcement"}
                </button>
            </form>
        </div>
    );
}
