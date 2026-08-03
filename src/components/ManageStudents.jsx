import React, { useState, useEffect, useRef } from "react";
import { collection, setDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, writeBatch, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Toast from "./Toast";
import { useConfirm } from "../hooks/useConfirm";
import ConfirmDialog from "./ConfirmDialog";

export default function ManageStudents() {
    const [students, setStudents] = useState([]);
    const [teams, setTeams] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [eventFilter, setEventFilter] = useState("all"); // 'all', 'registered', 'not_registered'
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
    const [showForm, setShowForm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const { confirm, confirmState } = useConfirm();

    const fileInputRef = useRef(null);
    const tableContainerRef = useRef(null);

    useEffect(() => {
        const slider = tableContainerRef.current;
        if (!slider) return;

        let isDown = false;
        let startX;
        let scrollLeft;

        const handleMouseDown = (e) => {
            isDown = true;
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        };

        const handleMouseLeave = () => { isDown = false; };
        const handleMouseUp = () => { isDown = false; };

        const handleMouseMove = (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 1.5;
            slider.scrollLeft = scrollLeft - walk;
        };

        slider.addEventListener('mousedown', handleMouseDown);
        slider.addEventListener('mouseleave', handleMouseLeave);
        slider.addEventListener('mouseup', handleMouseUp);
        slider.addEventListener('mousemove', handleMouseMove);

        return () => {
            slider.removeEventListener('mousedown', handleMouseDown);
            slider.removeEventListener('mouseleave', handleMouseLeave);
            slider.removeEventListener('mouseup', handleMouseUp);
            slider.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

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

        // Real-time sync for Registrations
        const qRegs = query(collection(db, "registrations"));
        const unsubscribeRegs = onSnapshot(qRegs, (snapshot) => {
            const regList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRegistrations(regList);
        }, (error) => {
            console.error("Error syncing registrations:", error);
        });

        return () => {
            unsubscribe();
            unsubscribeRegs();
        };
    }, []);

    const getStudentRegistration = React.useCallback((student) => {
        if (!student || !registrations.length) return null;
        const studentChest = String(student.chestNumber || '').trim().toUpperCase();
        const studentName = String(student.fullName || '').trim().toUpperCase();
        const studentTeam = String(student.team || '').trim().toUpperCase();

        return registrations.find(r => {
            const regChest = String(r.chestNumber || r.chestNo || '').trim().toUpperCase();
            if (studentChest && regChest && regChest === studentChest) return true;
            const regName = String(r.fullName || r.name || '').trim().toUpperCase();
            const regTeam = String(r.team || '').trim().toUpperCase();
            return regName === studentName && (regTeam === studentTeam || !studentTeam);
        });
    }, [registrations]);

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
            const existingStudent = students.find(s => s.id === editId);
            const oldChest = existingStudent?.chestNumber;
            const oldName = existingStudent?.fullName;

            // Optimistically update local state
            setStudents(prev => prev.map(s => s.id === editId ? { id: editId, ...studentData } : s));
            showToast("Student updated successfully!");

            // Sync to server in background + cascade to registrations
            (async () => {
                try {
                    await updateDoc(doc(db, "students", editId), studentData);

                    // Find and update linked registration documents
                    const regBatch = writeBatch(db);
                    const matchingRegs = registrations.filter(r => {
                        const rChest = String(r.chestNumber || r.chestNo || '').trim().toUpperCase();
                        const rName = String(r.fullName || r.name || '').trim().toUpperCase();
                        if (oldChest && rChest === oldChest.trim().toUpperCase()) return true;
                        if (studentData.chestNumber && rChest === studentData.chestNumber.trim().toUpperCase()) return true;
                        if (oldName && rName === oldName.trim().toUpperCase()) return true;
                        return false;
                    });

                    if (matchingRegs.length > 0) {
                        matchingRegs.forEach(reg => {
                            const regRef = doc(db, "registrations", reg.id);
                            regBatch.update(regRef, {
                                fullName: studentData.fullName,
                                chestNumber: studentData.chestNumber,
                                chestNo: studentData.chestNumber,
                                cicNumber: studentData.cicNumber,
                                studentClass: studentData.studentClass,
                                studentCategory: studentData.category,
                                team: studentData.team
                            });
                        });
                        await regBatch.commit();
                    }
                } catch (err) {
                    console.error("Background save/cascade failed:", err);
                    showToast("Failed to sync updates to server.", "error");
                }
            })();
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
        setShowForm(true);
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
        setShowForm(false);
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

    const eventCounts = React.useMemo(() => {
        let registered = 0;
        let notRegistered = 0;
        students.forEach(s => {
            const reg = getStudentRegistration(s);
            const onStage = reg?.onStageEvents || [];
            const offStage = reg?.offStageEvents || [];
            const general = reg?.generalEvents || [];
            if (onStage.length + offStage.length + general.length > 0) {
                registered++;
            } else {
                notRegistered++;
            }
        });
        return { registered, notRegistered, total: students.length };
    }, [students, getStudentRegistration]);

    const sortedStudents = React.useMemo(() => {
        let sortableStudents = [...students];

        if (eventFilter !== "all") {
            sortableStudents = sortableStudents.filter(s => {
                const reg = getStudentRegistration(s);
                const onStage = reg?.onStageEvents || [];
                const offStage = reg?.offStageEvents || [];
                const general = reg?.generalEvents || [];
                const hasEvents = (onStage.length + offStage.length + general.length) > 0;

                if (eventFilter === "registered") return hasEvents;
                if (eventFilter === "not_registered") return !hasEvents;
                return true;
            });
        }

        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase().trim();
            sortableStudents = sortableStudents.filter(s => {
                const reg = getStudentRegistration(s);
                const onStage = (reg?.onStageEvents || []).join(" ").toLowerCase();
                const offStage = (reg?.offStageEvents || []).join(" ").toLowerCase();
                const general = (reg?.generalEvents || []).join(" ").toLowerCase();
                const registeredBy = (reg?.team || "").toLowerCase();

                return (
                    (s.fullName || "").toLowerCase().includes(lower) ||
                    (s.chestNumber || "").toString().toLowerCase().includes(lower) ||
                    (s.cicNumber || "").toString().toLowerCase().includes(lower) ||
                    (s.studentClass || "").toLowerCase().includes(lower) ||
                    (s.category || "").toLowerCase().includes(lower) ||
                    (s.team || "").toLowerCase().includes(lower) ||
                    onStage.includes(lower) ||
                    offStage.includes(lower) ||
                    general.includes(lower) ||
                    registeredBy.includes(lower)
                );
            });
        }

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
    }, [students, registrations, sortConfig, searchTerm, eventFilter, getStudentRegistration]);

    const handleExportCSV = () => {
        if (!sortedStudents || sortedStudents.length === 0) {
            showToast("No student records found to export.", "error");
            return;
        }

        const headers = [
            "Chest Number",
            "Full Name",
            "CIC Number",
            "Class",
            "Category",
            "Team",
            "On Stage Events",
            "Off Stage Events",
            "General Events",
            "Total Events",
            "Registration Status",
            "Submitted By Team",
            "Submission Date"
        ];

        const rows = sortedStudents.map(student => {
            const reg = getStudentRegistration(student);
            const studentClass = student.studentClass || student.class || reg?.studentClass || reg?.class || reg?.CLASS || "";
            const category = student.category || student.studentCategory || reg?.category || reg?.studentCategory || reg?.CATEGORY || "";
            const onStage = (reg?.onStageEvents || []).join("; ");
            const offStage = (reg?.offStageEvents || []).join("; ");
            const general = (reg?.generalEvents || []).join("; ");
            const totalEvents = (reg?.onStageEvents?.length || 0) + (reg?.offStageEvents?.length || 0) + (reg?.generalEvents?.length || 0);
            const regStatus = totalEvents > 0 ? "Registered" : "Not Registered";
            const submittedBy = reg?.team || student.team || "";
            const submittedAt = reg?.submittedAt ? new Date(reg.submittedAt).toLocaleDateString() : "";

            return [
                `"${student.chestNumber || student.chestNo || ''}"`,
                `"${(student.fullName || student.name || '').replace(/"/g, '""')}"`,
                `"${(student.cicNumber || student.cicNo || '').replace(/"/g, '""')}"`,
                `"${(studentClass || '').replace(/"/g, '""')}"`,
                `"${(category || '').replace(/"/g, '""')}"`,
                `"${(student.team || '').replace(/"/g, '""')}"`,
                `"${onStage.replace(/"/g, '""')}"`,
                `"${offStage.replace(/"/g, '""')}"`,
                `"${general.replace(/"/g, '""')}"`,
                `"${totalEvents}"`,
                `"${regStatus}"`,
                `"${submittedBy.replace(/"/g, '""')}"`,
                `"${submittedAt}"`
            ];
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const filterSuffix = eventFilter !== 'all' ? `_${eventFilter}` : '';
        link.setAttribute("download", `master_students${filterSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`Exported ${sortedStudents.length} student records to CSV!`);
    };

    return (
        <div className="manage-events-container">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmState && <ConfirmDialog {...confirmState} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 className="section-title" style={{ margin: 0 }}>🎓 Master Student Database</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => {
                            if (showForm) {
                                handleCancel();
                            } else {
                                setShowForm(true);
                            }
                        }}
                        style={{
                            background: showForm ? 'var(--surface)' : 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '10px 18px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {showForm ? "✕ Close Form" : "➕ Add New Student"}
                    </button>

                    {students.length > 0 && (
                        <button 
                            onClick={handleDeleteAll} 
                            disabled={isSaving}
                            style={{
                                background: 'linear-gradient(135deg, #e63946 0%, #b71c1c 100%)',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '10px 18px',
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
                            padding: '10px 18px',
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
                        gap: '8px',
                        padding: '10px 18px',
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                {/* Form Section */}
                {(showForm || editId) && (
                    <div className="admin-card" style={{ width: '100%', boxSizing: 'border-box', animation: 'fadeIn 0.3s ease-in-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h4 style={{ margin: 0 }}>{editId ? "Edit Student" : "Add New Student"}</h4>
                            <button 
                                onClick={handleCancel}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '2 1 250px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Full Name *</label>
                                    <input type="text" className="admin-input" value={fullName} onChange={e => setFullName(e.target.value)} required />
                                </div>
                                <div style={{ flex: '1 1 120px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Chest No *</label>
                                    <input type="text" className="admin-input" value={chestNumber} onChange={e => setChestNumber(e.target.value)} required />
                                </div>
                                <div style={{ flex: '1 1 120px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>CIC No</label>
                                    <input type="text" className="admin-input" value={cicNumber} onChange={e => setCicNumber(e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Class / Section</label>
                                    <select className="admin-input" value={studentClass} onChange={e => setStudentClass(e.target.value)}>
                                        <option value="">-- Select Class --</option>
                                        {dynamicClasses.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Category</label>
                                    <select className="admin-input" value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="">-- Select --</option>
                                        {dynamicCategories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Team *</label>
                                    <select className="admin-input" value={team} onChange={e => setTeam(e.target.value)} required>
                                        <option value="">-- Select --</option>
                                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="submit" className="admin-btn primary" disabled={isSaving} style={{ padding: '10px 24px' }}>
                                    {isSaving ? "Saving..." : (editId ? "Update Student" : "Add Student")}
                                </button>
                                <button type="button" className="admin-btn" onClick={handleCancel} style={{ background: 'var(--surface)' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* List Section */}
                <div className="admin-table-container" ref={tableContainerRef}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="admin-input"
                                placeholder="🔍 Search students by name, chest #, class, team, or registered event..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ flex: '1 1 300px' }}
                            />
                            <select
                                className="admin-input"
                                value={eventFilter}
                                onChange={e => setEventFilter(e.target.value)}
                                style={{ flex: '0 0 250px', minWidth: '180px' }}
                            >
                                <option value="all">📋 All Students ({eventCounts.total})</option>
                                <option value="registered">✅ With Registered Events ({eventCounts.registered})</option>
                                <option value="not_registered">⚪ Without Events ({eventCounts.notRegistered})</option>
                            </select>
                            <button
                                onClick={handleExportCSV}
                                disabled={sortedStudents.length === 0}
                                style={{
                                    background: sortedStudents.length > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--surface)',
                                    color: 'white',
                                    cursor: sortedStudents.length > 0 ? 'pointer' : 'not-allowed',
                                    padding: '10px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 'bold',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: sortedStudents.length > 0 ? '0 4px 15px rgba(16, 185, 129, 0.3)' : 'none',
                                    transition: 'all 0.3s ease',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                📥 Export CSV ({sortedStudents.length})
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            <span>👈 Swipe / drag horizontally to view all columns 👉</span>
                        </div>
                    </div>
                    {loading ? <p>Loading students...</p> : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('chestNumber')} style={{ cursor: 'pointer' }}>Chest No {sortConfig.key === 'chestNumber' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('fullName')} style={{ cursor: 'pointer' }}>Name {sortConfig.key === 'fullName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('studentClass')} style={{ cursor: 'pointer' }}>Class {sortConfig.key === 'studentClass' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category {sortConfig.key === 'category' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('team')} style={{ cursor: 'pointer' }}>Team {sortConfig.key === 'team' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th>Registered Events & Registrant Details</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStudents.length > 0 ? sortedStudents.map(student => {
                                    const reg = getStudentRegistration(student);
                                    const onStage = reg?.onStageEvents || [];
                                    const offStage = reg?.offStageEvents || [];
                                    const general = reg?.generalEvents || [];
                                    const totalEvents = onStage.length + offStage.length + general.length;

                                    return (
                                        <tr key={student.id}>
                                            <td style={{ fontWeight: 'bold', color: 'var(--primary-light)' }}>{student.chestNumber}</td>
                                            <td>{student.fullName} <br /><small style={{ color: 'gray' }}>{student.cicNumber}</small></td>
                                            <td>{student.studentClass}</td>
                                            <td>{student.category}</td>
                                            <td>{student.team}</td>
                                            <td style={{ whiteSpace: 'normal', minWidth: '220px', maxWidth: '320px' }}>
                                                {totalEvents > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                                                        {onStage.length > 0 && (
                                                            <div>
                                                                <strong style={{ color: '#ec4899' }}>🎭 On-Stage ({onStage.length}): </strong>
                                                                <span>{onStage.join(", ")}</span>
                                                            </div>
                                                        )}
                                                        {offStage.length > 0 && (
                                                            <div>
                                                                <strong style={{ color: '#3b82f6' }}>🎨 Off-Stage ({offStage.length}): </strong>
                                                                <span>{offStage.join(", ")}</span>
                                                            </div>
                                                        )}
                                                        {general.length > 0 && (
                                                            <div>
                                                                <strong style={{ color: '#eab308' }}>🌟 General ({general.length}): </strong>
                                                                <span>{general.join(", ")}</span>
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                                                            Submitted by: <strong style={{ color: 'var(--text-main)' }}>{reg.team || student.team}</strong>
                                                            {reg.submittedAt && ` • ${new Date(reg.submittedAt).toLocaleDateString()}`}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                        ⚪ Not Registered Yet
                                                    </span>
                                                )}
                                            </td>
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
                                    );
                                }) : (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No matching students found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
