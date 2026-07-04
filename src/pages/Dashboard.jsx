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
import ManageTeamAccounts from "../components/ManageTeamAccounts";
import ManageStudents from "../components/ManageStudents";
import ManageRegistrations from "../components/ManageRegistrations";
import ManageAuditLogs from "../components/ManageAuditLogs";
import ManageSettings from "../components/ManageSettings";
import { collection, onSnapshot, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useConfirm } from "../hooks/useConfirm";
import { ADMIN_EMAILS } from "../constants/auth";

function Dashboard() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("events");
    const [stats, setStats] = useState({ events: 0, participants: 0, teams: 0 });
    const navigate = useNavigate();
    const { confirm, confirmState } = useConfirm();

    const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
    const [onStageOpen, setOnStageOpen] = useState(true);
    const [offStageOpen, setOffStageOpen] = useState(true);
    const [generalOpen, setGeneralOpen] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                navigate("/admin");
            } else {
                const email = currentUser.email.toLowerCase();
                let isAuthorized = ADMIN_EMAILS.includes(email);

                if (!isAuthorized) {
                    try {
                        const adminDoc = await getDoc(doc(db, "admins", email));
                        if (adminDoc.exists()) {
                            isAuthorized = true;
                        }
                    } catch (err) {
                        console.error("Error verifying admin whitelist:", err);
                    }
                }

                if (!isAuthorized) {
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
                const data = docSnap.data();
                setIsRegistrationOpen(data.isRegistrationOpen ?? true);
                setOnStageOpen(data.onStageOpen ?? true);
                setOffStageOpen(data.offStageOpen ?? true);
                setGeneralOpen(data.generalOpen ?? true);
            } else {
                setDoc(doc(db, "settings", "config"), { 
                    isRegistrationOpen: true,
                    onStageOpen: true,
                    offStageOpen: true,
                    generalOpen: true
                }, { merge: true });
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

    const toggleCategoryLock = async (category, currentState) => {
        const catName = category === 'onStageOpen' ? 'On Stage' : (category === 'offStageOpen' ? 'Off Stage' : 'General');
        if (!await confirm(`Are you sure you want to ${currentState ? "LOCK" : "UNLOCK"} ${catName} registrations?`)) return;
        try {
            await setDoc(doc(db, "settings", "config"), { [category]: !currentState }, { merge: true });
        } catch (error) {
            console.error("Error updating settings:", error);
            alert(`Failed to update ${catName} registration status.`);
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
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                            className="tab-btn"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-soft)', fontWeight: 'bold' }}
                        >
                            🛠️ Category Toggles {showCategoryMenu ? '▴' : '▾'}
                        </button>
                        
                        {showCategoryMenu && (
                            <div style={{ 
                                position: 'absolute', 
                                top: '100%', 
                                left: 0, 
                                marginTop: '8px',
                                background: 'var(--bg-main)', 
                                border: '1px solid var(--border-soft)', 
                                borderRadius: '8px',
                                padding: '12px',
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '8px',
                                zIndex: 100,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                minWidth: '180px'
                            }}>
                                <button
                                    onClick={() => { toggleCategoryLock('onStageOpen', onStageOpen); setShowCategoryMenu(false); }}
                                    className="tab-btn"
                                    style={{ background: onStageOpen ? '#22c55e' : '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', width: '100%', justifyContent: 'flex-start' }}
                                >
                                    🎭 On Stage: {onStageOpen ? "ON" : "OFF"}
                                </button>
                                <button
                                    onClick={() => { toggleCategoryLock('offStageOpen', offStageOpen); setShowCategoryMenu(false); }}
                                    className="tab-btn"
                                    style={{ background: offStageOpen ? '#22c55e' : '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', width: '100%', justifyContent: 'flex-start' }}
                                >
                                    📝 Off Stage: {offStageOpen ? "ON" : "OFF"}
                                </button>
                                <button
                                    onClick={() => { toggleCategoryLock('generalOpen', generalOpen); setShowCategoryMenu(false); }}
                                    className="tab-btn"
                                    style={{ background: generalOpen ? '#22c55e' : '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', width: '100%', justifyContent: 'flex-start' }}
                                >
                                    🌐 General: {generalOpen ? "ON" : "OFF"}
                                </button>
                            </div>
                        )}
                    </div>

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
                    🔎 Student Database
                </button>
                <button
                    className={`tab-btn ${activeTab === "team_accounts" ? "active" : ""}`}
                    onClick={() => setActiveTab("team_accounts")}
                >
                    🔐 Team Accounts
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
                <button
                    className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
                    onClick={() => setActiveTab("audit")}
                >
                    📜 Audit Logs
                </button>
                <button
                    className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
                    onClick={() => setActiveTab("settings")}
                >
                    ⚙️ Settings
                </button>
            </div >

            {/* CONTENT */}
            < div className="dashboard-content" >
                {activeTab === "events" && <ManageEvents />}
                {activeTab === "registrations" && <ManageRegistrations />}

                {activeTab === "results" && <ManageResults />}
                {activeTab === "teams" && <ManageTeams />}
                {activeTab === "individual" && <ManageIndividualPoints />}
                {activeTab === "profiles" && <ManageStudentProfiles />}
                {activeTab === "team_accounts" && <ManageTeamAccounts />}
                {activeTab === "announcements" && <ManageAnnouncements />}
                {activeTab === "gallery" && <ManageGallery />}
                {activeTab === "audit" && <ManageAuditLogs />}
                {activeTab === "settings" && <ManageSettings />}
            </div >
        </div >
    );
}

export default Dashboard;
