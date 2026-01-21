import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, query, orderBy, updateDoc, setDoc, onSnapshot } from "firebase/firestore";
import { getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Papa from "papaparse";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

import { getEventType, ALL_EVENTS, ON_STAGE_EVENTS } from "../constants/events";

export default function ManageEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    const [formData, setFormData] = useState({
        name: "",
        category: "",
        date: "",
        time: "",
        stage: "",
        type: "On Stage", // New field
    });



    const fetchEvents = async () => {
        if (!loading) setLoading(true);
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
        const run = async () => {
            await fetchEvents();
        };
        run();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps



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
            showToast("An event with this name already exists!", "error");
            return;
        }

        try {
            if (editId) {
                await updateDoc(doc(db, "events", editId), { ...formData, name: eventName });
                showToast("Event updated successfully!", "success");
            } else {
                await addDoc(collection(db, "events"), { ...formData, name: eventName });
                showToast("Event added successfully!", "success");
            }
            setFormData({ name: "", category: "", date: "", time: "", stage: "", type: "On Stage" });
            setEditId(null);
            fetchEvents(); // Refresh list
        } catch (err) {
            console.error("Error saving event:", err);
            showToast("Failed to save event.", "error");
        }
    };

    const handleEdit = (event) => {
        setFormData({
            name: event.name || "",
            category: event.category || "",
            date: event.date || "",
            time: event.time || "",
            stage: event.stage || "",
            type: event.type || "On Stage",
        });
        setEditId(event.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCancelEdit = () => {
        setFormData({ name: "", category: "", date: "", time: "", stage: "", type: "On Stage" });
        setEditId(null);
    };

    const handleSyncEvents = async () => {
        if (!await confirm("This will scan the master participant list and add any missing events. Continue?")) return;
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
                        // Extract all potential names from columns
                        const potentialColumns = ["ON STAGE ITEMS", "ON STAGE EVENTS", "OFF STAGE ITEMES", "OFF STAGE ITEMS", "OFF STAGE EVENTS"];

                        potentialColumns.forEach(col => {
                            if (p[col]) {
                                p[col].split(",").forEach(e => {
                                    const name = e.trim();
                                    if (name) eventSet.set(name, getEventType(name));
                                });
                            }
                        });
                    });

                    let addedCount = 0;
                    const existingNames = new Set(events.map(ev => ev.name.toLowerCase()));

                    for (const [name, type] of eventSet.entries()) {
                        if (!existingNames.has(name.toLowerCase())) {
                            await addDoc(collection(db, "events"), {
                                name: name,
                                category: "",
                                date: "",
                                time: "",
                                stage: "",
                                type: type // Strictly from getEventType
                            });
                            addedCount++;
                        }
                    }

                    showToast(`Sync Complete! Added ${addedCount} new events.`, "success");
                    fetchEvents();
                }
            });
        } catch (err) {
            console.error("Sync failed:", err);
            showToast("Failed to sync from master list.", "error");
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
                if (lines.length < 2) {
                    showToast("CSV file seems empty or only contains headers.", "error");
                    return;
                }
            }

            // Parse headers and clean them
            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
            console.log("Detected Headers:", headers);

            let addedCount = 0;
            let skipCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(",").map(v => v.trim());
                const row = {};
                headers.forEach((header, i) => {
                    row[header] = values[i] || "";
                });

                // Robust Header Mapping
                const name = row.name || row.eventname || row.event || row.item || "";

                const eventObj = {
                    name: name,
                    category: row.category || row.cat || "",
                    date: row.date || row.day || "",
                    time: row.time || row.schedule || "",
                    stage: row.stage || row.platform || "",
                    type: getEventType(name)
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

            showToast(`Processing Finished! Added: ${addedCount}, Skipped: ${skipCount}`, "success");
            fetchEvents();
        };
        reader.readAsText(file);
    };

    const handleDelete = async (id) => {
        if (!await confirm("Are you sure you want to delete this event?")) return;
        try {
            await deleteDoc(doc(db, "events", id));
            fetchEvents();
        } catch (err) {
            console.error("Error deleting event:", err);
        }
    };

    const handleSeedDatabase = async () => {
        if (!await confirm(`This will verify all ${ALL_EVENTS.length} events from the master list are in the database. Continue?`)) return;
        setLoading(true);
        let addedCount = 0;

        try {
            // 1. Get existing events
            const q = query(collection(db, "events"));
            const snapshot = await getDocs(q);
            const existingNames = new Set(snapshot.docs.map(d => d.data().name.trim().toUpperCase()));

            // 2. Check and Add missing
            for (const eventName of ALL_EVENTS) {
                if (!existingNames.has(eventName.trim().toUpperCase())) {
                    await addDoc(collection(db, "events"), {
                        name: eventName,
                        category: "",
                        date: "",
                        time: "",
                        stage: "",
                        type: getEventType(eventName)
                    });
                    addedCount++;
                }
            }

            showToast(`Seed Complete! Added ${addedCount} missing events.`, "success");
            fetchEvents();
        } catch (err) {
            console.error("Seeding failed:", err);
            showToast("Failed to seed database.", "error");
        }
        setLoading(false);
    };

    // TEMP FIX: ONE-TIME RUN TO CLASSIFY EVENTS
    const fixEventTypes = async () => {
        if (!await confirm("This will RECLASSIFY all events based on the hardcoded list (On Stage vs Off Stage). Continue?")) return;
        setLoading(true);

        let updatedCount = 0;
        try {
            for (const ev of events) {
                const upperName = ev.name.trim().toUpperCase();
                let newType = "Off Stage"; // Default

                // Check if it's in the On Stage list
                if (ON_STAGE_EVENTS.includes(upperName)) {
                    newType = "On Stage";
                }

                if (ev.type !== newType) {
                    await updateDoc(doc(db, "events", ev.id), { type: newType });
                    updatedCount++;
                }
            }
            showToast(`Classification Complete! Updated ${updatedCount} events.`, "success");
            fetchEvents();
        } catch (err) {
            console.error("Fix failed:", err);
            showToast("Failed to update events.", "error");
        }
        setLoading(false);
    };

    // STRICT SYNC: Ensures DB matches ALL_EVENTS exactly (Adds missing, Deletes extras)
    const handleStrictSync = async () => {
        if (!await confirm(`This will force the database to match exactly the ${ALL_EVENTS.length} events in your code.\n\n⚠️ Any events NOT in the list will be DELETED.\n⚠️ Missing events will be ADDED.\n\nAre you sure?`)) return;
        setLoading(true);

        try {
            // 1. Fetch current DB events
            const q = query(collection(db, "events"));
            const snapshot = await getDocs(q);
            const dbEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            let deletedCount = 0;
            let addedCount = 0;

            const masterNameSet = new Set(ALL_EVENTS.map(n => n.trim().toUpperCase()));

            // 2. Delete extras
            for (const ev of dbEvents) {
                if (!masterNameSet.has(ev.name.trim().toUpperCase())) {
                    await deleteDoc(doc(db, "events", ev.id));
                    deletedCount++;
                }
            }

            // 3. Add missing
            const dbNameSet = new Set(dbEvents.map(ev => ev.name.trim().toUpperCase()));
            // Note: We shouldn't use dbNameSet directly because we just deleted some.
            // But since we are iterating ALL_EVENTS, we check if the ORIGINAL db list had it.
            // Actually, if we deleted it, it wasn't in ALL_EVENTS, so no conflict.
            // We just need to check if a VALID event is missing.

            // Re-eval: check if ev is in the "kept" events.
            // Converting dbEvents to a set of names that ARE in master list
            const keptDbNames = new Set(dbEvents.filter(ev => masterNameSet.has(ev.name.trim().toUpperCase())).map(ev => ev.name.trim().toUpperCase()));

            for (const name of ALL_EVENTS) {
                if (!keptDbNames.has(name.trim().toUpperCase())) {
                    await addDoc(collection(db, "events"), {
                        name: name,
                        category: "",
                        date: "",
                        time: "",
                        stage: "",
                        type: getEventType(name)
                    });
                    addedCount++;
                }
            }

            showToast(`Strict Sync Complete! Deleted: ${deletedCount}, Added: ${addedCount}`, "success");
            fetchEvents();

        } catch (err) {
            console.error("Strict Sync failed:", err);
            showToast("Failed to sync database.", "error");
        }
        setLoading(false);
    };

    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

    const sortedEvents = [...events].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (name) => {
        if (sortConfig.key !== name) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    return (
        <div className="manage-events">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}
            <h3 className="section-title">Admin Results</h3>

            {/* ADD FORM */}
            <form onSubmit={handleSubmit} className="admin-form">
                <h4>{editId ? "Edit Event" : "Add New Event"}</h4>
                <div className="form-grid">
                    <input className="admin-input full-width" name="name" placeholder="Event Name" value={formData.name} onChange={handleChange} required />
                    <input className="admin-input" name="category" placeholder="Category (e.g. Dance)" value={formData.category} onChange={handleChange} />
                    <input className="admin-input" name="date" placeholder="Date (e.g. Day 1)" value={formData.date} onChange={handleChange} />
                    <input className="admin-input" name="time" placeholder="Time (e.g. 10:00 AM)" value={formData.time} onChange={handleChange} />
                    <input className="admin-input" name="stage" placeholder="Stage" value={formData.stage} onChange={handleChange} />
                    <select className="admin-select" name="type" value={formData.type} onChange={handleChange}>
                        <option value="On Stage">On Stage 🎭</option>
                        <option value="Off Stage">Off Stage 📝</option>
                        <option value="General">General 🌐</option>
                    </select>
                </div>
                <div className="admin-form-actions" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                    <button type="submit" className="submit-btn" style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}>
                        {editId ? "Update Event ✓" : "Add Event +"}
                    </button>

                    {editId && (
                        <button type="button" onClick={handleCancelEdit} className="submit-btn" style={{ background: '#555', width: '100%' }}>
                            Cancel
                        </button>
                    )}

                    {!editId && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', width: '100%' }}>
                            <button type="button" onClick={handleSyncEvents} className="submit-btn" style={{ background: '#1a1a1a', fontSize: '0.85rem' }}>
                                🔄 Sync Master
                            </button>
                            <button type="button" onClick={handleSeedDatabase} className="submit-btn" style={{ background: '#22c55e', fontSize: '0.85rem' }}>
                                🌱 Seed DB
                            </button>
                            <label className="submit-btn" style={{ background: '#333', cursor: 'pointer', textAlign: 'center', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                📥 Bulk CSV
                                <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
                            </label>
                            <button type="button" onClick={handleStrictSync} className="submit-btn" style={{ background: '#ff9800', fontSize: '0.85rem' }}>
                                ⚠️ Strict Sync
                            </button>
                            <button type="button" onClick={fixEventTypes} className="submit-btn" style={{ background: '#e63946', fontSize: '0.85rem' }}>
                                🔧 Fix Types
                            </button>

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
                                <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>Name{getSortIndicator('name')}</th>
                                <th onClick={() => requestSort('category')} style={{ cursor: 'pointer' }}>Category{getSortIndicator('category')}</th>
                                <th onClick={() => requestSort('type')} style={{ cursor: 'pointer' }}>Type{getSortIndicator('type')}</th>
                                <th onClick={() => requestSort('time')} style={{ cursor: 'pointer' }}>Time{getSortIndicator('time')}</th>
                                <th onClick={() => requestSort('date')} style={{ cursor: 'pointer' }}>Date{getSortIndicator('date')}</th>
                                <th onClick={() => requestSort('stage')} style={{ cursor: 'pointer' }}>Stage{getSortIndicator('stage')}</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedEvents.map((ev) => (
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
                                    <td>{ev.date}</td>
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

