import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";

export default function ManageIndividualPoints() {
    const [individualScores, setIndividualScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'total', direction: 'desc' });
    const [expandedRow, setExpandedRow] = useState(null); // Track expanded student key

    const [expandedChampion, setExpandedChampion] = useState(null); // 'kala' or 'sarga' or null

    useEffect(() => {
        // Real-time listener for results
        const q = query(collection(db, "results"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const scores = {};

            snapshot.docs.forEach((doc) => {
                const data = doc.data();

                // Skip Team-based General entries (where chestNo might be missing or irrelevant)
                // If it's a pure General Event team entry, it usually lacks a chestNo or uses a Team name as Name.
                // We focus on students with Chest Numbers or specific Names.

                const chestNo = data.chestNo ? String(data.chestNo).trim() : null;
                const name = data.name ? data.name.trim() : "Unknown";
                const team = data.team || "";

                // Unique Key: ChestNo is best. If missing, use Name+Team.
                const key = chestNo || `${name}_${team}`;

                if (!scores[key]) {
                    scores[key] = {
                        key,
                        name: name,
                        chestNo: chestNo || "-",
                        team: team,
                        items: [],
                        first: 0,
                        second: 0,
                        third: 0,
                        total: 0
                    };
                }

                if (data.place === "First") scores[key].first += 1;
                else if (data.place === "Second") scores[key].second += 1;
                else if (data.place === "Third") scores[key].third += 1;

                const pts = Number(data.points) || 0;
                scores[key].total += pts;

                // Track events for tooltip/detail?
                if (pts > 0) {
                    scores[key].items.push(`${data.eventName} (${data.place})`);
                }

                // Store raw results for Championship Logic (Category Checks)
                if (!scores[key].rawResults) scores[key].rawResults = [];
                scores[key].rawResults.push(data);
            });

            const scoreArray = Object.values(scores);
            setIndividualScores(scoreArray);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // SORTING LOGIC
    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const handleRowClick = (key) => {
        if (expandedRow === key) {
            setExpandedRow(null);
        } else {
            setExpandedRow(key);
        }
    };

    const sortedScores = [...individualScores].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // CHAMPIONSHIP LOGIC
    const calculateChampions = (scores) => {
        let sargaWinner = null;
        let sargaMax = -1;

        let kalaWinner = null;
        let kalaMax = -1;

        scores.forEach(student => {
            // Sargaprathibha: Pure highest points
            if (student.total > sargaMax) {
                sargaMax = student.total;
                sargaWinner = student;
            } else if (student.total === sargaMax) {
                // Tie: Keep first found or handle array (Keep simple for now)
            }

            // Kalaprathibha: 
            // Condition 1: Must have 1st Place with A+ in Category "A"
            const isEligible = student.rawResults && student.rawResults.some(r =>
                (r.category === "A" || r.category === "a") &&
                r.place === "First" &&
                r.grade === "A+"
            );

            if (isEligible) {
                if (student.total > kalaMax) {
                    kalaMax = student.total;
                    kalaWinner = student;
                }
            }
        });

        return { sargaWinner, kalaWinner };
    };

    const champions = calculateChampions(individualScores);

    // FILTER LOGIC
    const filteredScores = sortedScores.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.chestNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.team.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="manage-individual">
            {/* CHAMPIONSHIP CARDS */}
            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>

                    {/* KALAPRATHIBHA */}
                    <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ffd700 0%, #ffb900 100%)', color: '#000', border: 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ width: '100%' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.8 }}>👑 Kalaprathibha</span>
                                {champions.kalaWinner ? (
                                    <>
                                        <h2 style={{ fontSize: '1.8rem', margin: '10px 0 5px 0', fontWeight: '900' }}>{champions.kalaWinner.name}</h2>
                                        <div style={{ fontSize: '1rem', fontWeight: '600' }}>Chest No: {champions.kalaWinner.chestNo}</div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                                            <div style={{ background: 'rgba(0,0,0,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600' }}>
                                                {champions.kalaWinner.team} • {champions.kalaWinner.total} Pts
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>🥇{champions.kalaWinner.first}</span>
                                                <span>🥈{champions.kalaWinner.second}</span>
                                                <span>🥉{champions.kalaWinner.third}</span>
                                            </div>
                                        </div>

                                        {/* Grades Summary */}
                                        <div style={{ marginTop: '8px', fontSize: '0.8rem', opacity: 0.9, marginBottom: '10px' }}>
                                            {(() => {
                                                const grades = {};
                                                champions.kalaWinner.rawResults?.forEach(r => { if (r.grade) grades[r.grade] = (grades[r.grade] || 0) + 1; });
                                                return Object.entries(grades).map(([g, c]) => <span key={g} style={{ marginRight: '8px' }}>{g}: <strong>{c}</strong></span>);
                                            })()}
                                        </div>

                                        <button
                                            onClick={() => setExpandedChampion(expandedChampion === 'kala' ? null : 'kala')}
                                            style={{ background: 'rgba(0,0,0,0.2)', color: '#000', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                        >
                                            {expandedChampion === 'kala' ? 'Hide Details' : 'View Full Details'}
                                        </button>

                                        {expandedChampion === 'kala' && (
                                            <div style={{ marginTop: '15px', background: 'rgba(255,255,255,0.9)', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', color: '#333' }}>
                                                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                            <th style={{ textAlign: 'left', padding: '4px' }}>Event</th>
                                                            <th style={{ padding: '4px' }}>Prize</th>
                                                            <th style={{ padding: '4px' }}>Grd</th>
                                                            <th style={{ padding: '4px' }}>Pts</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {champions.kalaWinner.rawResults.map((r, i) => (
                                                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                                                <td style={{ padding: '4px' }}>{r.eventName}</td>
                                                                <td style={{ padding: '4px', fontWeight: 'bold' }}>{r.place}</td>
                                                                <td style={{ padding: '4px' }}>{r.grade}</td>
                                                                <td style={{ padding: '4px' }}>{r.points}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <h3 style={{ marginTop: '15px', opacity: 0.6 }}>No Eligible Winner Yet</h3>
                                )}
                            </div>
                            <div style={{ fontSize: '3rem', opacity: 0.2 }}>🤴</div>
                        </div>
                    </div>

                    {/* SARGAPRATHIBHA */}
                    <div className="stat-card" style={{ background: 'linear-gradient(135deg, #e0e0e0 0%, #ffffff 100%)', color: '#000', border: 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ width: '100%' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.6 }}>🌟 Sargaprathibha</span>
                                {champions.sargaWinner ? (
                                    <>
                                        <h2 style={{ fontSize: '1.8rem', margin: '10px 0 5px 0', fontWeight: '900' }}>{champions.sargaWinner.name}</h2>
                                        <div style={{ fontSize: '1rem', fontWeight: '600' }}>Chest No: {champions.sargaWinner.chestNo}</div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                                            <div style={{ background: 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600' }}>
                                                {champions.sargaWinner.team} • {champions.sargaWinner.total} Pts
                                            </div>
                                            <div style={{ background: 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>🥇{champions.sargaWinner.first}</span>
                                                <span>🥈{champions.sargaWinner.second}</span>
                                                <span>🥉{champions.sargaWinner.third}</span>
                                            </div>
                                        </div>

                                        {/* Grades Summary */}
                                        <div style={{ marginTop: '8px', fontSize: '0.8rem', opacity: 0.8, marginBottom: '10px' }}>
                                            {(() => {
                                                const grades = {};
                                                champions.sargaWinner.rawResults?.forEach(r => { if (r.grade) grades[r.grade] = (grades[r.grade] || 0) + 1; });
                                                return Object.entries(grades).map(([g, c]) => <span key={g} style={{ marginRight: '8px' }}>{g}: <strong>{c}</strong></span>);
                                            })()}
                                        </div>

                                        <button
                                            onClick={() => setExpandedChampion(expandedChampion === 'sarga' ? null : 'sarga')}
                                            style={{ background: 'rgba(0,0,0,0.1)', color: '#000', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                        >
                                            {expandedChampion === 'sarga' ? 'Hide Details' : 'View Full Details'}
                                        </button>

                                        {expandedChampion === 'sarga' && (
                                            <div style={{ marginTop: '15px', background: 'rgba(255,255,255,0.9)', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', color: '#333' }}>
                                                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                            <th style={{ textAlign: 'left', padding: '4px' }}>Event</th>
                                                            <th style={{ padding: '4px' }}>Prize</th>
                                                            <th style={{ padding: '4px' }}>Grd</th>
                                                            <th style={{ padding: '4px' }}>Pts</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {champions.sargaWinner.rawResults.map((r, i) => (
                                                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                                                <td style={{ padding: '4px' }}>{r.eventName}</td>
                                                                <td style={{ padding: '4px', fontWeight: 'bold' }}>{r.place}</td>
                                                                <td style={{ padding: '4px' }}>{r.grade}</td>
                                                                <td style={{ padding: '4px' }}>{r.points}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <h3 style={{ marginTop: '15px', opacity: 0.5 }}>No Data Yet</h3>
                                )}
                            </div>
                            <div style={{ fontSize: '3rem', opacity: 0.2 }}>✨</div>
                        </div>
                    </div>

                </div>
            )}

            <h3 className="section-title">👤 Individual Standings</h3>

            <div className="table-controls" style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                <input
                    type="text"
                    className="admin-input"
                    placeholder="🔍 Search by Name, Chest No, or Team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: '400px' }}
                />
            </div>

            {loading ? <div className="spinner"></div> : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('total')} style={{ cursor: 'pointer' }}>
                                    Rank {sortConfig.key === 'total' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th onClick={() => handleSort('chestNo')} style={{ cursor: 'pointer' }}>
                                    Chest No {sortConfig.key === 'chestNo' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                                    Name {sortConfig.key === 'name' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th onClick={() => handleSort('team')} style={{ cursor: 'pointer' }}>
                                    Team {sortConfig.key === 'team' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                                <th>🥇 1st</th>
                                <th>🥈 2nd</th>
                                <th>🥉 3rd</th>
                                <th onClick={() => handleSort('total')} style={{ cursor: 'pointer' }}>
                                    Total Points {sortConfig.key === 'total' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredScores.length > 0 ? filteredScores.map((student, index) => {
                                // Calculate Rank based on current sort order (if sorting by total points)
                                let rankDisplay = index + 1;
                                if (sortConfig.key !== 'total') rankDisplay = '-';

                                return (
                                    <>
                                        <tr
                                            key={student.key}
                                            onClick={() => handleRowClick(student.key)}
                                            style={{
                                                background: rankDisplay === 1 ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                                                cursor: 'pointer',
                                                borderBottom: expandedRow === student.key ? 'none' : '1px solid #333'
                                            }}
                                            className="hover-row"
                                        >
                                            <td style={{ fontWeight: 'bold', color: rankDisplay <= 3 && rankDisplay > 0 ? '#ffd700' : '#888' }}>
                                                {rankDisplay > 0 ? `#${rankDisplay}` : '-'}
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{student.chestNo}</td>
                                            <td>
                                                <div style={{ fontWeight: '600' }}>{student.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                                    {expandedRow === student.key ? '▼ Hide Details' : `▶ Show ${student.items.length} Events`}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`tag ${student.team?.toLowerCase()}-tag`} style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: '#333',
                                                    color: '#ccc',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    {student.team || "N/A"}
                                                </span>
                                            </td>
                                            <td>{student.first}</td>
                                            <td>{student.second}</td>
                                            <td>{student.third}</td>
                                            <td style={{ color: '#22c55e', fontWeight: '900', fontSize: '1.2rem' }}>
                                                {student.total}
                                            </td>
                                        </tr>
                                        {expandedRow === student.key && (
                                            <tr key={`${student.key}-detail`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                <td colSpan="8" style={{ padding: '0 0 20px 0' }}>
                                                    <div style={{ padding: '15px', marginLeft: '50px', borderLeft: '2px solid #555' }}>
                                                        <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#aaa', fontSize: '0.9rem' }}>Detailed Results for {student.name}</h4>
                                                        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                            <thead>
                                                                <tr style={{ color: '#888', textAlign: 'left', borderBottom: '1px solid #444' }}>
                                                                    <th style={{ padding: '5px' }}>Event</th>
                                                                    <th style={{ padding: '5px' }}>Category</th>
                                                                    <th style={{ padding: '5px' }}>Prize</th>
                                                                    <th style={{ padding: '5px' }}>Grade</th>
                                                                    <th style={{ padding: '5px' }}>Points</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {student.rawResults && student.rawResults.map((res, idx) => (
                                                                    <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                                                                        <td style={{ padding: '8px 5px' }}>{res.eventName}</td>
                                                                        <td style={{ padding: '8px 5px' }}>{res.category || "-"}</td>
                                                                        <td style={{ padding: '8px 5px', color: res.place === 'First' ? '#ffd700' : res.place === 'Second' ? '#c0c0c0' : res.place === 'Third' ? '#cd7f32' : '#fff' }}>
                                                                            {res.place}
                                                                        </td>
                                                                        <td style={{ padding: '8px 5px', fontWeight: 'bold', color: res.grade?.startsWith('A') ? '#4ade80' : '#fff' }}>
                                                                            {res.grade}
                                                                        </td>
                                                                        <td style={{ padding: '8px 5px' }}>{res.points}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                                        No students found matching "{searchQuery}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
