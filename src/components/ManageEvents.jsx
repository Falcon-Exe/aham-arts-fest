import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Papa from "papaparse";

export default function ManageEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        category: "",
        venue: "",
        time: "",
        stage: "",
        type: "On Stage", // New field
    });

    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

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
        const eventName = formData.name.trim();
        if (!eventName) return;

        // Validation: Check for duplicate (if not editing the same event)
        const isDuplicate = events.some(ev =>
            ev.id !== editId && ev.name.toLowerCase() === eventName.toLowerCase()
        );
        if (isDuplicate) {
            alert("An event with this name already exists!");
            return;
        }

        try {
            if (editId) {
                await updateDoc(doc(db, "events", editId), { ...formData, name: eventName });
                alert("Event updated successfully!");
            } else {
                await addDoc(collection(db, "events"), { ...formData, name: eventName });
                alert("Event added successfully!");
            }
            setFormData({ name: "", category: "", venue: "", time: "", stage: "", type: "On Stage" });
            setEditId(null);
            fetchEvents(); // Refresh list
        } catch (err) {
            console.error("Error saving event:", err);
            alert("Failed to save event.");
        }
    };

    const handleEdit = (event) => {
        setFormData({
            name: event.name || "",
            category: event.category || "",
            venue: event.venue || "",
            time: event.time || "",
            stage: event.stage || "",
            type: event.type || "On Stage",
        });
        setEditId(event.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCancelEdit = () => {
        setFormData({ name: "", category: "", venue: "", time: "", stage: "", type: "On Stage" });
        setEditId(null);
    };

    const handleSyncEvents = async () => {
        if (!window.confirm("This will scan the master participant list and add any missing events. Continue?")) return;
        setLoading(true);

        try {
            const res = await fetch(csvUrl + "&t=" + Date.now());
            const csv = await res.text();

            Papa.parse(csv, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const data = results.data;
                    const eventSet = new Map(); // Store as name -> type

                    data.forEach(p => {
                        const onStageStr = p["ON STAGE ITEMS"] || p["ON STAGE EVENTS"] || "";
                        const offStageStr = p["OFF STAGE ITEMES"] || p["OFF STAGE ITEMS"] || p["OFF STAGE EVENTS"] || "";

                        onStageStr.split(",").forEach(e => {
                            const name = e.trim();
                            if (name && !eventSet.has(name)) eventSet.set(name, "On Stage");
                        });

                        offStageStr.split(",").forEach(e => {
                            const name = e.trim();
                            if (name && !eventSet.has(name)) eventSet.set(name, "Off Stage");
                        });
                    });

                    let addedCount = 0;
                    const existingNames = new Set(events.map(ev => ev.name.toLowerCase()));

                    for (const [name, type] of eventSet.entries()) {
                        if (!existingNames.has(name.toLowerCase())) {
                            await addDoc(collection(db, "events"), {
                                name: name,
                                category: "",
                                venue: "",
                                time: "",
                                stage: "",
                                type: type
                            });
                            addedCount++;
                        }
                    }

                    alert(`Sync Complete!\nFound ${eventSet.size} unique events.\n✅ Added ${addedCount} new events.`);
                    fetchEvents();
                }
            });
        } catch (err) {
            console.error("Sync failed:", err);
            alert("Failed to sync from master list.");
        }
        setLoading(false);
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            let csvData = event.target.result;

            // Remove UTF-8 BOM if present
            if (csvData.charCodeAt(0) === 0xFEFF) {
                csvData = csvData.slice(1);
            }

            // Split into lines, handling both \r\n and \n
            const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) {
                alert("CSV file seems empty or only contains headers.");
                return;
            }

            // Parse headers and clean them
            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
            console.log("Detected Headers:", headers);

            let addedCount = 0;
            let skipCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(",").map(v => v.trim());
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || "";
                });

                // Robust Header Mapping
                const eventObj = {
                    name: row.name || row.eventname || row.event || row.item || "",
                    category: row.category || row.cat || "",
                    venue: row.venue || row.location || "",
                    time: row.time || row.schedule || "",
                    stage: row.stage || row.platform || "",
                    type: row.type || row.classification || "On Stage"
                };

                if (eventObj.name) {
                    try {
                        await addDoc(collection(db, "events"), eventObj);
                        addedCount++;
                    } catch (err) {
                        console.error("Row add failed:", i, err);
                        skipCount++;
                    }
                } else {
                    skipCount++;
                }
            }

            alert(`Processing Finished!\n✅ Added: ${addedCount}\n⚠️ Skipped: ${skipCount}`);
            fetchEvents();
        };
        reader.readAsText(file);
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
                <h4>{editId ? "Edit Event" : "Add New Event"}</h4>
                <div className="form-grid">
                    <input className="admin-input full-width" name="name" placeholder="Event Name" value={formData.name} onChange={handleChange} required />
                    <input className="admin-input" name="category" placeholder="Category (e.g. Dance)" value={formData.category} onChange={handleChange} />
                    <input className="admin-input" name="venue" placeholder="Venue" value={formData.venue} onChange={handleChange} />
                    <input className="admin-input" name="time" placeholder="Time (e.g. 10:00 AM)" value={formData.time} onChange={handleChange} />
                    <input className="admin-input" name="stage" placeholder="Stage" value={formData.stage} onChange={handleChange} />
                    <select className="admin-select" name="type" value={formData.type} onChange={handleChange}>
                        <option value="On Stage">On Stage 🎭</option>
                        <option value="Off Stage">Off Stage 📝</option>
                    </select>
                </div>
                <div className="admin-form-actions" style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                    <button type="submit" className="submit-btn" style={{ flex: 2 }}>
                        {editId ? "Update Event ✓" : "Add Event +"}
                    </button>
                    {editId && (
                        <button type="button" onClick={handleCancelEdit} className="submit-btn" style={{ flex: 1, background: '#555' }}>
                            Cancel
                        </button>
                    )}
                    {!editId && (
                        <div style={{ flex: 1, display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={handleSyncEvents} className="submit-btn" style={{ flex: 1, background: '#1a1a1a', fontSize: '0.85rem' }}>
                                🔄 Sync from Master
                            </button>
                            <label className="submit-btn" style={{ flex: 1, background: '#333', cursor: 'pointer', textAlign: 'center', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                📥 Bulk Upload (CSV)
                                <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
                            </label>
                        </div>
                    )}
                </div>
            </form>

            {/* LIST */}
            {loading ? <p>Loading events...</p> : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Type</th>
                                <th>Time</th>
                                <th>Venue</th>
                                <th>Stage</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((ev) => (
                                <tr key={ev.id}>
                                    <td style={{ fontWeight: '600' }}>{ev.name}</td>
                                    <td>{ev.category}</td>
                                    <td>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            background: ev.type === 'Off Stage' ? '#333' : 'rgba(230, 57, 70, 0.1)',
                                            color: ev.type === 'Off Stage' ? '#aaa' : '#e63946',
                                            border: `1px solid ${ev.type === 'Off Stage' ? '#444' : '#e63946'}`
                                        }}>
                                            {ev.type || 'On Stage'}
                                        </span>
                                    </td>
                                    <td>{ev.time}</td>
                                    <td>{ev.venue}</td>
                                    <td>{ev.stage}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleEdit(ev)} className="tab-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: 'auto', background: '#222' }}>Edit</button>
                                            <button onClick={() => handleDelete(ev.id)} className="delete-btn">Delete</button>
                                        </div>
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
