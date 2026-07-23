import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, query, orderBy, updateDoc, writeBatch, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

import { getEventType, getEventScope, getGeneralSubtype, ALL_EVENTS, ON_STAGE_EVENTS } from "../constants/events";

export default function ManageEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();

    // Event Sync States
    const [detectedDbEvents, setDetectedDbEvents] = useState([]);
    const [loadingDetectedEvents, setLoadingDetectedEvents] = useState(false);
    const [syncOldEventName, setSyncOldEventName] = useState("");
    const [syncNewEventId, setSyncNewEventId] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);

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
        type: "On Stage",
        studentCategory: "Common/General",
        generalSubtype: "On Stage",
    });

    const scanDatabaseEventNames = async () => {
        setLoadingDetectedEvents(true);
        try {
            const eventCounts = {};
            // Scan registrations
            const regSnap = await getDocs(collection(db, "registrations"));
            const arrayFields = ["events", "onStageEvents", "offStageEvents", "generalEvents"];
            regSnap.docs.forEach(d => {
                const data = d.data();
                arrayFields.forEach(field => {
                    if (Array.isArray(data[field])) {
                        data[field].forEach(evName => {
                            if (evName && typeof evName === "string") {
                                const trimmed = evName.trim();
                                if (trimmed) {
                                    eventCounts[trimmed] = (eventCounts[trimmed] || 0) + 1;
                                }
                            }
                        });
                    }
                });
            });

            // Scan results
            const resSnap = await getDocs(collection(db, "results"));
            resSnap.docs.forEach(d => {
                const evName = d.data().eventName;
                if (evName && typeof evName === "string") {
                    const trimmed = evName.trim();
                    if (trimmed) {
                        eventCounts[trimmed] = (eventCounts[trimmed] || 0) + 1;
                    }
                }
            });

            const list = Object.keys(eventCounts).map(name => ({
                name,
                count: eventCounts[name]
            })).sort((a, b) => b.count - a.count);

            setDetectedDbEvents(list);
        } catch (err) {
            console.error("Error scanning DB event names:", err);
        } finally {
            setLoadingDetectedEvents(false);
        }
    };

    const syncEventRecords = async (oldName, newName, targetEventId) => {
        let totalSynced = 0;

        // 1. Sync registrations
        const regSnap = await getDocs(collection(db, "registrations"));
        const regBatch = writeBatch(db);
        let regCount = 0;
        const arrayFields = ["events", "onStageEvents", "offStageEvents", "generalEvents"];

        regSnap.docs.forEach(d => {
            const data = d.data();
            let needsUpdate = false;
            const updates = {};
            arrayFields.forEach(field => {
                if (Array.isArray(data[field]) && data[field].includes(oldName)) {
                    const updatedArray = data[field].map(e => e === oldName ? newName : e);
                    updates[field] = Array.from(new Set(updatedArray));
                    needsUpdate = true;
                }
            });
            if (needsUpdate) {
                regBatch.update(d.ref, updates);
                regCount++;
            }
        });

        if (regCount > 0) {
            await regBatch.commit();
            totalSynced += regCount;
        }

        // 2. Sync results
        const resSnap = await getDocs(collection(db, "results"));
        const resBatch = writeBatch(db);
        let resCount = 0;

        resSnap.docs.forEach(d => {
            const data = d.data();
            let needsUpdate = false;
            const updates = {};
            if (data.eventId === targetEventId || (data.eventName && data.eventName.trim().toUpperCase() === oldName.trim().toUpperCase())) {
                updates.eventId = targetEventId;
                updates.eventName = newName;
                needsUpdate = true;
            }
            if (needsUpdate) {
                resBatch.update(d.ref, updates);
                resCount++;
            }
        });

        if (resCount > 0) {
            await resBatch.commit();
            totalSynced += resCount;
        }

        return totalSynced;
    };

    const handleSyncOldEventData = async (e) => {
        e.preventDefault();
        const fromName = syncOldEventName.trim();
        
        // Find target event name and ID
        const targetEventObj = events.find(ev => ev.id === syncNewEventId);
        const toName = targetEventObj?.name;

        if (!fromName || !syncNewEventId || !toName) {
            showToast("Please specify both old and target event names.", "error");
            return;
        }

        if (fromName.toLowerCase() === toName.toLowerCase()) {
            showToast("Old and target event names are identical.", "error");
            return;
        }

        if (!await confirm(`Are you sure you want to replace all records for event "${fromName}" with "${toName}" across Registrations and Results?`)) return;

        setIsSyncing(true);
        try {
            const totalSynced = await syncEventRecords(fromName, toName, syncNewEventId);
            
            // Delete the old event document if it exists in the active event list
            const oldEventObj = events.find(ev => ev.name.toLowerCase() === fromName.toLowerCase());
            if (oldEventObj) {
                if (await confirm(`The old event "${fromName}" exists in the active events database. Do you want to delete it now?`)) {
                    await deleteDoc(doc(db, "events", oldEventObj.id));
                }
            }

            showToast(`Successfully updated ${totalSynced} records from "${fromName}" to "${toName}"!`, "success");
            setSyncOldEventName("");
            setSyncNewEventId("");
            fetchEvents();
            scanDatabaseEventNames();
        } catch (err) {
            console.error("Error syncing event names:", err);
            showToast("Failed to sync event records: " + err.message, "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchEvents = async () => {
        if (!loading) setLoading(true);
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Connection timed out. Check your internet or Firebase config.")), 5000)
            );

            const q = query(collection(db, "events"), orderBy("name"));
            const snapshot = await Promise.race([getDocs(q), timeoutPromise]);

            const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setEvents(list);
        } catch (err) {
            console.error("Error fetching events:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        const run = async () => {
            await fetchEvents();
            await scanDatabaseEventNames();
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
                const oldEvent = events.find(e => e.id === editId);
                const oldName = oldEvent?.name;

                await updateDoc(doc(db, "events", editId), { ...formData, name: eventName });

                if (oldName && oldName.trim().toUpperCase() !== eventName.trim().toUpperCase()) {
                    showToast("Event updated, syncing references...", "info");
                    const totalSynced = await syncEventRecords(oldName, eventName, editId);
                    showToast(`Event updated & synced across ${totalSynced} registrations/results!`, "success");
                    scanDatabaseEventNames();
                } else {
                    showToast("Event updated successfully!", "success");
                }
            } else {
                await addDoc(collection(db, "events"), { ...formData, name: eventName });
                showToast("Event added successfully!", "success");
            }
            setFormData({ name: "", category: "", date: "", time: "", stage: "", type: "On Stage", studentCategory: "Common/General", generalSubtype: "On Stage" });
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
            studentCategory: event.studentCategory === "General" ? "Common/General" : (event.studentCategory || "Common/General"),
            generalSubtype: event.generalSubtype || "On Stage",
        });
        setEditId(event.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCancelEdit = () => {
        setFormData({ name: "", category: "", date: "", time: "", stage: "", type: "On Stage", studentCategory: "Common/General", generalSubtype: "On Stage" });
        setEditId(null);
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

    const handleCheckSync = async () => {
        setLoading(true);
        try {
            // 1. Fetch current DB events
            const q = query(collection(db, "events"));
            const snapshot = await getDocs(q);
            const dbNames = new Set(snapshot.docs.map(d => d.data().name.trim().toUpperCase()));
            const codeNames = new Set(ALL_EVENTS.map(n => n.trim().toUpperCase()));

            // 2. Compare
            const missingInDb = ALL_EVENTS.filter(name => !dbNames.has(name.trim().toUpperCase()));
            const extrasInDb = snapshot.docs
                .map(d => d.data().name)
                .filter(name => !codeNames.has(name.trim().toUpperCase()));

            // 3. Report
            let message = "✅ Sync Status Report\n\n";

            if (missingInDb.length === 0 && extrasInDb.length === 0) {
                message += "Everything is perfectly synced! 🎉\n(Code and Database match exactly)";
            } else {
                if (missingInDb.length > 0) {
                    message += `❌ MISSING in Database (${missingInDb.length}):\n${missingInDb.join(", ")}\n\n`;
                    message += "👉 Click 'Seed DB' to add these.\n\n";
                }
                if (extrasInDb.length > 0) {
                    message += `⚠️ EXTRA in Database (${extrasInDb.length}):\n${extrasInDb.join(", ")}\n\n`;
                    message += "👉 You can manually delete these if they are old/deprecated.";
                }
            }

            alert(message);

        } catch (err) {
            console.error("Check failed:", err);
            showToast("Failed to check sync status.", "error");
        }
        setLoading(false);
    };

    // CLEAR ALL EVENTS
    const handleClearAllEvents = async () => {
        if (!await confirm("🧨 WARNING: This will permanently DELETE ALL EVENTS from the database. Are you absolutely sure?")) return;
        if (!await confirm("🧨 DOUBLE CHECK: Type 'YES' to confirm you want to delete EVERYTHING.")) return; // Extra safety if we had a prompt, but confirm is true/false. Let's just do one confirm for now.
        
        setLoading(true);
        try {
            const snapshot = await getDocs(query(collection(db, "events")));
            const batch = writeBatch(db);
            
            snapshot.docs.forEach((document) => {
                batch.delete(doc(db, "events", document.id));
            });
            
            await batch.commit();
            alert(`✅ Successfully deleted ${snapshot.size} events!`);
            fetchEvents();
        } catch (err) {
            console.error("Failed to clear events:", err);
            showToast("Failed to clear events.", "error");
        }
        setLoading(false);
    };

    const handleSeedDatabase = async () => {
        if (!await confirm(`This will verify all ${ALL_EVENTS.length} events from the master list are in the database. Continue?`)) return;
        setLoading(true);
        let addedCount = 0;
        let addedNames = [];

        try {
            // 1. Get existing events
            const q = query(collection(db, "events"));
            const snapshot = await getDocs(q);
            const existingNames = new Set(snapshot.docs.map(d => d.data().name.trim().toUpperCase()));

            // 2. Check and Add missing
            for (const eventName of ALL_EVENTS) {
                if (!existingNames.has(eventName.trim().toUpperCase())) {
                    const eventType = getEventType(eventName);
                    await addDoc(collection(db, "events"), {
                        name: eventName,
                        category: "",
                        date: "",
                        time: "",
                        stage: "",
                        type: eventType,
                        studentCategory: getEventScope(eventName),
                        ...(eventType === "General" ? { generalSubtype: getGeneralSubtype(eventName) } : {})
                    });
                    addedCount++;
                    addedNames.push(eventName);
                }
            }

            if (addedCount > 0) {
                alert(`✅ Seed Complete!\n\nAdded ${addedCount} new events:\n- ${addedNames.join("\n- ")}`);
            } else {
                alert("✅ Database is already up to date. No missing events found.");
            }

            fetchEvents();
        } catch (err) {
            console.error("Seeding failed:", err);
            showToast("Failed to seed database.", "error");
        }
        setLoading(false);
    };

    // TEMP FIX: ONE-TIME RUN TO CLASSIFY EVENTS
    const fixEventTypes = async () => {
        if (!await confirm("This will RECLASSIFY all events' Stage Type and Category Scope based on the hardcoded list. Continue?")) return;
        setLoading(true);

        let updatedCount = 0;
        let updatedDetails = [];

        try {
            for (const ev of events) {
                const upperName = ev.name.trim().toUpperCase();
                const newType = getEventType(upperName);
                const newScope = getEventScope(upperName);
                const newGenSubtype = getGeneralSubtype(upperName);

                const updates = {};
                if (ev.type !== newType) updates.type = newType;
                if (ev.studentCategory !== newScope) updates.studentCategory = newScope;
                if (newType === "General" && ev.generalSubtype !== newGenSubtype) {
                    updates.generalSubtype = newGenSubtype;
                }

                if (Object.keys(updates).length > 0) {
                    await updateDoc(doc(db, "events", ev.id), updates);
                    updatedCount++;
                    updatedDetails.push(`${ev.name}: ${JSON.stringify(updates)}`);
                }
            }

            if (updatedCount > 0) {
                alert(`✅ Classification Complete!\n\nUpdated ${updatedCount} events:\n${updatedDetails.join("\n")}`);
            } else {
                alert("✅ All event types are already correct.");
            }

            fetchEvents();
        } catch (err) {
            console.error("Fix failed:", err);
            showToast("Failed to update events.", "error");
        }
        setLoading(false);
    };


    // CLEANUP DUPLICATES & TYPOS
    const handleCleanupDuplicates = async () => {
        if (!await confirm("This will remove duplicate event entries and typo names (e.g. SPEECH MALAYALM) from the database. Continue?")) return;
        setLoading(true);
        let removedCount = 0;
        const removedDetails = [];
        const seenNames = new Set();
        const batch = writeBatch(db);

        try {
            const snapshot = await getDocs(query(collection(db, "events")));
            snapshot.docs.forEach((d) => {
                const data = d.data();
                const rawName = data.name || "Unnamed";
                const normName = rawName.trim().toUpperCase();
                
                const isTypo = normName === "SPEECH MALAYALM" || normName === "PRESS CONFRENCE";
                const isDuplicate = seenNames.has(normName);
                if (isDuplicate || isTypo) {
                    batch.delete(doc(db, "events", d.id));
                    removedCount++;
                    removedDetails.push(`${rawName} [${isTypo ? 'Typo' : 'Duplicate ID: ' + d.id}]`);
                } else if (normName) {
                    seenNames.add(normName);
                }
            });

            if (removedCount > 0) {
                await batch.commit();
                alert(`✅ Cleaned up ${removedCount} event(s) from database:\n\n- ${removedDetails.join("\n- ")}`);
                fetchEvents();
            } else {
                alert("✅ No duplicate or typo events found in database.");
            }
        } catch (err) {
            console.error("Cleanup failed:", err);
            showToast("Failed to clean up duplicates.", "error");
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
            <h3 className="section-title">Manage Event</h3>

            <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                {/* ADD FORM */}
                <form onSubmit={handleSubmit} className="admin-form" style={{ height: 'fit-content' }}>
                    <h4>{editId ? "Edit Event" : "Add New Event"}</h4>
                    <div className="form-grid">
                        <input className="admin-input full-width" name="name" placeholder="Event Name" value={formData.name} onChange={handleChange} required />
                        <select className="admin-select" name="category" value={formData.category} onChange={handleChange}>
                            <option value="">-- Category --</option>
                            <option value="A">Category A</option>
                            <option value="B">Category B</option>
                            <option value="C">Category C</option>
                        </select>
                        <input className="admin-input" name="date" placeholder="Date (e.g. Day 1)" value={formData.date} onChange={handleChange} />
                        <input className="admin-input" name="time" placeholder="Time (e.g. 10:00 AM)" value={formData.time} onChange={handleChange} />
                        <input className="admin-input" name="stage" placeholder="Stage" value={formData.stage} onChange={handleChange} />
                        <select className="admin-select" name="type" value={formData.type} onChange={handleChange}>
                            <option value="On Stage">On Stage 🎭</option>
                            <option value="Off Stage">Off Stage 📝</option>
                            <option value="General">General 🌐</option>
                        </select>
                        {formData.type === "General" && (
                            <select className="admin-select" name="generalSubtype" value={formData.generalSubtype || "On Stage"} onChange={handleChange}>
                                <option value="On Stage">General - On Stage 🎭</option>
                                <option value="Off Stage">General - Off Stage 📝</option>
                            </select>
                        )}
                        <select className="admin-select" name="studentCategory" value={formData.studentCategory === "General" ? "Common/General" : formData.studentCategory} onChange={handleChange}>
                            <option value="Common/General">Common / General — No Jr/Sr split, separate points pool</option>
                            {dynamicCategories.map(cat => (
                                <option key={cat} value={cat}>{cat} Only</option>
                            ))}
                            <option value="Junior & Senior">Junior &amp; Senior — Both compete, tracked per category</option>
                        </select>
                    </div>
                    <div className="admin-form-actions" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                        <button type="submit" className="submit-btn" style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}>
                            {editId ? "Update Event ✓" : "Add Event +"}
                        </button>

                        {editId && (
                            <button type="button" onClick={handleCancelEdit} className="submit-btn" style={{ background: 'var(--bg-tertiary)', width: '100%' }}>
                                Cancel
                            </button>
                        )}

                        {!editId && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', width: '100%' }}>
                                <button type="button" onClick={handleSeedDatabase} className="submit-btn" style={{ background: '#22c55e', fontSize: '0.85rem' }}>
                                    🌱 Seed DB
                                </button>
                                <button type="button" onClick={handleCheckSync} className="submit-btn" style={{ background: 'var(--primary)', fontSize: '0.85rem' }}>
                                    🔎 Check Sync
                                </button>
                                <button type="button" onClick={fixEventTypes} className="submit-btn" style={{ background: 'var(--secondary)', fontSize: '0.85rem' }}>
                                    🔧 Fix Types
                                </button>
                                <button type="button" onClick={handleCleanupDuplicates} className="submit-btn" style={{ background: '#eab308', color: '#000', fontSize: '0.85rem' }}>
                                    🧹 Deduplicate
                                </button>
                                <button type="button" onClick={handleClearAllEvents} className="submit-btn" style={{ background: '#ef4444', fontSize: '0.85rem' }}>
                                    🧨 Clear All
                                </button>
                            </div>
                        )}
                    </div>
                </form>

                {/* REPLACE / MERGE EVENT CARD */}
                {!editId && (
                    <div className="admin-form" style={{ border: '1px solid rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.05)', height: 'fit-content' }}>
                        <h4 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                            <span>🔄</span> Replace & Sync Event
                        </h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                            If you changed an event's name or corrected a typo, use this to swap references across all registrations and published results in one click.
                        </p>
                        <form onSubmit={handleSyncOldEventData} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 'bold' }}>Old Event Name (Detected in Database)</label>
                                {detectedDbEvents.length > 0 ? (
                                    <select
                                        className="admin-select"
                                        value={syncOldEventName}
                                        onChange={e => setSyncOldEventName(e.target.value)}
                                        style={{ width: '100%' }}
                                        required
                                    >
                                        <option value="">-- Select Old Event Name --</option>
                                        {detectedDbEvents.map(item => (
                                            <option key={item.name} value={item.name}>
                                                {item.name} ({item.count} references)
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="admin-input"
                                        value={syncOldEventName}
                                        onChange={e => setSyncOldEventName(e.target.value)}
                                        placeholder="e.g. SPEECH MALAYALM"
                                        style={{ width: '100%' }}
                                        required
                                    />
                                )}
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 'bold' }}>Target New Event</label>
                                <select
                                    className="admin-select"
                                    value={syncNewEventId}
                                    onChange={e => setSyncNewEventId(e.target.value)}
                                    style={{ width: '100%' }}
                                    required
                                >
                                    <option value="">-- Select Target Event --</option>
                                    {events.map(ev => (
                                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="submit-btn" disabled={isSyncing} style={{ background: '#eab308', color: '#000', fontWeight: 'bold', width: '100%', padding: '12px', marginTop: '10px' }}>
                                {isSyncing ? "Syncing..." : "Sync All Event Records Now"}
                            </button>
                        </form>
                    </div>
                )}
            </div>



            {/* LIST */}
            {loading ? <p>Loading events...</p> : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>Name{getSortIndicator('name')}</th>
                                <th onClick={() => requestSort('category')} style={{ cursor: 'pointer' }}>Category{getSortIndicator('category')}</th>
                                <th onClick={() => requestSort('type')} style={{ cursor: 'pointer' }}>Type{getSortIndicator('type')}</th>
                                <th>Category Scope</th>
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
                                            background: ev.type === 'Off Stage' ? 'var(--bg-tertiary)' : 'rgba(230, 57, 70, 0.1)',
                                            color: ev.type === 'Off Stage' ? 'var(--text-secondary)' : 'var(--secondary)',
                                            border: `1px solid ${ev.type === 'Off Stage' ? 'var(--border-soft)' : 'var(--secondary)'}`
                                        }}>
                                            {ev.type || 'On Stage'}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: '600', color: 'var(--primary-light)' }}>{ev.studentCategory === "General" ? "Common/General" : (ev.studentCategory || "Common/General")}</td>
                                    <td>{ev.time}</td>
                                    <td>{ev.date}</td>
                                    <td>{ev.stage}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleEdit(ev)} className="tab-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: 'auto', background: 'var(--bg-tertiary)' }}>Edit</button>
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

