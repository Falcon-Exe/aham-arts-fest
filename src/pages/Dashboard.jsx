import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import "./Dashboard.css"; // Import the new CSS

import ManageEvents from "../components/ManageEvents";
import ManageResults from "../components/ManageResults";
import ManageAnnouncements from "../components/ManageAnnouncements";
import ManageTeams from "../components/ManageTeams";
import ManageGallery from "../components/ManageGallery";
import ManageRegistrations from "../components/ManageRegistrations";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { ADMIN_EMAILS } from "../constants/auth";

function Dashboard() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("events");
    const [stats, setStats] = useState({ events: 0, results: 0 });
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                navigate("/admin");
            } else {
                if (!ADMIN_EMAILS.includes(currentUser.email)) {
                    alert("🚫 Access Denied: You are not authorized to view the Admin Dashboard.");
                    navigate("/");
                    return;
                }
                setUser(currentUser);
            }
            setLoading(false);
        });

        // Live stats listeners
        const unsubEvents = onSnapshot(collection(db, "events"), (snap) => {
            setStats(prev => ({ ...prev, events: snap.size }));
        });
        const unsubResults = onSnapshot(collection(db, "results"), (snap) => {
            setStats(prev => ({ ...prev, results: snap.size }));
        });

        return () => {
            unsubscribe();
            unsubEvents();
            unsubResults();
        };
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/");
    };

    if (loading) return <div className="loader">Loading...</div>;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h2 className="dashboard-title">Admin Dashboard</h2>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '4px' }}>
                        Authorized: {user?.email}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => navigate("/")} className="tab-btn" style={{ background: 'transparent' }}>
                        View Site ↗
                    </button>
                    <button onClick={handleLogout} className="logout-btn">
                        Logout ➜
                    </button>
                </div>
            </header>

            {/* QUICK STATS */}
            <div className="dashboard-stats-grid">
                <div className="stat-card">
                    <span className="stat-label">Total Events</span>
                    <span className="stat-value">{stats.events}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Results Published</span>
                    <span className="stat-value">{stats.results}</span>
                </div>
                <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab("teams")}>
                    <span className="stat-label">Live Standings</span>
                    <span className="stat-value">View Table 🏆</span>
                </div>
            </div>

            {/* TABS */}
            <div className="dashboard-tabs">
                <button
                    className={`tab-btn ${activeTab === "events" ? "active" : ""}`}
                    onClick={() => setActiveTab("events")}
                >
                    📅 Events
                </button>
                <button
                    className={`tab-btn ${activeTab === "registrations" ? "active" : ""}`}
                    onClick={() => setActiveTab("registrations")}
                >
                    📝 Registrations
                </button>
                <button
                    className={`tab-btn ${activeTab === "results" ? "active" : ""}`}
                    onClick={() => setActiveTab("results")}
                >
                    🏅 Results
                </button>
                <button
                    className={`tab-btn ${activeTab === "teams" ? "active" : ""}`}
                    onClick={() => setActiveTab("teams")}
                >
                    🏆 Points Table
                </button>
                <button
                    className={`tab-btn ${activeTab === "announcements" ? "active" : ""}`}
                    onClick={() => setActiveTab("announcements")}
                >
                    📢 Ticker
                </button>
                <button
                    className={`tab-btn ${activeTab === "gallery" ? "active" : ""}`}
                    onClick={() => setActiveTab("gallery")}
                >
                    🖼️ Gallery
                </button>
            </div>

            {/* CONTENT */}
            <div className="dashboard-content">
                {activeTab === "events" && <ManageEvents />}
                {activeTab === "registrations" && <ManageRegistrations />}
                {activeTab === "results" && <ManageResults />}
                {activeTab === "teams" && <ManageTeams />}
                {activeTab === "announcements" && <ManageAnnouncements />}
                {activeTab === "gallery" && <ManageGallery />}
            </div>
        </div>
    );
}

export default Dashboard;
