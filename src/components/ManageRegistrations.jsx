import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
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
    const [teams, setTeams] = useState([]);
    const [eventsList, setEventsList] = useState([]);
    const [studentsList, setStudentsList] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'CHEST NUMBER', direction: 'asc' });

    useEffect(() => {
        const fetchTeamsEventsAndStudents = async () => {
            try {
                const teamSnap = await getDocs(collection(db, "teams"));
                const teamNames = teamSnap.docs.map(doc => doc.data().name);
                setTeams(teamNames);

                const eventSnap = await getDocs(collection(db, "events"));
                const events = eventSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setEventsList(events);

                const studentSnap = await getDocs(collection(db, "students"));
                const students = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setStudentsList(students);
            } catch (err) {
                console.error("Error fetching teams/events/students:", err);
            }
        };
        fetchTeamsEventsAndStudents();
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
                    _source: "firestore",
                    onStageCount: data.onStageEvents?.length || 0,
                    offStageCount: data.offStageEvents?.length || 0
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
            cicNumber: reg["CIC NO"] || "",
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
            // Normalize event names to official casing from eventsList
            const normalizeEventName = (name) => {
                const found = eventsList.find(e => e.name.trim().toUpperCase() === name.trim().toUpperCase());
                return found ? found.name : name.trim();
            };

            // Convert comma strings back to arrays
            const onStageArr = editForm.onStageEvents.split(',').map(s => s.trim()).filter(Boolean).map(normalizeEventName);
            const offStageArr = editForm.offStageEvents.split(',').map(s => s.trim()).filter(Boolean).map(normalizeEventName);
            const generalArr = editForm.generalEvents.split(',').map(s => s.trim()).filter(Boolean).map(normalizeEventName);

            const payload = {
                fullName: editForm.fullName.trim(),
                chestNumber: editForm.chestNumber.trim(),
                cicNumber: editForm.cicNumber.trim(),
                team: editForm.team,
                onStageEvents: onStageArr,
                offStageEvents: offStageArr,
                generalEvents: generalArr,
                events: Array.from(new Set([...onStageArr, ...offStageArr, ...generalArr]))
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

    const handleReconcileAllRegistrations = async () => {
        if (!await confirm("This will scan all registration documents in Firestore and fix any mismatched event counts (e.g. from previous edit operations). Continue?")) return;
        setLoading(true);
        let fixedCount = 0;
        try {
            const querySnapshot = await getDocs(collection(db, "registrations"));
            const batch = writeBatch(db);
            let batchCount = 0;
            
            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                const onStage = data.onStageEvents || [];
                const offStage = data.offStageEvents || [];
                const general = data.generalEvents || [];
                const currentEvents = data.events || [];
                
                const correctEvents = Array.from(new Set([...onStage, ...offStage, ...general])).sort();
                const sortedCurrentEvents = [...currentEvents].sort();
                
                const isMismatch = JSON.stringify(correctEvents) !== JSON.stringify(sortedCurrentEvents);
                if (isMismatch) {
                    batch.update(docSnap.ref, { events: correctEvents });
                    batchCount++;
                    fixedCount++;
                    
                    if (batchCount >= 500) {
                        await batch.commit();
                        batchCount = 0;
                    }
                }
            }
            
            if (batchCount > 0) {
                await batch.commit();
            }
            
            showToast(`Successfully fixed ${fixedCount} mismatched registrations!`, "success");
            fetchRegistrations();
        } catch (err) {
            console.error("Reconcile failed:", err);
            showToast("Failed to reconcile registrations: " + err.message, "error");
        } finally {
            setLoading(false);
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
            "Class",
            "Category",
            "Team",
            "On Stage Events",
            "Off Stage Events",
            "General Events"
        ];

        const rows = registrations.map(reg => {
            const chestNo = reg["CHEST NUMBER"] || reg["CHEST NO"] || "";
            const matchedStudent = studentsList.find(s =>
                chestNo && String(s.chestNumber || s.chestNo || "").trim().toUpperCase() === String(chestNo).trim().toUpperCase()
            );
            const studentClass = reg["CLASS"] || reg["STUDENT CLASS"] || matchedStudent?.studentClass || matchedStudent?.class || "";
            const category = reg["CATEGORY"] || reg["STUDENT CATEGORY"] || matchedStudent?.category || matchedStudent?.studentCategory || "";

            return [
                `"${reg._source || ''}"`,
                `"${(reg["CANDIDATE NAME"] || reg["CANDIDATE  FULL NAME"] || "").replace(/"/g, '""')}"`,
                `"${(reg["CIC NUMBER"] || reg["CIC NO"] || "").replace(/"/g, '""')}"`,
                `"${(chestNo || "").replace(/"/g, '""')}"`,
                `"${(studentClass || "").replace(/"/g, '""')}"`,
                `"${(category || "").replace(/"/g, '""')}"`,
                `"${(reg["TEAM"] || reg["TEAM NAME"] || "").replace(/"/g, '""')}"`,
                `"${(reg["ON STAGE EVENTS"] || "").replace(/"/g, '""')}"`,
                `"${(reg["OFF STAGE EVENTS"] || "").replace(/"/g, '""')}"`,
                `"${(reg["GENERAL EVENTS"] || "").replace(/"/g, '""')}"`
            ];
        });

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

    const getStudentCategory = (chestNumber) => {
        if (!chestNumber) return "";
        const student = studentsList.find(s => 
            String(s.chestNumber).trim().toUpperCase() === String(chestNumber).trim().toUpperCase()
        );
        return student ? (student.category || student.studentCategory || "") : "";
    };

    const isExceptionIndividualEvent = (name) => {
        if (!name) return false;
        const cleanName = name.trim().toUpperCase();
        return cleanName === "TED X TALK" || cleanName === "TED-X TALK";
    };

    const getTeamLimitViolations = () => {
        const violations = [];
        if (registrations.length === 0 || eventsList.length === 0 || studentsList.length === 0) return [];

        eventsList.forEach(event => {
            // Only check On Stage and Off Stage events (exclude General events except exceptional ones)
            const isGeneral = event.type === "General" || isGeneralEvent(event.name);
            if (isGeneral && !isExceptionIndividualEvent(event.name)) return;

            teams.forEach(team => {
                // Filter registrations for this team & event
                const teamRegsForEvent = registrations.filter(reg => {
                    if (reg["TEAM"] !== team) return false;
                    // Check if registration lists this event
                    const onStageList = reg["ON STAGE EVENTS"] ? reg["ON STAGE EVENTS"].split(',').map(s => s.trim().toUpperCase()) : [];
                    const offStageList = reg["OFF STAGE EVENTS"] ? reg["OFF STAGE EVENTS"].split(',').map(s => s.trim().toUpperCase()) : [];
                    const targetUpper = String(event.name).trim().toUpperCase();
                    return onStageList.includes(targetUpper) || offStageList.includes(targetUpper);
                });

                // Group by category (Junior / Senior)
                const categories = ["Junior", "Senior"];
                categories.forEach(cat => {
                    const regsForCat = teamRegsForEvent.filter(reg => {
                        const chestNo = reg["CHEST NUMBER"] || reg["CHEST NO"];
                        const sCat = getStudentCategory(chestNo);
                        return sCat.toLowerCase() === cat.toLowerCase();
                    });

                    if (regsForCat.length > 2) {
                        violations.push({
                            event: event.name,
                            team: team,
                            category: cat,
                            count: regsForCat.length,
                            students: regsForCat.map(r => ({
                                name: r["CANDIDATE NAME"] || r["CANDIDATE  FULL NAME"],
                                chest: r["CHEST NUMBER"] || r["CHEST NO"],
                                reg: r
                             }))
                        });
                    }
                });

                // Check uncategorized registrations
                const regsWithoutCat = teamRegsForEvent.filter(reg => {
                    const chestNo = reg["CHEST NUMBER"] || reg["CHEST NO"];
                    const sCat = getStudentCategory(chestNo);
                    return !sCat;
                });
                if (regsWithoutCat.length > 2) {
                    violations.push({
                        event: event.name,
                        team: team,
                        category: "Uncategorized",
                        count: regsWithoutCat.length,
                        students: regsWithoutCat.map(r => ({
                            name: r["CANDIDATE NAME"] || r["CANDIDATE  FULL NAME"],
                            chest: r["CHEST NUMBER"] || r["CHEST NO"],
                            reg: r
                        }))
                    });
                }
            });
        });

        return violations;
    };

    const getStudentLimitViolations = () => {
        const violations = [];
        if (registrations.length === 0) return [];

        registrations.forEach(reg => {
            // Skip team-wide registrations (no chestNumber)
            if (!reg["CHEST NUMBER"] && !reg["CHEST NO"]) return;

            const name = reg["CANDIDATE NAME"] || reg["CANDIDATE  FULL NAME"];
            const chest = reg["CHEST NUMBER"] || reg["CHEST NO"];
            const team = reg["TEAM"] || reg["TEAM NAME"];

            if (reg.onStageCount > 4) {
                violations.push({
                    name,
                    chest,
                    team,
                    type: "On Stage",
                    count: reg.onStageCount,
                    events: reg["ON STAGE EVENTS"],
                    reg: reg
                });
            }

            if (reg.offStageCount > 4) {
                violations.push({
                    name,
                    chest,
                    team,
                    type: "Off Stage",
                    count: reg.offStageCount,
                    events: reg["OFF STAGE EVENTS"],
                    reg: reg
                });
            }
        });

        return violations;
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
                    <button onClick={handleReconcileAllRegistrations} className="tab-btn" style={{ background: '#3b82f6', color: 'white', border: 'none' }}>
                        🔄 Fix Stale Data
                    </button>
                </div>
            </div>

            {/* Team Limit Violations Warning */}
            {(() => {
                const violations = getTeamLimitViolations();
                if (violations.length === 0) return null;

                return (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '25px',
                        color: 'var(--text-main)'
                    }}>
                        <h4 style={{ 
                            margin: '0 0 12px 0', 
                            color: '#ef4444', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            fontSize: '1.05rem',
                            fontWeight: '600'
                        }}>
                            ⚠️ Team Event Limit Violations (Max 2 students per event per team)
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {violations.map((violation, idx) => (
                                <div key={idx} style={{ 
                                    background: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-soft)',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '5px' }}>
                                        <span>
                                            Event: <strong style={{ color: 'var(--primary-light)' }}>{violation.event}</strong>
                                        </span>
                                        <span>
                                            Category: <strong style={{ color: '#10b981' }}>{violation.category}</strong>
                                        </span>
                                        <span>
                                            Team: <strong style={{ color: 'var(--text-main)' }}>{violation.team}</strong>
                                        </span>
                                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                            Registered: {violation.count} students (Exceeds by {violation.count - 2})
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ minWidth: '60px' }}>Students:</span>
                                        {violation.students.map((s, sIdx) => (
                                            <span key={sIdx} style={{ 
                                                background: 'var(--bg-main)', 
                                                padding: '4px 8px', 
                                                borderRadius: '4px',
                                                border: '1px solid var(--border-soft)',
                                                color: 'var(--text-secondary)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <span>{s.name} {s.chest ? `(#${s.chest})` : ''}</span>
                                                <button
                                                    onClick={() => openEditModal(s.reg)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: 0,
                                                        fontSize: '0.85rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        color: '#3b82f6'
                                                    }}
                                                    title="Edit Candidate"
                                                >
                                                    ✏️
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Student Limit Violations Warning */}
            {(() => {
                const studentViolations = getStudentLimitViolations();
                if (studentViolations.length === 0) return null;

                return (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '25px',
                        color: 'var(--text-main)'
                    }}>
                        <h4 style={{ 
                            margin: '0 0 12px 0', 
                            color: '#ef4444', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            fontSize: '1.05rem',
                            fontWeight: '600'
                        }}>
                            ⚠️ Student Event Limit Violations (Max 4 events per category)
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {studentViolations.map((violation, idx) => (
                                <div key={idx} style={{ 
                                    background: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-soft)',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                                        <span>
                                            Candidate: <strong style={{ color: 'var(--text-main)' }}>{violation.name}</strong> {violation.chest ? `(#${violation.chest})` : ''}
                                        </span>
                                        <span>
                                            Team: <strong style={{ color: 'var(--text-main)' }}>{violation.team}</strong>
                                        </span>
                                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                            {violation.type}: {violation.count}/4 events (Exceeds by {violation.count - 4})
                                        </span>
                                        <button 
                                            onClick={() => openEditModal(violation.reg)}
                                            className="tab-btn" 
                                            style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#3b82f6', border: 'none', marginLeft: '10px' }}
                                        >
                                            Edit Candidate ✏️
                                        </button>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.8rem' }}>
                                        Events: <span style={{ color: 'var(--text-secondary)' }}>{violation.events}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

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
                                                <div style={{ color: '#4ade80', fontSize: '0.85rem' }}>
                                                    {reg["ON STAGE EVENTS"]}
                                                    {reg.onStageCount > 4 && (
                                                        <span style={{ 
                                                            display: 'block', 
                                                            color: '#ef4444', 
                                                            fontSize: '0.75rem', 
                                                            fontWeight: 'bold',
                                                            marginTop: '2px'
                                                        }}>
                                                            ⚠️ Limit Exceeded ({reg.onStageCount}/4)
                                                        </span>
                                                    )}
                                                </div>
                                            ) : <span style={{ color: '#ccc' }}>-</span>}
                                        </td>
                                        <td>
                                            {reg["OFF STAGE EVENTS"] ? (
                                                <div style={{ color: '#60a5fa', fontSize: '0.85rem' }}>
                                                    {reg["OFF STAGE EVENTS"]}
                                                    {reg.offStageCount > 4 && (
                                                        <span style={{ 
                                                            display: 'block', 
                                                            color: '#ef4444', 
                                                            fontSize: '0.75rem', 
                                                            fontWeight: 'bold',
                                                            marginTop: '2px'
                                                        }}>
                                                            ⚠️ Limit Exceeded ({reg.offStageCount}/4)
                                                        </span>
                                                    )}
                                                </div>
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
