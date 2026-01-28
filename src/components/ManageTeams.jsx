import { useState, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";

export default function ManageTeams() {
    const [teamScores, setTeamScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        // Real-time listener for results
        const q = query(collection(db, "results"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const scores = {};

            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                const team = data.team?.trim();
                const place = data.place;

                if (!team) return;

                if (!scores[team]) {
                    scores[team] = { name: team, first: 0, second: 0, third: 0, total: 0 };
                }

                if (place === "First") {
                    scores[team].first += 1;
                } else if (place === "Second") {
                    scores[team].second += 1;
                } else if (place === "Third") {
                    scores[team].third += 1;
                }

                // Add calculated points (or 0 if missing)
                scores[team].total += (Number(data.points) || 0);
            });

            // Convert to array and sort by total points
            const sortedScores = Object.values(scores).sort((a, b) => b.total - a.total);
            setTeamScores(sortedScores);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredTeams = teamScores.filter(team =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="manage-teams">
            <h3 className="section-title">🏆 Team Standings (Live)</h3>

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
                                // Find actual rank in original list
                                const actualRank = teamScores.findIndex(t => t.name === team.name) + 1;
                                return (
                                    <tr
                                        key={team.name}
                                        style={{
                                            background: actualRank === 1 ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                                            borderLeft: actualRank === 1 ? '4px solid #ffd700' : 'none'
                                        }}
                                    >
                                        <td style={{ fontWeight: '900', color: actualRank === 1 ? '#ffd700' : '#fff' }}>
                                            #{actualRank}
                                        </td>
                                        <td style={{ fontWeight: '700' }}>{team.name} {actualRank === 1 && "👑"}</td>
                                        <td>{team.first}</td>
                                        <td>{team.second}</td>
                                        <td>{team.third}</td>
                                        <td style={{ color: '#e63946', fontWeight: '900', fontSize: '1.2rem' }}>
                                            {team.total}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                        {searchQuery ? "No teams matched your search." : "No results published yet."}
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
