import React, { useState, useEffect } from "react";
import { collection, setDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import { useConfirm } from "../hooks/useConfirm";
import ConfirmDialog from "./ConfirmDialog";

export default function ManageStudents() {
    const [students, setStudents] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

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
            "1 THAMHEEDIYYA ULA",
            "2 THAMHEEDIYYA SANIYA",
            "3 ALIYA ULA",
            "4 ALIYA SANIYA",
            "5 ALIYA SALISA"
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

    const showToast = (msg, type = "success") => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (studentClass.includes("THAMHEEDIYYA") && dynamicCategories.includes("Junior")) {
            setCategory("Junior");
        } else if (studentClass.includes("ALIYA") && dynamicCategories.includes("Senior")) {
            setCategory("Senior");
        }
    }, [studentClass, dynamicCategories]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Teams
                const teamSnap = await getDocs(query(collection(db, "teams")));
                const teamList = teamSnap.docs.map(d => d.data().name);
                setTeams(teamList);

                // Fetch Students
                const studentSnap = await getDocs(query(collection(db, "students"), orderBy("chestNumber")));
                const studentList = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setStudents(studentList);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
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
            setStudents(prev => prev.filter(s => s.id !== id));
            showToast("Student deleted.");
            if (editId === id) handleCancel();
        } catch (error) {
            showToast("Failed to delete.", "error");
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

    return (
        <div className="manage-events-container">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmState && <ConfirmDialog {...confirmState} />}
            <h3 className="section-title">🎓 Master Student Database</h3>

            <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
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
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Chest No *</label>
                                <input type="text" className="admin-input" value={chestNumber} onChange={e => setChestNumber(e.target.value)} required />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>CIC No</label>
                                <input type="text" className="admin-input" value={cicNumber} onChange={e => setCicNumber(e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Class / Section</label>
                                <select className="admin-input" value={studentClass} onChange={e => setStudentClass(e.target.value)}>
                                    <option value="">-- Select Class --</option>
                                    {dynamicClasses.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Category</label>
                                <select className="admin-input" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="">-- Select --</option>
                                    {dynamicCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
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
                                    <th>Chest No</th>
                                    <th>Name</th>
                                    <th>Class</th>
                                    <th>Category</th>
                                    <th>Team</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.length > 0 ? students.map(student => (
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
