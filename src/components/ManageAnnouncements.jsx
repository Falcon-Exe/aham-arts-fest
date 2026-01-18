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
            <h3>Manage Announcement Ticker</h3>
            <p style={{ color: "var(--muted)", marginBottom: "16px" }}>
                This message will scroll at the bottom of every page.
            </p>

            <form onSubmit={handleSave} style={{ background: "#fffaf0", padding: "20px", borderRadius: "8px", border: "1px solid #ead19b" }}>
                <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Announcement Message</label>
                    <input
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="e.g. Results for Dance are out!"
                        style={{ width: "100%", padding: "10px", fontSize: "1rem" }}
                    />
                </div>

                <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={e => setActive(e.target.checked)}
                            style={{ transform: "scale(1.2)" }}
                        />
                        Show Ticker on Website
                    </label>
                </div>

                <button disabled={loading} type="submit" className="primary-btn">
                    {loading ? "Saving..." : "Update Announcement"}
                </button>
            </form>
        </div>
    );
}
