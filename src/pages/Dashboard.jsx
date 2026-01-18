import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

import ManageEvents from "../components/ManageEvents";
import ManageResults from "../components/ManageResults";
import ManageAnnouncements from "../components/ManageAnnouncements"; // Add import

function Dashboard() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("events");
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                navigate("/admin");
            } else {
                setUser(currentUser);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/");
    };

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container" style={{ marginTop: "30px" }}>
            <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 style={{ color: "var(--primary)" }}>Admin Dashboard 🛡️</h2>
                    <button onClick={handleLogout} style={{ background: "#d9534f", color: "white", padding: "5px 10px", borderRadius: "4px", border: "none", cursor: "pointer" }}>Logout</button>
                </div>

                {/* TABS */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #eee", paddingBottom: "10px", overflowX: "auto" }}>
                    <button
                        onClick={() => setActiveTab("events")}
                        style={{
                            padding: "8px 16px",
                            background: activeTab === "events" ? "var(--primary)" : "transparent",
                            color: activeTab === "events" ? "white" : "var(--muted)",
                            border: "none",
                            borderRadius: "20px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            whiteSpace: "nowrap"
                        }}
                    >
                        Events
                    </button>
                    <button
                        onClick={() => setActiveTab("results")}
                        style={{
                            padding: "8px 16px",
                            background: activeTab === "results" ? "var(--primary)" : "transparent",
                            color: activeTab === "results" ? "white" : "var(--muted)",
                            border: "none",
                            borderRadius: "20px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            whiteSpace: "nowrap"
                        }}
                    >
                        Results
                    </button>
                    <button
                        onClick={() => setActiveTab("announcements")}
                        style={{
                            padding: "8px 16px",
                            background: activeTab === "announcements" ? "var(--primary)" : "transparent",
                            color: activeTab === "announcements" ? "white" : "var(--muted)",
                            border: "none",
                            borderRadius: "20px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            whiteSpace: "nowrap"
                        }}
                    >
                        Announcements
                    </button>
                </div>

                {/* CONTENT */}
                <div>
                    {activeTab === "events" && <ManageEvents />}
                    {activeTab === "results" && <ManageResults />}
                    {activeTab === "announcements" && <ManageAnnouncements />}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
