import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import "./Events.css";
import { getEventType, isGeneralEvent } from "../constants/events";

export default function Events() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Fetch events from Firestore 'events' collection
                const q = query(collection(db, "events"), orderBy("name"));
                const snapshot = await getDocs(q);
                const eventList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setEvents(eventList);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    const [activeTab, setActiveTab] = useState("All"); // On Stage, Off Stage, All

    const filteredEvents = events.filter((event) => {
        const matchesSearch = event.name?.toLowerCase().includes(search.toLowerCase()) ||
            event.category?.toLowerCase().includes(search.toLowerCase());

        const eventMainType = getEventType(event.name);
        const isGeneral = isGeneralEvent(event.name);

        const matchesTab = activeTab === "All" ||
            (activeTab === "General" ? isGeneral : (eventMainType === activeTab && !isGeneral));

        return matchesSearch && matchesTab;
    });

    return (
        <div className="container events-page">
            <header className="events-header">
                <h2 className="events-title">Events & Schedule</h2>
                <div className="live-status">
                    <span className="live-dot"></span>
                    Festival Schedule
                </div>
            </header>

            <div className="dashboard-controls">
                {/* Search Bar */}
                <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="events-search"
                        placeholder="Search events, category..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* TAB NAVIGATION */}
                <div className="team-filter-bar events-tabs">
                    {["On Stage", "Off Stage", "General", "All"].map(tab => (
                        <button
                            key={tab}
                            className={`team-pill ${activeTab === tab ? "active" : ""}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            <span className="pill-name">
                                {tab === "On Stage" ? "🎭 On Stage" : tab === "Off Stage" ? "📝 Off Stage" : tab === "General" ? "🌐 General" : "🌐 All"}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="loading-box">
                    <div className="spinner"></div>
                    <p>Fetching Events...</p>
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="empty-state">
                    <p>No events found in this category.</p>
                </div>
            ) : (
                <div className="events-grid">
                    {filteredEvents.map((event) => (
                        <div key={event.id} className="results-card event-card">
                            <div className="event-card-header">
                                <h3 className="event-name">{event.name}</h3>
                                <div className="badge-group">
                                    <span className={`type-badge badge-${getEventType(event.name).toLowerCase().replace(' ', '-')}`}>
                                        {getEventType(event.name)}
                                    </span>
                                    {isGeneralEvent(event.name) && (
                                        <span className="type-badge badge-general">General</span>
                                    )}
                                </div>
                            </div>

                            <div className="event-category">
                                {event.category}
                            </div>

                            <div className="event-details">
                                <div className="detail-item">
                                    <span className="detail-icon">📅</span>
                                    <div className="detail-content">
                                        <label>Date</label>
                                        <p>{event.date || "TBA"}</p>
                                    </div>
                                </div>

                                <div className="detail-item">
                                    <span className="detail-icon">⏰</span>
                                    <div className="detail-content">
                                        <label>Time</label>
                                        <p>{event.time || "TBA"}</p>
                                    </div>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-icon">🎭</span>
                                    <div className="detail-content">
                                        <label>Stage</label>
                                        <p>{event.stage || "Main Stage"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
