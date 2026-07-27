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

    const [activeCategoryTab, setActiveCategoryTab] = useState("Overall");
    const [activeTab, setActiveTab] = useState("All"); // On Stage, Off Stage, General, All

    // Load dynamic student categories
    let dynamicCategories = [];
    try {
        const storedCats = localStorage.getItem("branding_studentCategories");
        if (storedCats) dynamicCategories = JSON.parse(storedCats);
    } catch (e) {
        console.error(e);
    }
    if (dynamicCategories.length === 0) {
        dynamicCategories = ["Junior", "Senior"];
    }

    const filteredEvents = events.filter((event) => {
        const matchesSearch = event.name?.toLowerCase().includes(search.toLowerCase()) ||
            event.category?.toLowerCase().includes(search.toLowerCase()) ||
            event.studentCategory?.toLowerCase().includes(search.toLowerCase());

        const eventMainType = event.type || getEventType(event.name) || "On Stage";
        const isGeneral = event.type === "General" || isGeneralEvent(event.name);

        const matchesStageTab = activeTab === "All" ||
            (activeTab === "General" ? isGeneral : (eventMainType === activeTab && !isGeneral));

        let matchesCategoryTab = true;
        if (activeCategoryTab !== "Overall") {
            let eventCat = event.studentCategory || "General";
            if (eventCat === "Common/General" || eventCat === "Common / General") {
                eventCat = "General";
            }

            if (activeCategoryTab === "General") {
                matchesCategoryTab = isGeneral || eventCat === "General";
            } else {
                const isJoint = eventCat === "Junior & Senior" || eventCat === "Junior/Senior";
                matchesCategoryTab = eventCat === activeCategoryTab || isJoint;
            }
        }

        return matchesSearch && matchesStageTab && matchesCategoryTab;
    });

    return (
        <div className="container events-page">
            <header className="events-header">
                <h2 className="events-title">Events & Schedule</h2>
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
                    {search && (
                        <button 
                            className="search-clear-btn"
                            onClick={() => setSearch("")}
                            aria-label="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* CLASS CATEGORY TAB NAVIGATION */}
                <div className="tab-container" style={{ display: 'flex', gap: '8px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <button className="tab-btn" style={{ background: activeCategoryTab === "Overall" ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "8px 16px", borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: "600", fontSize: "0.85rem", transition: "all 0.2s ease" }} onClick={() => setActiveCategoryTab("Overall")}>
                        🏆 Overall
                    </button>
                    {dynamicCategories.map(cat => (
                        <button key={cat} className="tab-btn" style={{ background: activeCategoryTab === cat ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "8px 16px", borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: "600", fontSize: "0.85rem", transition: "all 0.2s ease" }} onClick={() => setActiveCategoryTab(cat)}>
                            👤 {cat}
                        </button>
                    ))}
                    <button className="tab-btn" style={{ background: activeCategoryTab === "General" ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "8px 16px", borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: "600", fontSize: "0.85rem", transition: "all 0.2s ease" }} onClick={() => setActiveCategoryTab("General")}>
                        🌐 General
                    </button>
                </div>

                {/* STAGE TYPE TAB NAVIGATION */}
                <div className="team-filter-bar events-tabs">
                    {["On Stage", "Off Stage", "General", "All"].map(tab => (
                        <button
                            key={tab}
                            className={`team-pill ${activeTab === tab ? "active" : ""}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            <span className="pill-name">
                                {tab === "On Stage" ? "🎭 On Stage" : tab === "Off Stage" ? "📝 Off Stage" : tab === "General" ? "🌐 General" : "📋 All Stages"}
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
                <div className="premium-empty-card stagger-reveal-grid">
                    <div className="empty-icon">🔍</div>
                    <h3 className="empty-title">No Events Found</h3>
                    <p className="empty-subtitle">We couldn't find any events matching your search or filters.</p>
                    <button 
                        className="empty-action-btn"
                        onClick={() => {
                            setSearch("");
                            setActiveTab("All");
                        }}
                    >
                        Reset All Filters
                    </button>
                </div>
            ) : (
                <div className="events-grid stagger-reveal-grid">
                    {filteredEvents.map((event) => (
                        <div key={event.id} className="results-card event-card premium-glass-hover">
                            <div className="event-card-header">
                                <h3 className="event-name">{event.name}</h3>
                                <div className="badge-group">
                                    {event.type === "General" || isGeneralEvent(event.name) ? (
                                        <>
                                            <span className="type-badge badge-general">General</span>
                                            {(event.generalSubtype || (getEventType(event.name) !== "Unknown" ? getEventType(event.name) : "On Stage")) && (
                                                <span className={`type-badge badge-${(event.generalSubtype || (getEventType(event.name) !== "Unknown" ? getEventType(event.name) : "On Stage")).toLowerCase().replace(' ', '-')}`}>
                                                    {event.generalSubtype || (getEventType(event.name) !== "Unknown" ? getEventType(event.name) : "On Stage")}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className={`type-badge badge-${(event.type || getEventType(event.name) || "On Stage").toLowerCase().replace(' ', '-')}`}>
                                            {event.type || getEventType(event.name) || "On Stage"}
                                        </span>
                                    )}
                                    <span className="type-badge badge-scope">
                                        {event.studentCategory === "General" ? "Common/General" : (event.studentCategory || "Common/General")}
                                    </span>
                                </div>
                            </div>

                            <div className="event-category">
                                {event.category}
                            </div>

                            <div className="event-details-row">
                                <div className="detail-pill">
                                    <span className="detail-icon">📅</span>
                                    <div className="detail-content">
                                        <label>Date</label>
                                        <p>{event.date || "TBA"}</p>
                                    </div>
                                </div>

                                <div className="detail-pill">
                                    <span className="detail-icon">⏰</span>
                                    <div className="detail-content">
                                        <label>Time</label>
                                        <p>{event.time || "TBA"}</p>
                                    </div>
                                </div>

                                <div className="detail-pill">
                                    <span className="detail-icon">📍</span>
                                    <div className="detail-content">
                                        <label>Venue</label>
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
