import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import StandingsChart from "./StandingsChart";
import { getEventType } from "../constants/events";

export default function ManageTeams() {
    const [rawResults, setRawResults] = useState([]);
    const [eventsList, setEventsList] = useState([]);
    const [teamColors, setTeamColors] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategoryTab, setActiveCategoryTab] = useState("Overall");
    const [activeSubTab, setActiveSubTab] = useState("All");

    // Load dynamic student categories
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

    useEffect(() => {
        // Real-time listener for results
        const unsubscribe = onSnapshot(collection(db, "results"), (snapshot) => {
            setRawResults(snapshot.docs.map(doc => doc.data()));
            setLoading(false);
        });

        // Real-time listener for events to resolve dynamic types
        const unsubscribeEvents = onSnapshot(collection(db, "events"), (snapshot) => {
            setEventsList(snapshot.docs.map(doc => doc.data()));
        });

        // Real-time listener for team colors
        const unsubscribeTeams = onSnapshot(collection(db, "teams"), (snapshot) => {
            const colors = {};
            snapshot.docs.forEach(d => {
                const t = d.data();
                if (t.name && t.color) colors[t.name.toUpperCase()] = t.color;
            });
            setTeamColors(colors);
        });

        return () => { 
            unsubscribe(); 
            unsubscribeEvents();
            unsubscribeTeams(); 
        };
    }, []);

    const teamScores = useMemo(() => {
        // Build map of event name -> type
        const eventTypeMap = {};
        eventsList.forEach(ev => {
            if (ev.name) {
                eventTypeMap[ev.name.trim().toUpperCase()] = ev.type;
            }
        });

        const scores = {};

        rawResults.forEach((data) => {
            const team = data.team?.trim();
            const place = data.place;
            let studentCategory = data.studentCategory || "General";
            if (studentCategory === "Common/General" || studentCategory === "Common / General") {
                studentCategory = "General";
            }
            const evType = eventTypeMap[(data.eventName || "").trim().toUpperCase()] || getEventType(data.eventName) || "On Stage";

            if (!team) return;

            if (!scores[team]) {
                scores[team] = { 
                    name: team, 
                    first: 0, 
                    second: 0, 
                    third: 0, 
                    total: 0,
                    onStage: 0,
                    offStage: 0,
                    categories: {}
                };
            }

            if (!scores[team].categories[studentCategory]) {
                scores[team].categories[studentCategory] = { first: 0, second: 0, third: 0, total: 0, onStage: 0, offStage: 0 };
            }

            if (place === "First") {
                scores[team].first += 1;
                scores[team].categories[studentCategory].first += 1;
            } else if (place === "Second") {
                scores[team].second += 1;
                scores[team].categories[studentCategory].second += 1;
            } else if (place === "Third") {
                scores[team].third += 1;
                scores[team].categories[studentCategory].third += 1;
            }

            const pts = (Number(data.points) || 0);
            scores[team].total += pts;
            scores[team].categories[studentCategory].total += pts;
            if (evType === "On Stage") {
                scores[team].onStage += pts;
                scores[team].categories[studentCategory].onStage = (scores[team].categories[studentCategory].onStage || 0) + pts;
            } else {
                scores[team].offStage += pts;
                scores[team].categories[studentCategory].offStage = (scores[team].categories[studentCategory].offStage || 0) + pts;
            }
        });

        return Object.values(scores);
    }, [rawResults, eventsList]);

    const activeScores = teamScores.map(team => {
        let first, second, third, total;
        if (activeCategoryTab === "Overall") {
            first = team.first; second = team.second; third = team.third;
            if (activeSubTab === "All") total = team.total;
            else if (activeSubTab === "On Stage") total = team.onStage || 0;
            else total = team.offStage || 0;
        } else {
            const catData = team.categories[activeCategoryTab] || { first: 0, second: 0, third: 0, total: 0, onStage: 0, offStage: 0 };
            first = catData.first; second = catData.second; third = catData.third;
            if (activeSubTab === "All") total = catData.total || 0;
            else if (activeSubTab === "On Stage") total = catData.onStage || 0;
            else total = catData.offStage || 0;
        }
        return { name: team.name, first, second, third, total };
    }).sort((a, b) => b.total - a.total);

    const filteredTeams = activeScores.filter(team =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="manage-teams">
            <h3 className="section-title">🏆 Team Standings (Live)</h3>

            {/* Category tabs */}
            <div className="tab-container" style={{ display: 'flex', gap: '8px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                <button className="tab-btn" style={{ background: activeCategoryTab === "Overall" ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }} onClick={() => setActiveCategoryTab("Overall")}>🏆 Overall</button>
                {dynamicCategories.map(cat => (
                    <button key={cat} className="tab-btn" style={{ background: activeCategoryTab === cat ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }} onClick={() => setActiveCategoryTab(cat)}>👤 {cat}</button>
                ))}
                <button className="tab-btn" style={{ background: activeCategoryTab === "General" ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }} onClick={() => setActiveCategoryTab("General")}>🌐 General</button>
            </div>

            {/* Sub-tabs: On Stage / Off Stage */}
            <div className="tab-container" style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto' }}>
                {['All', 'On Stage', 'Off Stage'].map(sub => (
                    <button key={sub} className="tab-btn" style={{ background: activeSubTab === sub ? "var(--secondary, #e63946)" : "rgba(255,255,255,0.05)", color: "white", border: "1px solid var(--border-soft)", padding: "5px 12px", borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", fontSize: "0.8rem", fontWeight: 600, transition: "all 0.2s ease" }} onClick={() => setActiveSubTab(sub)}>
                        {sub === 'All' ? '📋 All' : sub === 'On Stage' ? '🎭 On Stage' : '📝 Off Stage'}
                    </button>
                ))}
            </div>

            {!loading && <StandingsChart scores={activeScores} activeCategory={activeCategoryTab} subCategory={activeSubTab} teamColors={teamColors} />}

            <div className="table-controls" style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                <input
                    type="text"
                    className="admin-input"
                    placeholder="🔍 Search for a team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: '400px' }}
                />
            </div>

            {loading ? <p>Calculating standings...</p> : (
                <div className="admin-table-container">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Team Name</th>
                                <th>🥇 1st</th>
                                <th>🥈 2nd</th>
                                <th>🥉 3rd</th>
                                <th>Total Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTeams.length > 0 ? filteredTeams.map((team) => {
                                // Find actual rank in compiled active scores list
                                const actualRank = activeScores.findIndex(t => t.name === team.name) + 1;
                                return (
                                    <tr
                                        key={team.name}
                                        style={{
                                            background: actualRank === 1 ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                                            borderLeft: actualRank === 1 ? '4px solid #ffd700' : 'none'
                                        }}
                                    >
                                        <td style={{ fontWeight: '900', color: actualRank === 1 ? '#ffd700' : 'var(--text-main)' }}>
                                            #{actualRank}
                                        </td>
                                        <td style={{ fontWeight: '700' }}>{team.name} {actualRank === 1 && "👑"}</td>
                                        <td>{team.first}</td>
                                        <td>{team.second}</td>
                                        <td>{team.third}</td>
                                        <td style={{ color: 'var(--primary)', fontWeight: '900', fontSize: '1.2rem' }}>
                                            {team.total}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                        {searchQuery ? "No teams matched your search." : "No results published yet for this category."}
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
