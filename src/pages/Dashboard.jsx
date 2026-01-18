import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import "./Dashboard.css"; // Import the new CSS

import ManageEvents from "../components/ManageEvents";
import ManageResults from "../components/ManageResults";
import ManageAnnouncements from "../components/ManageAnnouncements";

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

    if (loading) return <div className="loader">Loading...</div>;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h2 className="dashboard-title">Admin Dashboard</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Welcome, {user?.email}
                    </p>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                    Scan Logout ➜
                </button>
            </header>

            {/* TABS */}
            <div className="dashboard-tabs">
                <button
                    className={`tab-btn ${activeTab === "events" ? "active" : ""}`}
                    onClick={() => setActiveTab("events")}
                >
                    📅 Manage Events
                </button>
                <button
                    className={`tab-btn ${activeTab === "results" ? "active" : ""}`}
                    onClick={() => setActiveTab("results")}
                >
                    🏆 Publish Results
                </button>
                <button
                    className={`tab-btn ${activeTab === "announcements" ? "active" : ""}`}
                    onClick={() => setActiveTab("announcements")}
                >
                    📢 Announcements
                </button>
            </div>

            {/* CONTENT */}
            <div className="dashboard-content">
                {activeTab === "events" && <ManageEvents />}
                {activeTab === "results" && <ManageResults />}
                {activeTab === "announcements" && <ManageAnnouncements />}
            </div>
        </div>
    );
}

export default Dashboard;
