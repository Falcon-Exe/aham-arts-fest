import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";
import Papa from "papaparse";
import { CSV_URL } from "../config";

export default function ManageRegistrations() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'CHEST NUMBER', direction: 'asc' });

    // URL for master participants CSV
    const csvUrl = CSV_URL;

    // Sorting Logic
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedRegistrations = () => {
        let data = [...registrations];

        // Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(reg =>
                (reg["CANDIDATE NAME"] || reg["CANDIDATE  FULL NAME"] || "").toLowerCase().includes(lowerTerm) ||
                (reg["CHEST NUMBER"] || reg["CHEST NO"] || "").toString().includes(lowerTerm) ||
                (reg["CIC NUMBER"] || reg["CIC NO"] || "").toString().includes(lowerTerm)
            );
        }

        // Sort
        if (sortConfig.key) {
            data.sort((a, b) => {
                let aVal = a[sortConfig.key] || "";
                let bVal = b[sortConfig.key] || "";

                // Normalizing keys
                if (sortConfig.key === 'NAME') {
                    aVal = a["CANDIDATE NAME"] || a["CANDIDATE  FULL NAME"] || "";
                    bVal = b["CANDIDATE NAME"] || b["CANDIDATE  FULL NAME"] || "";
                }
                if (sortConfig.key === 'CHEST NUMBER') {
                    aVal = a["CHEST NUMBER"] || a["CHEST NO"] || 999999;
                    bVal = b["CHEST NUMBER"] || b["CHEST NO"] || 999999;
                    return sortConfig.direction === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    };

    // Fetch Registrations (Merged)
    const fetchRegistrations = useCallback(async () => {
        setLoading(true);

        // Helper to fix CSV typos and format
        const normalizeEventString = (str) => {
            if (!str) return "";
            let s = str.toUpperCase();
            // Standardize separator
            s = s.split(',').map(item => item.trim()).filter(Boolean).join(', ');

            s = s.replace(/SHORT VLOGING/g, "SHORT VLOGGING");
            s = s.replace(/SAMMARIZATION/g, "SUMMARIZATION");
            s = s.replace(/MINISTORY/g, "MINI STORY");
            s = s.replace(/PHOTOFEACHURE/g, "PHOTO FEATURE");
            s = s.replace(/Q&H/g, "Q AND H");
            s = s.replace(/SONG WRITER/g, "SONG WRITING");
            return s;
        };

        try {
            // 1. Fetch CSV
            const csvPromise = fetch(csvUrl + "&t=" + Date.now())
                .then(res => res.text())
                .then(csv => {
                    return new Promise((resolve) => {
                        Papa.parse(csv, {
                            header: true,
                            skipEmptyLines: true,
                            complete: (results) => resolve(results.data)
                        });
                    });
                });

            // 2. Fetch Firestore
            const firestorePromise = getDocs(query(collection(db, "registrations"), orderBy("submittedAt", "desc")))
                .then((snapshot) => {
                    return snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            _id: doc.id,
                            "CANDIDATE NAME": data.fullName,
                            "CIC NO": data.cicNumber,
                            "CHEST NUMBER": data.chestNumber,
                            "TEAM": data.team,
                            "ON STAGE EVENTS": data.onStageEvents?.join(", ") || "",
                            "OFF STAGE EVENTS": data.offStageEvents?.join(", ") || "",
                            "GENERAL EVENTS": data.generalEvents?.join(", ") || "",
                            _submittedAt: data.submittedAt, // Keep for sorting if needed
                            _source: "firestore"
                        };
                    });
                });

            const [csvData, firestoreData] = await Promise.all([csvPromise, firestorePromise]);

            // Helper to get value loosely
            const getValue = (row, ...keys) => {
                const rowKeys = Object.keys(row);
                for (const k of keys) {
                    // 1. Exact match
                    if (row[k]) return row[k];

                    // 2. Case-insensitive exact match
                    const lowerK = k.toLowerCase();
                    const match = rowKeys.find(rk => rk.toLowerCase() === lowerK);
                    if (match && row[match]) return row[match];

                    // 3. Normalized match (ignore extra spaces)
                    const normK = lowerK.replace(/\s+/g, '');
                    const normMatch = rowKeys.find(rk => rk.toLowerCase().replace(/\s+/g, '') === normK);
                    if (normMatch && row[normMatch]) return row[normMatch];
                }
                return "";
            };

            // Add IDs and normalize CSV data
            const normalizedCsv = csvData.map((row, idx) => {
                // Debug first row
                if (idx === 0) console.log("Detected CSV Headers:", Object.keys(row));

                const onStage = normalizeEventString(getValue(row, "ON STAGE EVENTS", "ON STAGE ITEMS", "ON STAGE"));
                const offStage = normalizeEventString(getValue(row, "OFF STAGE EVENTS", "OFF STAGE ITEMS", "OFF STAGE ITEMES", "OFF STAGE"));
                const generalRaw = getValue(row, "GENERAL EVENTS", "GENERAL ITEMS", "OFF STAGE - GENERAL", "ON STAGE - GENERAL");
                const general = normalizeEventString(generalRaw);

                return {
                    ...row,
                    _id: `csv_${idx}`,
                    id: `csv_${idx}`,
                    "CANDIDATE NAME": getValue(row, "CANDIDATE NAME", "CANDIDATE  FULL NAME"),
                    "CIC NO": getValue(row, "CIC NO", "CIC NUMBER"),
                    "TEAM": getValue(row, "TEAM", "TEAM NAME"),
                    "CHEST NUMBER": getValue(row, "CHEST NUMBER", "CHEST NO"),
                    "ON STAGE EVENTS": onStage,
                    "OFF STAGE EVENTS": offStage,
                    "GENERAL EVENTS": general,
                    _source: "csv"
                };
            });

            // MERGE LOGIC
            const mergedMap = new Map();
            const rawList = [...firestoreData, ...normalizedCsv];

            rawList.forEach(item => {
                const chestNo = (item["CHEST NUMBER"] || item["CHEST NO"] || "").toString().trim();

                // If no chest no, just add as unique item
                if (!chestNo) {
                    mergedMap.set(item._id, item);
                    return;
                }

                if (mergedMap.has(chestNo)) {
                    // Merge with existing
                    const existing = mergedMap.get(chestNo);

                    // Combine events (deduplicate)
                    const mergeEvents = (str1, str2) => {
                        const s1 = str1 ? str1.split(",").map(s => s.trim()).filter(Boolean) : [];
                        const s2 = str2 ? str2.split(",").map(s => s.trim()).filter(Boolean) : [];
                        return [...new Set([...s1, ...s2])].join(", ");
                    };

                    existing["ON STAGE EVENTS"] = mergeEvents(existing["ON STAGE EVENTS"], item["ON STAGE EVENTS"]);
                    existing["OFF STAGE EVENTS"] = mergeEvents(existing["OFF STAGE EVENTS"], item["OFF STAGE EVENTS"]);
                    existing["GENERAL EVENTS"] = mergeEvents(existing["GENERAL EVENTS"], item["GENERAL EVENTS"]);

                    // If one source is firestore, mark as linked/merged
                    if (item._source === "firestore") {
                        if (existing._source === "csv") {
                            existing._source = "APP+CSV";
                        } else {
                            existing._source = "firestore";
                        }
                    }

                } else {
                    // New entry keyed by Chest No
                    mergedMap.set(chestNo, item);
                }
            });

            setRegistrations(Array.from(mergedMap.values()));

        } catch (error) {
            console.error("Error fetching registrations:", error);
            showToast("Failed to load registrations.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRegistrations();
    }, [fetchRegistrations]);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleToastClose = () => {
        setToast(null);
    };

    const handleDelete = async (item) => {
        if (item._source !== "firestore") {
            showToast("Cannot delete CSV records. Please update the Google Sheet directly.", "warning");
            return;
        }

        if (!await confirm("Are you sure you want to delete this registration?")) return;

        try {
            await deleteDoc(doc(db, "registrations", item._id));
            showToast("Registration deleted.", "success");
            fetchRegistrations(); // Reload
        } catch (err) {
            console.error(err);
            showToast("Error deleting registration", "error");
        }
    };

    // EDIT LOGIC
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingReg, setEditingReg] = useState(null);
    const [editForm, setEditForm] = useState({
        fullName: "",
        chestNumber: "",
        cicNumber: "",
        team: "",
        onStageEvents: "",
        offStageEvents: "",
        generalEvents: ""
    });

    const openEditModal = (reg) => {
        setEditingReg(reg);
        setEditForm({
            fullName: reg["CANDIDATE NAME"] || "",
            chestNumber: reg["CHEST NUMBER"] || "",
            cicNumber: reg["CIC NUMBER"] || "",
            team: reg["TEAM"] || "",
            onStageEvents: reg["ON STAGE EVENTS"] || "",
            offStageEvents: reg["OFF STAGE EVENTS"] || "",
            generalEvents: reg["GENERAL EVENTS"] || ""
        });
        setIsEditModalOpen(true);
    };

    const handleUpdate = async () => {
        if (!editingReg) return;

        try {
            // Convert comma strings back to arrays
            const onStageArr = editForm.onStageEvents.split(',').map(s => s.trim()).filter(Boolean);
            const offStageArr = editForm.offStageEvents.split(',').map(s => s.trim()).filter(Boolean);
            const generalArr = editForm.generalEvents.split(',').map(s => s.trim()).filter(Boolean);

            const payload = {
                fullName: editForm.fullName,
                chestNumber: editForm.chestNumber,
                cicNumber: editForm.cicNumber,
                team: editForm.team,
                onStageEvents: onStageArr,
                offStageEvents: offStageArr,
                generalEvents: generalArr
            };

            if (editingReg._source === 'csv') {
                // Create new shadow record in Firestore
                await addDoc(collection(db, "registrations"), {
                    ...payload,
                    submittedAt: new Date()
                });
                showToast("New record created from CSV data", "success");
            } else {
                // Update existing Firestore record
                const docRef = doc(db, "registrations", editingReg._id);
                await updateDoc(docRef, payload);
                showToast("Registration updated successfully", "success");
            }

            setIsEditModalOpen(false);
            setEditingReg(null);
            fetchRegistrations();
        } catch (error) {
            console.error("Error updating registration:", error);
            showToast("Failed to update registration", "error");
        }
    };

    const downloadCSV = () => {
        if (registrations.length === 0) {
            showToast("No registrations to download.", "warning");
            return;
        }

        const headers = [
            "Source",
            "Name",
            "CIC No",
            "Chest No",
            "Team",
            "On Stage Events",
            "Off Stage Events",
            "General Events"
        ];

        const rows = registrations.map(reg => [
            `"${reg._source}"`,
            `"${reg["CANDIDATE NAME"] || reg["CANDIDATE  FULL NAME"] || ""}"`,
            `"${reg["CIC NUMBER"] || reg["CIC NO"] || ""}"`,
            `"${reg["CHEST NUMBER"] || reg["CHEST NO"] || ""}"`,
            `"${reg["TEAM"] || reg["TEAM NAME"] || ""}"`,
            `"${reg["ON STAGE EVENTS"] || ""}"`,
            `"${reg["OFF STAGE EVENTS"] || ""}"`,
            `"${reg["GENERAL EVENTS"] || ""}"`
        ]);

        const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `aham_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sortedRegistrations = getSortedRegistrations();

    return (
        <div className="manage-results">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 className="section-title">Manage All Registrations</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Search Name, Chest No..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="admin-input"
                        style={{ width: '250px', margin: 0 }}
                    />
                    <button onClick={downloadCSV} className="tab-btn" style={{ background: '#2563eb', color: 'white', border: 'none' }}>
                        Download CSV 📥
                    </button>
                    <button onClick={fetchRegistrations} className="tab-btn" style={{ background: '#333' }}>Refresh</button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Loading...</div>
            ) : (
                <div className="admin-table-container" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('_source')} style={{ cursor: 'pointer' }}>Source ⬍</th>
                                <th onClick={() => handleSort('NAME')} style={{ cursor: 'pointer' }}>Name ⬍</th>
                                <th onClick={() => handleSort('CIC NUMBER')} style={{ cursor: 'pointer' }}>CIC No ⬍</th>
                                <th onClick={() => handleSort('TEAM')} style={{ cursor: 'pointer' }}>Team ⬍</th>
                                <th onClick={() => handleSort('CHEST NUMBER')} style={{ cursor: 'pointer' }}>Chest No ⬍</th>
                                <th>On Stage</th>
                                <th>Off Stage</th>
                                <th>General</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRegistrations.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>No registrations found.</td>
                                </tr>
                            ) : (
                                sortedRegistrations.map(reg => (
                                    <tr key={reg._id}>
                                        <td>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: reg._source.includes('APP') ? '#22c55e' : '#3b82f6',
                                                color: '#fff'
                                            }}>
                                                {reg._source === 'firestore' && 'APP'}
                                                {reg._source === 'csv' && 'CSV'}
                                                {reg._source === 'APP+CSV' && 'APP+CSV'}
                                            </span>
                                        </td>
                                        <td>{reg["CANDIDATE NAME"] || reg["CANDIDATE  FULL NAME"]}</td>
                                        <td>{reg["CIC NUMBER"] || reg["CIC NO"]}</td>
                                        <td>{reg["TEAM"] || reg["TEAM NAME"]}</td>
                                        <td>{reg["CHEST NUMBER"] || reg["CHEST NO"] || '-'}</td>
                                        <td>
                                            {reg["ON STAGE EVENTS"] ? (
                                                <div style={{ color: '#4ade80', fontSize: '0.85rem' }}>{reg["ON STAGE EVENTS"]}</div>
                                            ) : <span style={{ color: '#ccc' }}>-</span>}
                                        </td>
                                        <td>
                                            {reg["OFF STAGE EVENTS"] ? (
                                                <div style={{ color: '#60a5fa', fontSize: '0.85rem' }}>{reg["OFF STAGE EVENTS"]}</div>
                                            ) : <span style={{ color: '#ccc' }}>-</span>}
                                        </td>
                                        <td>
                                            {reg["GENERAL EVENTS"] ? (
                                                <div style={{ color: '#facc15', fontSize: '0.85rem' }}>{reg["GENERAL EVENTS"]}</div>
                                            ) : <span style={{ color: '#ccc' }}>-</span>}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => openEditModal(reg)}
                                                    className="tab-btn"
                                                    style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#3b82f6', border: 'none' }}
                                                >
                                                    Edit
                                                </button>
                                                {reg._source === 'firestore' && (
                                                    <button onClick={() => handleDelete(reg)} className="delete-btn">Delete</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* EDIT MODAL */}
            {isEditModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: '#1e1e1e', padding: '30px', borderRadius: '12px', width: '500px',
                        border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '15px'
                    }}>
                        <h3 style={{ color: '#fff', margin: 0 }}>Edit Registration</h3>

                        <div>
                            <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.9rem' }}>Full Name</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.fullName}
                                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.9rem' }}>Chest Number</label>
                                <input
                                    className="admin-input"
                                    style={{ width: '100%', margin: 0 }}
                                    value={editForm.chestNumber}
                                    onChange={(e) => setEditForm({ ...editForm, chestNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.9rem' }}>Team</label>
                                <select
                                    className="admin-input"
                                    style={{ width: '100%', margin: 0 }}
                                    value={editForm.team}
                                    onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                                >
                                    <option value="PYRA">PYRA</option>
                                    <option value="IGNIS">IGNIS</option>
                                    <option value="ATASH">ATASH</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.9rem' }}>CIC Number</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.cicNumber}
                                onChange={(e) => setEditForm({ ...editForm, cicNumber: e.target.value })}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.9rem' }}>On Stage Events (comma separated)</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.onStageEvents}
                                onChange={(e) => setEditForm({ ...editForm, onStageEvents: e.target.value })}
                                placeholder="E.g. Light Music, Mappilapattu"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.9rem' }}>Off Stage Events (comma separated)</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.offStageEvents}
                                onChange={(e) => setEditForm({ ...editForm, offStageEvents: e.target.value })}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#888', marginBottom: '5px', fontSize: '0.9rem' }}>General Events (comma separated)</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.generalEvents}
                                onChange={(e) => setEditForm({ ...editForm, generalEvents: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: '#ccc', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdate}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#e63946', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
