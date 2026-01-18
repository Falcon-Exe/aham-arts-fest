import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, orderBy, query, where, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Papa from "papaparse";

export default function ManageResults() {
    const [events, setEvents] = useState([]);
    const [results, setResults] = useState([]);
    const [masterParticipants, setMasterParticipants] = useState([]);
    const [filteredParticipants, setFilteredParticipants] = useState([]);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        eventId: "",
        eventName: "",
        place: "First",
        name: "",
        team: "",
        grade: "", // Optional
        chestNo: ""
    });

    // URL for master participants CSV
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

    // Fetch Events and Master Participants
    useEffect(() => {
        const fetchEvents = async () => {
            const q = query(collection(db, "events"), orderBy("name"));
            const snap = await getDocs(q);
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };

        const fetchMasterList = () => {
            fetch(csvUrl + "&t=" + Date.now())
                .then(res => res.text())
                .then(csv => {
                    Papa.parse(csv, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            setMasterParticipants(results.data);
                        },
                    });
                })
                .catch(err => console.error("Master list failed:", err));
        };

        fetchEvents();
        fetchResults();
        fetchMasterList();
    }, []);

    const fetchResults = async () => {
        const q = query(collection(db, "results"), orderBy("eventName"));
        const snap = await getDocs(q);
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    const handleEventChange = (e) => {
        const eventId = e.target.value;
        const ev = events.find(event => event.id === eventId);
        const eventName = ev?.name || "";

        setFormData({ ...formData, eventId, eventName, name: "", team: "", chestNo: "" });

        if (eventName) {
            const registered = masterParticipants.filter(p => {
                const onStage = p["ON STAGE ITEMS"] || p["ON STAGE EVENTS"] || "";
                const offStage = p["OFF STAGE ITEMES"] || p["OFF STAGE ITEMS"] || p["OFF STAGE EVENTS"] || "";
                const allEvents = (onStage + "," + offStage).toLowerCase();
                return allEvents.includes(eventName.toLowerCase());
            });
            setFilteredParticipants(registered);
        } else {
            setFilteredParticipants([]);
        }
    };

    const handleStudentChange = (e) => {
        const studentName = e.target.value;
        const student = filteredParticipants.find(p => (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"]) === studentName);

        if (student) {
            setFormData({
                ...formData,
                name: studentName,
                team: student["TEAM"] || student["TEAM NAME"] || "",
                chestNo: student["CHEST NUMBER"] || student["CHEST NO"] || ""
            });
        } else {
            setFormData({ ...formData, name: studentName });
        }
    };

    const checkRegistration = (studentName, eventName) => {
        if (masterParticipants.length === 0) return { status: 'loading', msg: '' };

        const student = masterParticipants.find(p =>
            (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"])?.trim().toLowerCase() === studentName.trim().toLowerCase()
        );

        if (!student) {
            return { status: 'error', msg: `Student "${studentName}" not found in master list!` };
        }

        // Check if event name exists in On Stage or Off Stage columns
        const onStage = student["ON STAGE ITEMS"] || student["ON STAGE EVENTS"] || "";
        const offStage = student["OFF STAGE ITEMES"] || student["OFF STAGE ITEMS"] || student["OFF STAGE EVENTS"] || "";
        const allEvents = (onStage + "," + offStage).toLowerCase();

        if (!allEvents.includes(eventName.toLowerCase())) {
            return { status: 'warning', msg: `Student is found, but NOT registered for "${eventName}".` };
        }

        return { status: 'success', msg: 'Verified Registration ✓' };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.eventId || !formData.name) {
            alert("Please select an event and enter name");
            return;
        }

        // Registration Validation
        const eventObj = events.find(e => e.id === formData.eventId);
        const regCheck = checkRegistration(formData.name, eventObj?.name || "");

        if (regCheck.status === 'error') {
            if (!window.confirm(`${regCheck.msg}\n\nDo you want to proceed anyway?`)) return;
        } else if (regCheck.status === 'warning') {
            if (!window.confirm(`${regCheck.msg}\n\nProceed anyway?`)) return;
        }

        // Validation: Prevent duplicate place for same event (excluding current edit)
        const isDuplicatePlace = results.some(r =>
            r.id !== editId && r.eventId === formData.eventId && r.place === formData.place
        );
        if (isDuplicatePlace) {
            const confirm = window.confirm(`A ${formData.place} Place winner already exists for this event. Do you want to add another one (Tie)?`);
            if (!confirm) return;
        }

        try {
            // Find event name from ID
            const ev = events.find(e => e.id === formData.eventId);
            const payload = { ...formData, eventName: ev?.name || "Unknown" };

            if (editId) {
                await updateDoc(doc(db, "results", editId), payload);
                alert("Result updated!");
            } else {
                await addDoc(collection(db, "results"), payload);
                alert("Result published!");
            }
            setFormData({ ...formData, name: "", team: "", grade: "", chestNo: "" });
            setEditId(null);
            fetchResults();
        } catch (err) {
            console.error(err);
            alert("Error saving result");
        }
    };

    const handleEdit = (result) => {
        const ev = events.find(event => event.id === result.eventId);
        const eventName = ev?.name || "";

        // Populate registered students for this event first
        if (eventName) {
            const registered = masterParticipants.filter(p => {
                const onStage = p["ON STAGE EVENTS"] || "";
                const offStage = p["OFF STAGE EVENTS"] || "";
                const allEvents = (onStage + "," + offStage).toLowerCase();
                return allEvents.includes(eventName.toLowerCase());
            });
            setFilteredParticipants(registered);
        }

        setFormData({
            eventId: result.eventId || "",
            eventName: result.eventName || "",
            place: result.place || "First",
            name: result.name || "",
            team: result.team || "",
            grade: result.grade || "",
            chestNo: result.chestNo || ""
        });
        setEditId(result.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCancelEdit = () => {
        setFormData({
            eventId: "",
            eventName: "",
            place: "First",
            name: "",
            team: "",
            grade: "",
            chestNo: ""
        });
        setEditId(null);
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            let csvData = event.target.result;
            if (csvData.charCodeAt(0) === 0xFEFF) csvData = csvData.slice(1);

            const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) {
                alert("CSV file seems empty or only contains headers.");
                return;
            }

            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
            let addedCount = 0;
            let skipCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(",").map(v => v.trim());
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || "";
                });

                // Header mapping: event, name, team, prize/place, grade, chestno
                const eventName = row.event || row.eventname;
                const studentName = row.name || row.studentname;
                const teamName = row.team;
                const prize = row.prize || row.place;
                const grade = row.grade;
                const chestNo = row.chestno || row.chestnumber;

                if (eventName && studentName) {
                    // Match event name to event ID
                    const matchedEvent = events.find(e => e.name.toLowerCase() === eventName.toLowerCase());

                    if (matchedEvent) {
                        try {
                            // Validation within bulk upload
                            const regCheck = checkRegistration(studentName, matchedEvent.name);
                            if (regCheck.status !== 'success') {
                                console.warn(`Bulk warning for ${studentName}: ${regCheck.msg}`);
                            }

                            await addDoc(collection(db, "results"), {
                                eventId: matchedEvent.id,
                                eventName: matchedEvent.name,
                                name: studentName,
                                team: teamName,
                                place: prize,
                                grade: grade,
                                chestNo: chestNo
                            });
                            addedCount++;
                        } catch (err) {
                            console.error("Result row failed:", i, err);
                            skipCount++;
                        }
                    } else {
                        console.warn("No event found matching:", eventName);
                        skipCount++;
                    }
                } else {
                    skipCount++;
                }
            }
            alert(`Results Upload Finished!\n✅ Added: ${addedCount}\n⚠️ Skipped: ${skipCount} (Event names must match exactly)`);
            fetchResults();
        };
        reader.readAsText(file);
    };

    const downloadResultsCSV = () => {
        if (results.length === 0) return;

        // Custom columns requested: Team, Event, Published, Prize, Chest No, Grade, Name
        const headers = ["Team", "Event", "Published", "Prize", "Chest No", "Grade", "Name"];
        const rows = results.map(r => [
            `"${r.team}"`,
            `"${r.eventName}"`,
            `"Yes"`, // Published status
            `"${r.place}"`, // Prize
            `"${r.chestNo || ''}"`,
            `"${r.grade || ''}"`,
            `"${r.name}"`
        ]);

        const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "aham_arts_fest_results.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this result?")) return;
        await deleteDoc(doc(db, "results", id));
        fetchResults();
    }

    return (
        <div className="manage-results">
            <h3 className="section-title">{editId ? "Edit Result" : "Publish Results"}</h3>

            <form onSubmit={handleSubmit} className="admin-form">
                <div className="form-grid">
                    <select
                        className="admin-select"
                        value={formData.eventId}
                        onChange={handleEventChange}
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

                    <select
                        className="admin-select full-width"
                        value={formData.name}
                        onChange={handleStudentChange}
                        required
                        disabled={!formData.eventId}
                    >
                        <option value="">-- Select Registered Student --</option>
                        {filteredParticipants.map((p, idx) => (
                            <option key={idx} value={p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"]}>
                                {(p["CHEST NUMBER"] || p["CHEST NO"]) ? `[${p["CHEST NUMBER"] || p["CHEST NO"]}] ` : ""}{p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"]}
                            </option>
                        ))}
                        <option value="Manual Entry">Enter Manually...</option>
                    </select>

                    {formData.name === "Manual Entry" && (
                        <input
                            className="admin-input full-width"
                            placeholder="Manually Enter Name"
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    )}

                    <input className="admin-input" placeholder="Team" value={formData.team} onChange={e => setFormData({ ...formData, team: e.target.value })} required />
                    <input className="admin-input" placeholder="Grade (e.g. A, B)" value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} />
                    <input className="admin-input" placeholder="Chest No" value={formData.chestNo} onChange={e => setFormData({ ...formData, chestNo: e.target.value })} />
                </div>
                <div className="admin-form-actions" style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                    <button type="submit" className="submit-btn" style={{ flex: 2 }}>
                        {editId ? "Update Result ✓" : "Publish Winner"}
                    </button>
                    {editId && (
                        <button type="button" onClick={handleCancelEdit} className="submit-btn" style={{ flex: 1, background: '#555' }}>
                            Cancel
                        </button>
                    )}
                    {!editId && (
                        <label className="submit-btn" style={{ flex: 1, background: '#333', cursor: 'pointer', textAlign: 'center', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            📥 Bulk Upload (CSV)
                            <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
                        </label>
                    )}
                </div>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)' }}>Published Results History</h4>
                <button
                    onClick={downloadResultsCSV}
                    className="submit-btn"
                    style={{ padding: '8px 15px', fontSize: '0.85rem', background: '#222' }}
                >
                    📊 Export Results (CSV)
                </button>
            </div>
            <div className="admin-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Prize</th>
                            <th>Name</th>
                            <th>Team</th>
                            <th>Grade</th>
                            <th>Chest No</th>
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
                                <td>{r.grade}</td>
                                <td>{r.chestNo}</td>
                                <td>
                                    {(() => {
                                        const check = checkRegistration(r.name, r.eventName);
                                        return (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                color: check.status === 'success' ? '#4ade80' : check.status === 'warning' ? '#facc15' : '#f87171',
                                                display: 'block',
                                                marginBottom: '4px'
                                            }}>
                                                {check.status === 'success' ? '✓ Registered' : check.status === 'warning' ? '⚠ Not in Event' : '✖ Not Found'}
                                            </span>
                                        );
                                    })()}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleEdit(r)} className="tab-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: 'auto', background: '#222' }}>Edit</button>
                                        <button onClick={() => handleDelete(r.id)} className="delete-btn">Remove</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
