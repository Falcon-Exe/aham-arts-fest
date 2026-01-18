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
            // timeout after 5 seconds
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Connection timed out. Check your internet or Firebase config.")), 5000)
            );

            const q = query(collection(db, "events"), orderBy("name"));
            const snapshot = await Promise.race([getDocs(q), timeoutPromise]);

            const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setEvents(list);
        } catch (err) {
            console.error("Error fetching events:", err);
            // alert(`Error: ${err.message}`); // Silent fail better for UX, logs are enough
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
            <h3 className="section-title">Manage Events</h3>

            {/* ADD FORM */}
            <form onSubmit={handleSubmit} className="admin-form">
                <h4>Add New Event</h4>
                <div className="form-grid">
                    <input className="admin-input" name="name" placeholder="Event Name" value={formData.name} onChange={handleChange} required />
                    <input className="admin-input" name="category" placeholder="Category (e.g. Dance)" value={formData.category} onChange={handleChange} />
                    <input className="admin-input" name="venue" placeholder="Venue" value={formData.venue} onChange={handleChange} />
                    <input className="admin-input" name="time" placeholder="Time (e.g. 10:00 AM)" value={formData.time} onChange={handleChange} />
                    <input className="admin-input" name="stage" placeholder="Stage" value={formData.stage} onChange={handleChange} />
                </div>
                <button type="submit" className="submit-btn">Add Event +</button>
            </form>

            {/* LIST */}
            {loading ? <p>Loading events...</p> : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Time</th>
                                <th>Venue</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((ev) => (
                                <tr key={ev.id}>
                                    <td style={{ fontWeight: '600' }}>{ev.name}</td>
                                    <td>{ev.category}</td>
                                    <td>{ev.time}</td>
                                    <td>{ev.venue}</td>
                                    <td>
                                        <button onClick={() => handleDelete(ev.id)} className="delete-btn">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
