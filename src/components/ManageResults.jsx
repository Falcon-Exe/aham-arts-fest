import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, orderBy, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export default function ManageResults() {
    const [events, setEvents] = useState([]);
    const [results, setResults] = useState([]);
    const [formData, setFormData] = useState({
        eventId: "",
        eventName: "",
        place: "First",
        name: "",
        team: "",
        grade: "", // Optional
        chestNo: ""
    });

    // Fetch Events to populate dropdown
    useEffect(() => {
        const fetchEvents = async () => {
            const q = query(collection(db, "events"), orderBy("name"));
            const snap = await getDocs(q);
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchEvents();
        fetchResults();
    }, []);

    const fetchResults = async () => {
        const q = query(collection(db, "results"), orderBy("eventName"));
        const snap = await getDocs(q);
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.eventId || !formData.name) {
            alert("Please select an event and enter name");
            return;
        }

        try {
            // Find event name from ID
            const ev = events.find(e => e.id === formData.eventId);
            const payload = { ...formData, eventName: ev?.name || "Unknown" };

            await addDoc(collection(db, "results"), payload);
            alert("Result published!");
            setFormData({ ...formData, name: "", team: "", grade: "", chestNo: "" }); // Reset fields but keep event/place
            fetchResults();
        } catch (err) {
            console.error(err);
            alert("Error publishing result");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this result?")) return;
        await deleteDoc(doc(db, "results", id));
        fetchResults();
    }

    return (
        <div className="manage-results">
            <h3>Publish Results</h3>

            <form onSubmit={handleSubmit} style={{ background: "#f0f8ff", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
                <div style={{ display: "grid", gap: "10px", marginBottom: "10px" }}>
                    <select
                        value={formData.eventId}
                        onChange={e => setFormData({ ...formData, eventId: e.target.value })}
                        required
                        style={{ padding: "8px" }}
                    >
                        <option value="">-- Select Event --</option>
                        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                    </select>

                    <select
                        value={formData.place}
                        onChange={e => setFormData({ ...formData, place: e.target.value })}
                        style={{ padding: "8px" }}
                    >
                        <option value="First">First Prize 🥇</option>
                        <option value="Second">Second Prize 🥈</option>
                        <option value="Third">Third Prize 🥉</option>
                    </select>

                    <input placeholder="Student Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={{ padding: "8px" }} />
                    <input placeholder="Team (e.g. Red House)" value={formData.team} onChange={e => setFormData({ ...formData, team: e.target.value })} required style={{ padding: "8px" }} />
                    <input placeholder="Grade (e.g. A, B)" value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} style={{ padding: "8px" }} />
                    <input placeholder="Chest No" value={formData.chestNo} onChange={e => setFormData({ ...formData, chestNo: e.target.value })} style={{ padding: "8px" }} />
                </div>
                <button type="submit" className="primary-btn">Publish Winner</button>
            </form>

            <h4>Published Results</h4>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#eee", textAlign: "left" }}>
                            <th>Event</th>
                            <th>Place</th>
                            <th>Name</th>
                            <th>Team</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map(r => (
                            <tr key={r.id} style={{ borderBottom: "1px solid #ddd" }}>
                                <td style={{ padding: "4px" }}>{r.eventName}</td>
                                <td style={{ padding: "4px" }}>{r.place}</td>
                                <td style={{ padding: "4px" }}>{r.name}</td>
                                <td style={{ padding: "4px" }}>{r.team}</td>
                                <td style={{ padding: "4px" }}>
                                    <button onClick={() => handleDelete(r.id)} style={{ color: "red", border: "none", background: "none", cursor: "pointer" }}>x</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
