import React, { useState, useEffect, useRef } from "react";
import { collection, setDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, writeBatch, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import { useConfirm } from "../hooks/useConfirm";
import ConfirmDialog from "./ConfirmDialog";

export default function ManageStudents() {
    const [students, setStudents] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'chestNumber', direction: 'asc' });

    // Load dynamic classes and categories
    let dynamicClasses = [];
    try {
        const storedClasses = localStorage.getItem("branding_studentClasses");
        if (storedClasses) dynamicClasses = JSON.parse(storedClasses);
    } catch (e) {
        console.error(e);
    }
    if (dynamicClasses.length === 0) {
        dynamicClasses = [
            "THAMHEEDIYYA ULA",
            "THAMHEEDIYYA SANIYA",
            "ALIYA ULA",
            "ALIYA SANIYA",
            "ALIYA SALISA"
        ];
    }

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

    const [fullName, setFullName] = useState("");
    const [chestNumber, setChestNumber] = useState("");
    const [cicNumber, setCicNumber] = useState("");
    const [studentClass, setStudentClass] = useState("");
    const [category, setCategory] = useState("");
    const [team, setTeam] = useState("");

    const [editId, setEditId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const { confirm, confirmState } = useConfirm();

    const fileInputRef = useRef(null);

    const showToast = (msg, type = "success") => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            let csvData = event.target.result;
            // Handle BOM
            if (csvData.charCodeAt(0) === 0xFEFF) csvData = csvData.slice(1);

            const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) {
                showToast("CSV file seems empty or only contains headers.", "error");
                return;
            }

            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

            setIsSaving(true);
            try {
                const batch = writeBatch(db);
                let addedCount = 0;
                const newStudentsList = [];

                // Track current chest number per team and class type
                const teamChestCounters = {
                    "TEAM A_THAMHEEDIYYA": 101,
                    "TEAM A_ALIYA": 151,
                    "TEAM B_THAMHEEDIYYA": 201,
                    "TEAM B_ALIYA": 251,
                    "TEAM C_THAMHEEDIYYA": 301,
                    "TEAM C_ALIYA": 351
                };
                let fallbackCounter = 401; // For any other unexpected team

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(",").map(v => v.trim());
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] || "";
                    });

                    // Map possible header variations
                    const fullName = row.fullname || row.name || row.studentname || "";
                    let chestNumber = row.chestnumber || row.chestno || row.chest || "";
                    const cicNumber = row.cicnumber || row.cicno || row.cic || "";
                    const studentClass = row.studentclass || row.class || row.section || "";

                    let category = row.category || "";
                    if (!category && studentClass) {
                        if (studentClass.toUpperCase().includes("THAMHEEDIYYA")) category = "Junior";
                        else if (studentClass.toUpperCase().includes("ALIYA")) category = "Senior";
                    }

                    const team = row.team || row.teamname || "";

                    if (fullName && team) {
                        if (!chestNumber) {
                            const upperTeam = team.toUpperCase();
                            const isAliya = studentClass.toUpperCase().includes("ALIYA") || category.toUpperCase() === "SENIOR";
                            const counterKey = `${upperTeam}_${isAliya ? 'ALIYA' : 'THAMHEEDIYYA'}`;

                            if (teamChestCounters[counterKey] !== undefined) {
                                chestNumber = String(teamChestCounters[counterKey]);
                                teamChestCounters[counterKey]++;
                            } else {
                                chestNumber = String(fallbackCounter);
                                fallbackCounter++;
                            }
                        }

                        const newDocRef = doc(collection(db, "students"));
                        const studentData = {
                            fullName,
                            chestNumber: chestNumber.toUpperCase(),
                            cicNumber,
                            studentClass,
                            category,
                            team,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        batch.set(newDocRef, studentData);
                        newStudentsList.push({ id: newDocRef.id, ...studentData });
                        addedCount++;
                    }
                }

                if (addedCount > 0) {
                    await batch.commit();
                    // Removed manual setStudents because onSnapshot will handle it automatically
                    showToast(`Successfully added ${addedCount} students!`);
                } else {
                    showToast("No valid rows found to import.", "error");
                }
            } catch (err) {
                console.error("Bulk upload error:", err);
                showToast("Failed to process bulk upload.", "error");
            } finally {
                setIsSaving(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    const handleAutoImport = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/students_import.csv');
            if (!response.ok) throw new Error("Could not fetch CSV");
            let csvData = await response.text();
            
            if (csvData.charCodeAt(0) === 0xFEFF) csvData = csvData.slice(1);

            const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) {
                showToast("CSV file seems empty.", "error");
                return;
            }

            const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
            const batch = writeBatch(db);
            let addedCount = 0;

            const teamChestCounters = {
                "TEAM A_THAMHEEDIYYA": 101,
                "TEAM A_ALIYA": 151,
                "TEAM B_THAMHEEDIYYA": 201,
                "TEAM B_ALIYA": 251,
                "TEAM C_THAMHEEDIYYA": 301,
                "TEAM C_ALIYA": 351
            };
            let fallbackCounter = 401;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(",").map(v => v.trim());
                if (values.length < 2 || !values[0]) continue;
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || "";
                });

                const fullName = row.fullname || row.name || row.studentname || "";
                let chestNumber = row.chestnumber || row.chestno || row.chest || "";
                const cicNumber = row.cicnumber || row.cicno || row.cic || "";
                const studentClass = row.studentclass || row.class || row.section || "";

                let category = row.category || "";
                if (!category && studentClass) {
                    if (studentClass.toUpperCase().includes("THAMHEEDIYYA")) category = "Junior";
                    else if (studentClass.toUpperCase().includes("ALIYA")) category = "Senior";
                }

                const team = row.team || row.teamname || "";

                if (fullName) {
                    if (!chestNumber) {
                        const upperTeam = team.toUpperCase();
                        const isAliya = studentClass.toUpperCase().includes("ALIYA") || category.toUpperCase() === "SENIOR";
                        const counterKey = `${upperTeam}_${isAliya ? 'ALIYA' : 'THAMHEEDIYYA'}`;

                        if (upperTeam && teamChestCounters[counterKey] !== undefined) {
                            chestNumber = String(teamChestCounters[counterKey]);
                            teamChestCounters[counterKey]++;
                        } else {
                            chestNumber = String(fallbackCounter);
                            fallbackCounter++;
                        }
                    }

                    const newDocRef = doc(collection(db, "students"));
                    const studentData = {
                        fullName,
                        chestNumber: chestNumber.toUpperCase(),
                        cicNumber,
                        studentClass,
                        category,
                        team,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    batch.set(newDocRef, studentData);
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                await batch.commit();
                showToast(`Successfully auto-imported ${addedCount} students!`);
            } else {
                showToast("No valid rows found to import.", "error");
            }
        } catch (error) {
            console.error("Auto import error:", error);
            showToast("Failed to auto-import students.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (studentClass.includes("THAMHEEDIYYA") && dynamicCategories.includes("Junior")) {
            setCategory("Junior");
        } else if (studentClass.includes("ALIYA") && dynamicCategories.includes("Senior")) {
            setCategory("Senior");
        }
    }, [studentClass, dynamicCategories]);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                // Fetch Teams once
                const teamSnap = await getDocs(query(collection(db, "teams")));
                const teamList = teamSnap.docs.map(d => d.data().name);
                setTeams(teamList);
            } catch (error) {
                console.error("Error fetching teams:", error);
            }
        };
        fetchTeams();

        // Real-time sync for Students
        const q = query(collection(db, "students"), orderBy("chestNumber"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const studentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(studentList);
            setLoading(false);
        }, (error) => {
            console.error("Error syncing students:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Optimistic UI saving - do not block the UI while Firebase syncs
        setIsSaving(true);

        const studentData = {
            fullName,
            chestNumber: chestNumber.toUpperCase(),
            cicNumber,
            studentClass,
            category,
            team,
            updatedAt: new Date().toISOString()
        };

        if (editId) {
            // Optimistically update local state
            setStudents(prev => prev.map(s => s.id === editId ? { id: editId, ...studentData } : s));
            showToast("Student updated successfully!");

            // Sync to server in background
            updateDoc(doc(db, "students", editId), studentData).catch(err => {
                console.error("Background save failed:", err);
                showToast("Failed to sync updates to server.", "error");
            });
        } else {
            studentData.createdAt = new Date().toISOString();

            // Generate a new ID instantly
            const newDocRef = doc(collection(db, "students"));

            // Optimistically update local state
            setStudents(prev => [...prev, { id: newDocRef.id, ...studentData }]);
            showToast("Student added successfully!");

            // Sync to server in background
            setDoc(newDocRef, studentData).catch(err => {
                console.error("Background save failed:", err);
                showToast("Failed to sync new student to server.", "error");
            });
        }

        setIsSaving(false);
        handleCancel();
    };

    const handleEdit = (student) => {
        setEditId(student.id);
        setFullName(student.fullName);
        setChestNumber(student.chestNumber);
        setCicNumber(student.cicNumber || "");
        setStudentClass(student.studentClass || "");
        setCategory(student.category || "");
        setTeam(student.team || "");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id, name) => {
        if (!await confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await deleteDoc(doc(db, "students", id));
            showToast("Student deleted.");
            if (editId === id) handleCancel();
        } catch (error) {
            showToast("Failed to delete.", "error");
        }
    };

    const handleDeleteAll = async () => {
        if (!await confirm("🚨 DANGER: Are you sure you want to delete ALL students? This cannot be undone!")) return;
        if (!await confirm("Please confirm again: Delete ALL students?")) return;
        
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            students.forEach(student => {
                batch.delete(doc(db, "students", student.id));
            });
            await batch.commit();
            showToast("All students deleted successfully.");
        } catch (error) {
            console.error("Error deleting all:", error);
            showToast("Failed to delete all students.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditId(null);
        setFullName("");
        setChestNumber("");
        setCicNumber("");
        setStudentClass("");
        setCategory("");
        setTeam("");
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedStudents = React.useMemo(() => {
        let sortableStudents = [...students];
        if (sortConfig.key !== null) {
            sortableStudents.sort((a, b) => {
                let aVal = a[sortConfig.key] || '';
                let bVal = b[sortConfig.key] || '';
                
                // Numeric sort for chest number if possible
                if (sortConfig.key === 'chestNumber') {
                    const aNum = parseInt(aVal, 10);
                    const bNum = parseInt(bVal, 10);
                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
                    }
                }
                
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
                
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableStudents;
    }, [students, sortConfig]);

    return (
        <div className="manage-events-container">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmState && <ConfirmDialog {...confirmState} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 className="section-title" style={{ margin: 0 }}>🎓 Master Student Database</h3>
                <div style={{ display: 'flex', gap: '15px' }}>
                    {students.length > 0 && (
                        <button 
                            onClick={handleDeleteAll} 
                            disabled={isSaving}
                            style={{
                                background: 'linear-gradient(135deg, #e63946 0%, #b71c1c 100%)',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 15px rgba(230, 57, 70, 0.3)',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {isSaving ? "Deleting..." : "🗑️ Delete All"}
                        </button>
                    )}
                    <button 
                        onClick={handleAutoImport} 
                        disabled={isSaving}
                        style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isSaving ? "Importing..." : "⚡ Auto-Import System Data"}
                    </button>
                    <label className="admin-btn" style={{ 
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)', 
                        color: 'white',
                        cursor: 'pointer', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        📥 Bulk Upload (CSV)
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleBulkUpload}
                            style={{ display: 'none' }}
                            ref={fileInputRef}
                        />
                    </label>
                </div>
            </div>

            <div className="dashboard-split-layout">
                {/* Form Section */}
                <div className="admin-card">
                    <h4>{editId ? "Edit Student" : "Add New Student"}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                        Pre-register students so team leaders can just select them from a list.
                    </p>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Full Name *</label>
                            <input type="text" className="admin-input" value={fullName} onChange={e => setFullName(e.target.value)} required />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 120px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Chest No *</label>
                                <input type="text" className="admin-input" value={chestNumber} onChange={e => setChestNumber(e.target.value)} required />
                            </div>
                            <div style={{ flex: '1 1 120px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>CIC No</label>
                                <input type="text" className="admin-input" value={cicNumber} onChange={e => setCicNumber(e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 100px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Class / Section</label>
                                <select className="admin-input" value={studentClass} onChange={e => setStudentClass(e.target.value)}>
                                    <option value="">-- Select Class --</option>
                                    {dynamicClasses.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Category</label>
                                <select className="admin-input" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="">-- Select --</option>
                                    {dynamicCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Team *</label>
                                <select className="admin-input" value={team} onChange={e => setTeam(e.target.value)} required>
                                    <option value="">-- Select --</option>
                                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button type="submit" className="admin-btn primary" disabled={isSaving} style={{ flex: 1 }}>
                                {isSaving ? "Saving..." : (editId ? "Update Student" : "Add Student")}
                            </button>
                            {editId && (
                                <button type="button" className="admin-btn" onClick={handleCancel} style={{ background: 'var(--surface)' }}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* List Section */}
                <div className="admin-table-container">
                    {loading ? <p>Loading students...</p> : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('chestNumber')} style={{ cursor: 'pointer' }}>Chest No {sortConfig.key === 'chestNumber' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('fullName')} style={{ cursor: 'pointer' }}>Name {sortConfig.key === 'fullName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('studentClass')} style={{ cursor: 'pointer' }}>Class {sortConfig.key === 'studentClass' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category {sortConfig.key === 'category' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('team')} style={{ cursor: 'pointer' }}>Team {sortConfig.key === 'team' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStudents.length > 0 ? sortedStudents.map(student => (
                                    <tr key={student.id}>
                                        <td style={{ fontWeight: 'bold', color: 'var(--primary-light)' }}>{student.chestNumber}</td>
                                        <td>{student.fullName} <br /><small style={{ color: 'gray' }}>{student.cicNumber}</small></td>
                                        <td>{student.studentClass}</td>
                                        <td>{student.category}</td>
                                        <td>{student.team}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleEdit(student)} className="tab-btn" style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: 'auto', background: 'var(--surface)' }}>
                                                    Edit
                                                </button>
                                                <button onClick={() => handleDelete(student.id, student.fullName)} className="action-btn delete">
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No students pre-registered yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
