import React, { useState, useEffect } from "react";
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

    // Filter out team entries (those without chest numbers)
    const individualOnlyScores = individualScores.filter(student =>
        student.chestNo && student.chestNo !== '-'
    );

    const sortedScores = [...individualOnlyScores].sort((a, b) => {
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
        // First, find Kalaprathibha (most restrictive criteria)
        let kalaWinner = null;
        let kalaMax = -1;

        scores.forEach(student => {
            // Kalaprathibha: Must have 1st Place with A+ in Category "A"
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

        // Then find Sargaprathibha (highest points, but exclude Kalaprathibha winner)
        let sargaWinner = null;
        let sargaMax = -1;

        scores.forEach(student => {
            // Skip if this is the Kalaprathibha winner
            if (kalaWinner && student.key === kalaWinner.key) {
                return;
            }

            // Sargaprathibha: Highest points (excluding Kalaprathibha)
            if (student.total > sargaMax) {
                sargaMax = student.total;
                sargaWinner = student;
            }
        });

        return { sargaWinner, kalaWinner };
    };

    const champions = calculateChampions(individualOnlyScores);

    // TROPHY TIER LOGIC
    const getTrophyTier = (points) => {
        if (points >= 71 && points <= 84) return '⭐⭐⭐⭐⭐';
        if (points >= 56 && points <= 70) return '⭐⭐⭐⭐';
        if (points >= 39 && points <= 55) return '⭐⭐⭐';
        if (points >= 22 && points <= 38) return '⭐⭐';
        if (points >= 5 && points <= 21) return '⭐';
        return '-';
    };

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

            {/* DUPLICATE STUDENTS DETECTION */}
            {!loading && (() => {
                // Find students with same name but different chest numbers
                const nameMap = new Map();
                individualOnlyScores.forEach(student => {
                    const name = student.name.trim();
                    if (!name || name === "Unknown") return;

                    if (!nameMap.has(name)) {
                        nameMap.set(name, []);
                    }
                    nameMap.get(name).push(student);
                });

                // Filter only duplicates (same name, different chest numbers)
                const duplicates = Array.from(nameMap.entries())
                    .filter(([_, entries]) => {
                        if (entries.length <= 1) return false;
                        // Check if they have different chest numbers
                        const chestNumbers = new Set(entries.map(e => e.chestNo).filter(c => c !== "-"));
                        return chestNumbers.size > 1; // Multiple different chest numbers
                    })
                    .map(([name, entries]) => ({ name, entries }));

                if (duplicates.length === 0) return null;

                return (
                    <>
                        <h3 className="section-title" style={{ color: '#ff9800', marginTop: '30px' }}>
                            ⚠️ Duplicate Students in Scoring ({duplicates.length} names, {duplicates.reduce((sum, d) => sum + d.entries.length, 0)} total entries)
                        </h3>
                        <div className="card" style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', border: '1px solid #ff9800' }}>
                            <p style={{ color: '#ff9800', marginBottom: '15px', fontSize: '0.9rem' }}>
                                ⚠️ The following students appear multiple times with different chest numbers in the results. This may indicate duplicate entries or data errors.
                            </p>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Student Name</th>
                                            <th>Chest No</th>
                                            <th>Team</th>
                                            <th>🥇 1st</th>
                                            <th>🥈 2nd</th>
                                            <th>🥉 3rd</th>
                                            <th>Total Points</th>
                                            <th>Events Won</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {duplicates.map(({ name, entries }) => (
                                            <React.Fragment key={name}>
                                                {entries.map((entry, idx) => (
                                                    <tr key={entry.key} style={{
                                                        background: idx === 0 ? '#2a1a1a' : 'transparent',
                                                        borderTop: idx === 0 ? '2px solid #ff9800' : '1px solid #333'
                                                    }}>
                                                        <td style={{ fontWeight: idx === 0 ? 'bold' : 'normal', color: idx === 0 ? '#ff9800' : '#fff' }}>
                                                            {idx === 0 && '🔴 '}{name}
                                                        </td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{entry.chestNo}</td>
                                                        <td>{entry.team || "N/A"}</td>
                                                        <td>{entry.first}</td>
                                                        <td>{entry.second}</td>
                                                        <td>{entry.third}</td>
                                                        <td style={{ color: '#22c55e', fontWeight: '900' }}>{entry.total}</td>
                                                        <td style={{ fontSize: '0.85rem', color: '#888' }}>{entry.items.length} events</td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: '15px', padding: '10px', background: '#2a1a1a', borderRadius: '6px', fontSize: '0.85rem', color: '#ffd700' }}>
                                💡 <strong>Action Required:</strong> Review these entries in the Results management section. Verify the correct chest number for each student and remove duplicate entries.
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* TROPHY TIER STATISTICS */}
            {!loading && filteredScores.length > 0 && (() => {
                const tierCounts = {
                    '5star': filteredScores.filter(s => s.total >= 71 && s.total <= 84).length,
                    '4star': filteredScores.filter(s => s.total >= 56 && s.total <= 70).length,
                    '3star': filteredScores.filter(s => s.total >= 39 && s.total <= 55).length,
                    '2star': filteredScores.filter(s => s.total >= 22 && s.total <= 38).length,
                    '1star': filteredScores.filter(s => s.total >= 5 && s.total <= 21).length,
                    'none': filteredScores.filter(s => s.total < 5).length
                };

                return (
                    <div className="card" style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#ffd700', fontSize: '1.1rem' }}>🏆 Trophy Tier Distribution</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                            <div style={{ textAlign: 'center', padding: '15px', background: '#2a1a1a', borderRadius: '8px', border: '1px solid #444' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>⭐⭐⭐⭐⭐</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffd700' }}>{tierCounts['5star']}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>71-84 pts</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '15px', background: '#2a1a1a', borderRadius: '8px', border: '1px solid #444' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>⭐⭐⭐⭐</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{tierCounts['4star']}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>56-70 pts</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '15px', background: '#2a1a1a', borderRadius: '8px', border: '1px solid #444' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>⭐⭐⭐</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{tierCounts['3star']}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>39-55 pts</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '15px', background: '#2a1a1a', borderRadius: '8px', border: '1px solid #444' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>⭐⭐</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#a855f7' }}>{tierCounts['2star']}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>22-38 pts</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '15px', background: '#2a1a1a', borderRadius: '8px', border: '1px solid #444' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>⭐</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f97316' }}>{tierCounts['1star']}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>5-21 pts</div>
                            </div>
                            {tierCounts['none'] > 0 && (
                                <div style={{ textAlign: 'center', padding: '15px', background: '#2a1a1a', borderRadius: '8px', border: '1px solid #444' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>-</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#666' }}>{tierCounts['none']}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>{'<'} 5 pts</div>
                                </div>
                            )}
                        </div>
                        <div style={{ marginTop: '15px', padding: '10px', background: '#2a1a1a', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.9rem', color: '#888' }}>Total Students: </span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{filteredScores.length}</span>
                        </div>
                    </div>
                );
            })()}


            <h3 className="section-title">👤 Individual Standings</h3>

            <div className="table-controls" style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <input
                    type="text"
                    className="admin-input"
                    placeholder="🔍 Search by Name, Chest No, or Team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: '400px', flex: 1 }}
                />
                <button
                    onClick={() => {
                        // Prepare CSV data
                        const csvData = filteredScores.map((student, index) => ({
                            Rank: sortConfig.key === 'total' ? index + 1 : '-',
                            'Chest No': student.chestNo,
                            Name: student.name,
                            Team: student.team || 'N/A',
                            '1st Place': student.first,
                            '2nd Place': student.second,
                            '3rd Place': student.third,
                            'Total Points': student.total,
                            'Trophy Tier': getTrophyTier(student.total),
                            'Events Won': student.items.length
                        }));

                        // Convert to CSV string
                        const headers = Object.keys(csvData[0] || {});
                        const csvContent = [
                            headers.join(','),
                            ...csvData.map(row =>
                                headers.map(header => {
                                    const value = row[header];
                                    // Escape commas and quotes
                                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                                        return `"${value.replace(/"/g, '""')}"`;
                                    }
                                    return value;
                                }).join(',')
                            )
                        ].join('\n');

                        // Download
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `individual_points_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    className="admin-btn"
                    style={{
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        padding: '10px 20px',
                        whiteSpace: 'nowrap'
                    }}
                >
                    📥 Download CSV
                </button>
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
                                <th>🏆 Trophy</th>
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
                                            <td style={{ fontSize: '1.2rem' }}>{getTrophyTier(student.total)}</td>
                                        </tr>
                                        {expandedRow === student.key && (
                                            <tr key={`${student.key}-detail`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                <td colSpan="9" style={{ padding: '0 0 20px 0' }}>
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
