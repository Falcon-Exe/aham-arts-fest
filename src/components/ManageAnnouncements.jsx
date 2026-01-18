import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function ManageAnnouncements() {
    const [message, setMessage] = useState("");
    const [active, setActive] = useState(true);
    const [loading, setLoading] = useState(false);

    // We'll use a single document 'config/ticker' for the global announcement
    const DOC_REF = doc(db, "announcements", "ticker");

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
            alert("Announcement updated!");
        } catch (err) {
            console.error(err);
            alert("Error updating announcement");
        }
        setLoading(false);
    };

    return (
        <div className="manage-announcements">
            <h3 className="section-title">Manage Announcement Ticker</h3>
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
