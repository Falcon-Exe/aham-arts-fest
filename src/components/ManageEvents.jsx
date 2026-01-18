import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export default function ManageEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: "",
        category: "",
        venue: "",
        time: "",
        stage: "",
    });

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "events"), orderBy("name"));
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setEvents(list);
        } catch (err) {
            console.error("Error fetching events:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) return;

        try {
            await addDoc(collection(db, "events"), formData);
            setFormData({ name: "", category: "", venue: "", time: "", stage: "" });
            fetchEvents(); // Refresh list
            alert("Event added successfully!");
        } catch (err) {
            console.error("Error adding event:", err);
            alert("Failed to add event.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this event?")) return;
        try {
            await deleteDoc(doc(db, "events", id));
            fetchEvents();
        } catch (err) {
            console.error("Error deleting event:", err);
        }
    };

    return (
        <div className="manage-events">
            <h3>Manage Events</h3>

            {/* ADD FORM */}
            <form onSubmit={handleSubmit} style={{ background: "#f9f9f9", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
                <h4>Add New Event</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    <input name="name" placeholder="Event Name" value={formData.name} onChange={handleChange} required style={{ padding: "8px" }} />
                    <input name="category" placeholder="Category (e.g. Dance)" value={formData.category} onChange={handleChange} style={{ padding: "8px" }} />
                    <input name="venue" placeholder="Venue" value={formData.venue} onChange={handleChange} style={{ padding: "8px" }} />
                    <input name="time" placeholder="Time (e.g. 10:00 AM)" value={formData.time} onChange={handleChange} style={{ padding: "8px" }} />
                    <input name="stage" placeholder="Stage" value={formData.stage} onChange={handleChange} style={{ padding: "8px" }} />
                </div>
                <button type="submit" className="primary-btn">Add Event</button>
            </form>

            {/* LIST */}
            {loading ? <p>Loading...</p> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                        <tr style={{ background: "#eee", textAlign: "left" }}>
                            <th style={{ padding: "8px" }}>Name</th>
                            <th style={{ padding: "8px" }}>Time</th>
                            <th style={{ padding: "8px" }}>Venue</th>
                            <th style={{ padding: "8px" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map((ev) => (
                            <tr key={ev.id} style={{ borderBottom: "1px solid #ddd" }}>
                                <td style={{ padding: "8px" }}>{ev.name}</td>
                                <td style={{ padding: "8px" }}>{ev.time}</td>
                                <td style={{ padding: "8px" }}>{ev.venue}</td>
                                <td style={{ padding: "8px" }}>
                                    <button onClick={() => handleDelete(ev.id)} style={{ background: "red", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
