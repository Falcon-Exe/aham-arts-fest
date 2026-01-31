import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import ConfirmDialog from "../components/ConfirmDialog";
import "./Dashboard.css"; // Import the new CSS

import ManageEvents from "../components/ManageEvents";
import ManageResults from "../components/ManageResults";
import ManageAnnouncements from "../components/ManageAnnouncements";
import ManageTeams from "../components/ManageTeams";
import ManageIndividualPoints from "../components/ManageIndividualPoints";
import ManageStudentProfiles from "../components/ManageStudentProfiles";
import ManageGallery from "../components/ManageGallery";
import ManageRegistrations from "../components/ManageRegistrations";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useConfirm } from "../hooks/useConfirm";
import { ADMIN_EMAILS } from "../constants/auth";

function Dashboard() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("events");
    const [stats, setStats] = useState({ events: 0, results: 0 });
    const navigate = useNavigate();
    const { confirm, confirmState } = useConfirm();

    const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);

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

        // Registration Lock Listener
        const unsubSettings = onSnapshot(doc(db, "settings", "config"), (docSnap) => {
            if (docSnap.exists()) {
                setIsRegistrationOpen(docSnap.data().isRegistrationOpen ?? true);
            } else {
                setDoc(doc(db, "settings", "config"), { isRegistrationOpen: true }, { merge: true });
            }
        });

        // Maintenance Mode Listener
        const unsubPublic = onSnapshot(doc(db, "settings", "publicConfig"), (docSnap) => {
            if (docSnap.exists()) {
                setMaintenanceMode(docSnap.data().maintenanceMode ?? false);
            }
        });

        return () => {
            unsubscribe();
            unsubEvents();
            unsubResults();
            unsubSettings();
            unsubPublic();
        };
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/");
    };

    const toggleRegistrationLock = async () => {
        if (!await confirm(`Are you sure you want to ${isRegistrationOpen ? "LOCK" : "UNLOCK"} registrations?`)) return;
        try {
            await setDoc(doc(db, "settings", "config"), { isRegistrationOpen: !isRegistrationOpen }, { merge: true });
        } catch (error) {
            console.error("Error updating settings:", error);
            alert("Failed to update registration status.");
        }
    };

    const toggleMaintenanceMode = async () => {
        const action = maintenanceMode ? "DISABLE" : "ENABLE";
        if (!await confirm(`Are you sure you want to ${action} Maintenance Mode?\n\nWhen enabled, regular users will see a 'Be Back Soon' screen. You (Admin) will still have access.`)) return;

        try {
            await setDoc(doc(db, "settings", "publicConfig"), { maintenanceMode: !maintenanceMode }, { merge: true });
        } catch (error) {
            console.error("Error toggling maintenance:", error);
            alert("Failed to update maintenance settings.");
        }
    };

    if (loading) return <div className="loader">Loading...</div>;

    return (
        <div className="dashboard-container">
            {confirmState && <ConfirmDialog {...confirmState} />}
            <header className="dashboard-header">
                <div>
                    <h2 className="dashboard-title">Admin Dashboard</h2>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '4px' }}>
                        Authorized: {user?.email}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={toggleRegistrationLock}
                        className="tab-btn"
                        style={{
                            background: isRegistrationOpen ? '#22c55e' : '#ef4444',
                            color: 'white',
                            border: 'none',
                            fontWeight: 'bold'
                        }}
                    >
                        {isRegistrationOpen ? "🔓 Registrations: OPEN" : "🔒 Registrations: CLOSED"}
                    </button>

                    <button
                        onClick={toggleMaintenanceMode}
                        className="tab-btn"
                        style={{
                            background: maintenanceMode ? '#ef4444' : '#22c55e',
                            color: 'white',
                            border: 'none',
                            fontWeight: 'bold',
                            boxShadow: maintenanceMode ? '0 0 10px #ef4444' : 'none'
                        }}
                    >
                        {maintenanceMode ? "🛑 Maintenance: ON" : "✅ Maintenance: OFF"}
                    </button>

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
            </div >

            {/* TABS */}
            < div className="dashboard-tabs" >
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
                    🏆 Team Points
                </button>
                <button
                    className={`tab-btn ${activeTab === "individual" ? "active" : ""}`}
                    onClick={() => setActiveTab("individual")}
                >
                    👤 Individual Points
                </button>
                <button
                    className={`tab-btn ${activeTab === "profiles" ? "active" : ""}`}
                    onClick={() => setActiveTab("profiles")}
                >
                    🔎 Student Search
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
            </div >

            {/* CONTENT */}
            < div className="dashboard-content" >
                {activeTab === "events" && <ManageEvents />
                }
                {activeTab === "registrations" && <ManageRegistrations />}
                {activeTab === "results" && <ManageResults />}
                {activeTab === "teams" && <ManageTeams />}
                {activeTab === "individual" && <ManageIndividualPoints />}
                {activeTab === "profiles" && <ManageStudentProfiles />}
                {activeTab === "announcements" && <ManageAnnouncements />}
                {activeTab === "gallery" && <ManageGallery />}
            </div >
        </div >
    );
}

export default Dashboard;
