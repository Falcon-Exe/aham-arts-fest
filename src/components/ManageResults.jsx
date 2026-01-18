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
            <h3 className="section-title">Publish Results</h3>

            <form onSubmit={handleSubmit} className="admin-form">
                <div className="form-grid">
                    <select
                        className="admin-select"
                        value={formData.eventId}
                        onChange={e => setFormData({ ...formData, eventId: e.target.value })}
                        required
                    >
                        <option value="">-- Select Event --</option>
                        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                    </select>

                    <select
                        className="admin-select"
                        value={formData.place}
                        onChange={e => setFormData({ ...formData, place: e.target.value })}
                    >
                        <option value="First">First Prize 🥇</option>
                        <option value="Second">Second Prize 🥈</option>
                        <option value="Third">Third Prize 🥉</option>
                    </select>

                    <input className="admin-input" placeholder="Student Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    <input className="admin-input" placeholder="Team (e.g. Red House)" value={formData.team} onChange={e => setFormData({ ...formData, team: e.target.value })} required />
                    <input className="admin-input" placeholder="Grade (e.g. A, B)" value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} />
                    <input className="admin-input" placeholder="Chest No" value={formData.chestNo} onChange={e => setFormData({ ...formData, chestNo: e.target.value })} />
                </div>
                <button type="submit" className="submit-btn">Publish Winner</button>
            </form>

            <h4 style={{ marginTop: '30px', marginBottom: '16px', color: 'var(--primary)' }}>Published Results History</h4>
            <div className="admin-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Place</th>
                            <th>Name</th>
                            <th>Team</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map(r => (
                            <tr key={r.id}>
                                <td>{r.eventName}</td>
                                <td>{r.place}</td>
                                <td>{r.name}</td>
                                <td>{r.team}</td>
                                <td>
                                    <button onClick={() => handleDelete(r.id)} className="delete-btn">Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
