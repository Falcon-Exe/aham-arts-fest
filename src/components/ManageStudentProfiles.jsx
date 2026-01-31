import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Papa from "papaparse";
import { CSV_URL } from "../config";

export default function ManageStudentProfiles() {
    const [allStudents, setAllStudents] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTeam, setFilterTeam] = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterEvent, setFilterEvent] = useState("All");

    const [sortConfig, setSortConfig] = useState({ key: 'chestNo', direction: 'ascending' });
    const [hoveredStudentId, setHoveredStudentId] = useState(null);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Registrations (CSV + Firestore)
                const csvPromise = fetch(CSV_URL + "&t=" + Date.now())
                    .then(res => res.text())
                    .then(csv => new Promise(resolve => {
                        Papa.parse(csv, {
                            header: true,
                            skipEmptyLines: true,
                            complete: (res) => resolve(res.data)
                        });
                    }));

                const regPromise = getDocs(collection(db, "registrations"));
                const resPromise = getDocs(collection(db, "results"));

                const [csvData, regSnap, resSnap] = await Promise.all([csvPromise, regPromise, resPromise]);

                // Normalize Registrations
                const regList = [];
                // Process Firestore Regs
                regSnap.forEach(doc => {
                    const d = doc.data();
                    regList.push({
                        id: doc.id,
                        source: 'app',
                        name: d.fullName,
                        chestNo: d.chestNumber ? String(d.chestNumber) : "",
                        cicNo: d.cicNumber,
                        team: d.team,
                        category: d.category || d.section || "",
                        onStage: d.onStageEvents || [],
                        offStage: d.offStageEvents || [],
                        general: d.generalEvents || []
                    });
                });
                // Process CSV Regs
                csvData.forEach((row, idx) => {
                    const chestNo = row["CHEST NUMBER"] || row["CHEST NO"] || "";
                    if (!chestNo) return;

                    const existing = regList.find(r => r.chestNo === chestNo);
                    if (!existing) {
                        const cleanEvents = (str) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
                        regList.push({
                            id: `csv_${idx}`,
                            source: 'csv',
                            name: row["CANDIDATE NAME"] || row["CANDIDATE  FULL NAME"],
                            chestNo: chestNo,
                            cicNo: row["CIC NUMBER"] || row["CIC NO"],
                            team: row["TEAM"] || row["TEAM NAME"],
                            category: row["CATEGORY"] || row["SECTION"] || "",
                            onStage: cleanEvents(row["ON STAGE EVENTS"] || row["ON STAGE ITEMS"]),
                            offStage: cleanEvents(row["OFF STAGE EVENTS"] || row["OFF STAGE ITEMS"]),
                            general: cleanEvents(row["GENERAL EVENTS"] || row["GENERAL ITEMS"])
                        });
                    }
                });

                // Process Results
                const resList = [];
                resSnap.forEach(doc => {
                    resList.push({ id: doc.id, ...doc.data() });
                });
                setResults(resList);

                // Pre-calculate points and details
                const studentListWithPoints = regList.map(student => {
                    const studentResults = resList.filter(r =>
                        (r.chestNo && String(r.chestNo) === String(student.chestNo)) ||
                        (r.name && r.name.toLowerCase() === student.name?.toLowerCase())
                    );
                    const totalPoints = studentResults.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
                    const hasParticipated = studentResults.length > 0;

                    // Calc details
                    const first = studentResults.filter(r => r.place === 'First').length;
                    const second = studentResults.filter(r => r.place === 'Second').length;
                    const third = studentResults.filter(r => r.place === 'Third').length;
                    const isWinner = first > 0 || second > 0 || third > 0;

                    // Calc grades summary
                    const gradeCounts = {};
                    studentResults.forEach(r => {
                        if (r.grade) {
                            gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;
                        }
                    });
                    const gradesStr = Object.entries(gradeCounts)
                        .map(([g, c]) => `${g}:${c}`)
                        .join(', ');

                    return { ...student, totalPoints, first, second, third, gradesStr, isWinner, hasParticipated };
                });

                setAllStudents(studentListWithPoints);

            } catch (err) {
                console.error("Error loading data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Helper: Logic to generate flat rows for export/view
    const generateStudentRows = (student) => {
        const studentResults = results.filter(r => {
            if (student.chestNo && r.chestNo) return String(r.chestNo) === String(student.chestNo);
            return r.name?.toLowerCase() === student.name?.toLowerCase() && r.team === student.team;
        });

        const allRegEvents = [
            ...student.onStage.map(e => ({ name: e, type: 'On Stage' })),
            ...student.offStage.map(e => ({ name: e, type: 'Off Stage' })),
            ...student.general.map(e => ({ name: e, type: 'General' }))
        ];

        const rows = allRegEvents.map(evt => {
            const res = studentResults.find(r => r.eventName.toLowerCase().trim() === evt.name.toLowerCase().trim());
            return {
                eventName: evt.name,
                category: res ? res.category : (student.section || "-"),
                place: res ? res.place : "-",
                grade: res ? res.grade : "-",
                points: res ? res.points : "-",
                isResult: !!res,
                uniqueId: `${student.id}-${evt.name}`
            };
        });

        // Add orphan results
        studentResults.forEach(res => {
            const exists = rows.find(r => r.eventName.toLowerCase().trim() === res.eventName.toLowerCase().trim());
            if (!exists) {
                rows.push({
                    eventName: res.eventName,
                    category: res.category,
                    place: res.place,
                    grade: res.grade,
                    points: res.points,
                    isResult: true,
                    uniqueId: `${student.id}-${res.eventName}-orphan`
                });
            }
        });

        if (rows.length === 0) {
            rows.push({
                eventName: "-",
                category: "-",
                place: "-",
                grade: "-",
                points: "-",
                uniqueId: `${student.id}-empty`
            });
        }
        return rows;
    };

    // Filter Logic
    const getFilteredStudents = () => {
        let list = allStudents;

        // Text Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(s =>
                s.name?.toLowerCase().includes(lower) ||
                String(s.chestNo).includes(lower) ||
                s.team?.toLowerCase().includes(lower)
            );
        }

        // Team Filter
        if (filterTeam !== "All") {
            list = list.filter(s => s.team === filterTeam);
        }

        // Status Filter
        if (filterStatus === "Winners") {
            list = list.filter(s => s.isWinner);
        } else if (filterStatus === "Participants with Points") {
            list = list.filter(s => s.totalPoints > 0);
        }

        // Event Filter
        if (filterEvent !== "All") {
            list = list.filter(s => {
                const allEvents = [...s.onStage, ...s.offStage, ...s.general];
                return allEvents.some(e => e.toUpperCase() === filterEvent.toUpperCase());
            });
        }

        return list;
    };

    // Sorting logic
    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredStudents = () => {
        let sortableItems = [...getFilteredStudents()];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'ascending'
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                }
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'ascending'
                        ? aValue - bValue
                        : bValue - aValue;
                }
                if (aValue === null || aValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
                if (bValue === null || bValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
                return 0;
            });
        }
        return sortableItems;
    };

    const filteredList = sortedAndFilteredStudents();

    // Export Logic
    const handleExportCSV = () => {
        const csvRows = [];
        // Header
        csvRows.push(["Chest No", "Name", "Team", "Event", "Category", "Prize", "Grade", "Points", "Total Points", "Medals Summary"]);

        filteredList.forEach(student => {
            const rows = generateStudentRows(student);
            rows.forEach(row => {
                csvRows.push([
                    student.chestNo,
                    student.name,
                    student.team,
                    row.eventName,
                    row.category,
                    row.place,
                    row.grade,
                    row.points,
                    student.totalPoints,
                    `${student.first > 0 ? student.first + ' Gold ' : ''}${student.second > 0 ? student.second + ' Silver ' : ''}${student.third > 0 ? student.third + ' Bronze' : ''}`.trim()
                ]);
            });
        });

        const csvString = Papa.unparse(csvRows);
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `student_profiles_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Unique Teams for Dropdown
    const teams = ["All", ...new Set(allStudents.map(s => s.team).filter(Boolean))];

    // Unique Events for Dropdown
    const allEventsSet = new Set();
    allStudents.forEach(s => {
        [...s.onStage, ...s.offStage, ...s.general].forEach(e => allEventsSet.add(e));
    });
    const events = ["All", ...Array.from(allEventsSet).sort()];

    return (
        <div className="manage-student-profiles">
            <h3 className="section-title">🔎 Student Profiles</h3>

            {/* Controls Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '300px' }}>
                    <input
                        type="text"
                        className="admin-input"
                        placeholder="Search Name, Chest No..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ flex: 2 }}
                    />
                    <select className="admin-input" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} style={{ flex: 1 }}>
                        {teams.map(t => <option key={t} value={t}>{t === "All" ? "All Teams" : t}</option>)}
                    </select>
                    <select className="admin-input" value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)} style={{ flex: 1 }}>
                        <option value="All">All Events</option>
                        {events.filter(e => e !== "All").map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <select className="admin-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ flex: 1 }}>
                        <option value="All">All Status</option>
                        <option value="Winners">Winners Only</option>
                        <option value="Participants with Points">With Points</option>
                    </select>
                </div>
                <button className="admin-button" onClick={handleExportCSV} style={{ backgroundColor: '#22c55e' }}>
                    📥 Export CSV
                </button>
            </div>

            {loading ? <p>Loading data...</p> : (
                <>
                    {/* Desktop Table View */}
                    <div className="admin-table-container desktop-view" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                        <table className="admin-table" style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('chestNo')} style={{ cursor: 'pointer', width: '80px' }}>
                                        Chest No {sortConfig.key === 'chestNo' && (sortConfig.direction === 'descending' ? '▼' : '▲')}
                                    </th>
                                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                                        Name {sortConfig.key === 'name' && (sortConfig.direction === 'descending' ? '▼' : '▲')}
                                    </th>
                                    <th onClick={() => handleSort('team')} style={{ cursor: 'pointer', width: '60px' }}>
                                        Team {sortConfig.key === 'team' && (sortConfig.direction === 'descending' ? '▼' : '▲')}
                                    </th>
                                    <th>Event</th>
                                    <th>Category</th>
                                    <th>Prize</th>
                                    <th>Grade</th>
                                    <th>Pts</th>
                                    <th style={{ width: '120px' }}>Summary</th>
                                    <th onClick={() => handleSort('totalPoints')} style={{ cursor: 'pointer', width: '80px', color: '#facc15' }}>
                                        Total Pts {sortConfig.key === 'totalPoints' && (sortConfig.direction === 'descending' ? '▼' : '▲')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.length === 0 ? (
                                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: '30px' }}>No records found</td></tr>
                                ) : filteredList.map((student, studentIndex) => {
                                    const rows = generateStudentRows(student);

                                    // Highlight Logic
                                    const isHovered = hoveredStudentId === student.id;
                                    const bgStyle = isHovered
                                        ? 'rgba(255, 255, 255, 0.1)' // Highlight
                                        : studentIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'; // Zebra

                                    return rows.map((row, rowIndex) => (
                                        <tr
                                            key={row.uniqueId}
                                            onMouseEnter={() => setHoveredStudentId(student.id)}
                                            onMouseLeave={() => setHoveredStudentId(null)}
                                            style={{
                                                background: bgStyle,
                                                transition: 'background 0.2s',
                                                borderBottom: rowIndex === rows.length - 1 ? '1px solid #444' : 'none'
                                            }}
                                        >
                                            {rowIndex === 0 && (
                                                <>
                                                    <td rowSpan={rows.length} style={{ fontFamily: 'monospace', fontSize: '1.1rem', verticalAlign: 'top', padding: '12px 8px', borderRight: '1px solid #333' }}>{student.chestNo}</td>
                                                    <td rowSpan={rows.length} style={{ fontWeight: '600', verticalAlign: 'top', padding: '12px 8px', borderRight: '1px solid #333' }}>{student.name}</td>
                                                    <td rowSpan={rows.length} style={{ verticalAlign: 'top', padding: '12px 8px', borderRight: '1px solid #333' }}>
                                                        <span className={`tag ${student.team?.toLowerCase()}-tag`} style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#333', color: '#ccc', fontSize: '0.8rem' }}>{student.team || "N/A"}</span>
                                                    </td>
                                                </>
                                            )}
                                            <td style={{ color: '#eee', padding: '8px 5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.eventName}</td>
                                            <td style={{ color: '#aaa', padding: '8px 5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.category}</td>
                                            <td style={{ padding: '8px 5px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: row.place === 'First' ? '#ffd700' : row.place === 'Second' ? '#c0c0c0' : row.place === 'Third' ? '#cd7f32' : '#fff' }}>{row.place}</td>
                                            <td style={{ padding: '8px 5px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 'bold', color: row.grade?.startsWith('A') ? '#4ade80' : '#fff' }}>{row.grade}</td>
                                            <td style={{ padding: '8px 5px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid #333', fontWeight: 'bold', color: row.points > 0 ? '#22c55e' : '#666' }}>{row.points}</td>

                                            {rowIndex === 0 && (
                                                <>
                                                    <td rowSpan={rows.length} style={{ verticalAlign: 'top', padding: '12px 8px', borderRight: '1px solid #333', fontSize: '0.8rem' }}>
                                                        {(student.first > 0 || student.second > 0 || student.third > 0) && (
                                                            <div style={{ marginBottom: '4px', display: 'flex', gap: '6px' }}>
                                                                {student.first > 0 && <span title="1st Place" style={{ color: '#ffd700' }}>🥇{student.first}</span>}
                                                                {student.second > 0 && <span title="2nd Place" style={{ color: '#c0c0c0' }}>🥈{student.second}</span>}
                                                                {student.third > 0 && <span title="3rd Place" style={{ color: '#cd7f32' }}>🥉{student.third}</span>}
                                                            </div>
                                                        )}
                                                        <div style={{ color: '#aaa' }}>{student.gradesStr || "-"}</div>
                                                    </td>
                                                    <td rowSpan={rows.length} style={{ verticalAlign: 'top', padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: student.totalPoints > 0 ? '#4ade80' : '#666' }}>{student.totalPoints}</td>
                                                </>
                                            )}
                                        </tr>
                                    ));
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View (Visible only on small screens via CSS) */}
                    <div className="mobile-view admin-table-container" style={{ display: 'none' }}>
                        {/* This section would be toggled by media queries in standard CSS, 
                           but for inline-react we might need JS width detection or just rely on global CSS. 
                           For now, I'll add a style tag to handle this responsiveness. */}
                        <style>{`
                           @media (max-width: 768px) {
                               .desktop-view { display: none !important; }
                               .mobile-view { display: block !important; }
                           }
                       `}</style>
                        {filteredList.map(student => {
                            const rows = generateStudentRows(student);
                            return (
                                <div key={student.id} style={{ background: '#1e1e1e', borderRadius: '8px', padding: '15px', marginBottom: '15px', border: '1px solid #333' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{student.name}</div>
                                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>#{student.chestNo} • <span className={`tag ${student.team?.toLowerCase()}-tag`}>{student.team}</span></div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#facc15' }}>{student.totalPoints}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>Points</div>
                                        </div>
                                    </div>

                                    {/* Summary Line */}
                                    {(student.first > 0 || student.second > 0 || student.third > 0 || student.gradesStr) && (
                                        <div style={{ background: '#333', padding: '8px', borderRadius: '4px', marginBottom: '10px', fontSize: '0.9rem', display: 'flex', gap: '10px' }}>
                                            {student.first > 0 && <span style={{ color: '#ffd700' }}>🥇 {student.first}</span>}
                                            {student.second > 0 && <span style={{ color: '#c0c0c0' }}>🥈 {student.second}</span>}
                                            {student.third > 0 && <span style={{ color: '#cd7f32' }}>🥉 {student.third}</span>}
                                            <span style={{ color: '#aaa', borderLeft: '1px solid #555', paddingLeft: '10px' }}>{student.gradesStr}</span>
                                        </div>
                                    )}

                                    {/* Events List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {rows.map(row => (
                                            <div key={row.uniqueId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                                                <div style={{ color: '#eee' }}>{row.eventName}</div>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    {row.grade && row.grade !== '-' && <span style={{ fontWeight: 'bold', color: row.grade.startsWith && row.grade.startsWith('A') ? '#4ade80' : '#fff' }}>{row.grade}</span>}
                                                    {row.place !== '-' && <span style={{ fontSize: '0.8rem', background: '#444', padding: '2px 6px', borderRadius: '4px' }}>{row.place}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
            {filteredList.length > 100 && <p style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', marginTop: '10px' }}>Showing first 100 matches. Use search.</p>}
        </div>
    );
}
