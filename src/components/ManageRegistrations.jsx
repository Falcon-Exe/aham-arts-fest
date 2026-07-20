import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";
import { isGeneralEvent } from "../constants/events";

export default function ManageRegistrations() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const { confirm, confirmState } = useConfirm();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'CHEST NUMBER', direction: 'asc' });
    const [teams, setTeams] = useState([]);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const snapshot = await getDocs(collection(db, "teams"));
                const teamNames = snapshot.docs.map(doc => doc.data().name);
                setTeams(teamNames);
            } catch (err) {
                console.error("Error fetching teams:", err);
            }
        };
        fetchTeams();
    }, []);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50);

    // Reset page on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

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
                (reg["CIC NUMBER"] || reg["CIC NO"] || "").toString().includes(lowerTerm) ||
                (reg["ON STAGE EVENTS"] || "").toLowerCase().includes(lowerTerm) ||
                (reg["OFF STAGE EVENTS"] || "").toLowerCase().includes(lowerTerm) ||
                (reg["GENERAL EVENTS"] || "").toLowerCase().includes(lowerTerm)
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

    // Fetch Registrations
    const fetchRegistrations = useCallback(async () => {
        setLoading(true);

        try {
            const snapshot = await getDocs(query(collection(db, "registrations"), orderBy("submittedAt", "desc")));
            
            const firestoreData = snapshot.docs.map(doc => {
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
                    _submittedAt: data.submittedAt,
                    _source: "firestore"
                };
            });

            setRegistrations(firestoreData);

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

            // Update existing Firestore record
            const docRef = doc(db, "registrations", editingReg._id);
            await updateDoc(docRef, payload);
            showToast("Registration updated successfully", "success");

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
        link.setAttribute("download", `hamartia_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sortedRegistrations = getSortedRegistrations();
    const totalPages = Math.ceil(sortedRegistrations.length / itemsPerPage);
    const paginatedRegistrations = sortedRegistrations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="manage-results">
            {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
            {confirmState && <ConfirmDialog {...confirmState} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Manage All Registrations</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-start' }}>
                    <input
                        type="text"
                        placeholder="Search Name, Chest No, Events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="admin-input"
                        style={{ flex: '1 1 200px', margin: 0, maxWidth: '100%' }}
                    />
                    <button onClick={downloadCSV} className="tab-btn" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
                        Download CSV 📥
                    </button>
                    <button onClick={fetchRegistrations} className="tab-btn" style={{ background: 'var(--bg-tertiary)' }}>Refresh</button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</div>
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
                            {paginatedRegistrations.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>No registrations found.</td>
                                </tr>
                            ) : (
                                paginatedRegistrations.map(reg => (
                                    <tr key={reg._id}>
                                        <td>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: '#22c55e',
                                                color: 'var(--text-main)'
                                            }}>
                                                APP
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
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', padding: '20px 0', borderTop: '1px solid #333' }}>
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="tab-btn"
                                style={{ background: currentPage === 1 ? 'var(--surface)' : 'var(--bg-secondary)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)' }}
                            >
                                Previous
                            </button>
                            <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
                                Page <strong style={{ color: 'var(--text-main)' }}>{currentPage}</strong> of {totalPages} 
                                <span style={{ marginLeft: '10px', fontSize: '0.8rem' }}>({sortedRegistrations.length} total)</span>
                            </span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="tab-btn"
                                style={{ background: currentPage === totalPages ? 'var(--surface)' : 'var(--bg-secondary)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)' }}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* EDIT MODAL */}
            {isEditModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: 'var(--bg-secondary)', padding: '30px', borderRadius: '12px', width: '500px',
                        border: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '15px'
                    }}>
                        <h3 style={{ color: 'var(--text-main)', margin: 0 }}>Edit Registration</h3>

                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem' }}>Full Name</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.fullName}
                                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem' }}>Chest Number</label>
                                <input
                                    className="admin-input"
                                    style={{ width: '100%', margin: 0 }}
                                    value={editForm.chestNumber}
                                    onChange={(e) => setEditForm({ ...editForm, chestNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem' }}>Team</label>
                                <select
                                    className="admin-input"
                                    style={{ width: '100%', margin: 0 }}
                                    value={editForm.team}
                                    onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                                >
                                    {teams.length > 0 ? (
                                        teams.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="PYRA">PYRA</option>
                                            <option value="IGNIS">IGNIS</option>
                                            <option value="ATASH">ATASH</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem' }}>CIC Number</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.cicNumber}
                                onChange={(e) => setEditForm({ ...editForm, cicNumber: e.target.value })}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem' }}>On Stage Events (comma separated)</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.onStageEvents}
                                onChange={(e) => setEditForm({ ...editForm, onStageEvents: e.target.value })}
                                placeholder="E.g. Light Music, Mappilapattu"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem' }}>Off Stage Events (comma separated)</label>
                            <input
                                className="admin-input"
                                style={{ width: '100%', margin: 0 }}
                                value={editForm.offStageEvents}
                                onChange={(e) => setEditForm({ ...editForm, offStageEvents: e.target.value })}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '5px', fontSize: '0.9rem' }}>General Events (comma separated)</label>
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
                                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdate}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--secondary)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
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
