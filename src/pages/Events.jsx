import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

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

    const filteredEvents = events.filter(
        (event) =>
            event.name?.toLowerCase().includes(search.toLowerCase()) ||
            event.category?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container">
            <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
                Events & Schedule 📅
            </h1>

            {/* Search Bar */}
            <div style={{ maxWidth: "400px", margin: "0 auto 30px" }}>
                <input
                    type="text"
                    placeholder="Search events..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        fontSize: "16px",
                    }}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: "center" }}>Loading events...</div>
            ) : events.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)" }}>
                    No events found. Admin can add them via Dashboard.
                </div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "16px",
                }}>
                    {filteredEvents.map((event) => (
                        <div key={event.id} className="card event-card">
                            <h3>{event.name}</h3>
                            <p style={{ color: "var(--primary-color)", fontWeight: "bold" }}>{event.category}</p>
                            <hr style={{ margin: "8px 0", border: "0", borderTop: "1px solid #eee" }} />
                            <p>📍 <strong>Venue:</strong> {event.venue || "TBA"}</p>
                            <p>⏰ <strong>Time:</strong> {event.time || "TBA"}</p>
                            <p>🎭 <strong>Stage:</strong> {event.stage || "Main Stage"}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
