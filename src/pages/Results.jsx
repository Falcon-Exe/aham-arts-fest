import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // Ensure firebase is initialized
import "./Results.css";

function Results() {
  const [rows, setRows] = useState([]); // Raw results from DB
  const [search, setSearch] = useState("");
  const [activeTeam, setActiveTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load results from Firestore
  useEffect(() => {
    const fetchResults = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "results"));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRows(data);
      } catch (error) {
        console.error("Error loading results:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  /* ===============================
     GROUP BY EVENT
     =============================== */
  const grouped = {};
  rows.forEach((r) => {
    if (!r.eventName) return;
    if (!grouped[r.eventName]) grouped[r.eventName] = [];
    grouped[r.eventName].push(r);
  });

  const filteredEvents = Object.entries(grouped).filter(([event, list]) => {
    const matchesSearch = event.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTeam) {
      return list.some((r) => r.team === activeTeam);
    }
    return true;
  });

  /* ===============================
     TEAM POINTS
     =============================== */
  const teamPoints = {};
  rows.forEach((r) => {
    const add = (team, pts) => {
      if (!team) return;
      teamPoints[team] = (teamPoints[team] || 0) + pts;
    };
    // Normalize team name to handle case sensitivity if needed, but assuming input is consistent for now or handled by admin
    const team = r.team;
    if (r.place === "First") add(team, 5);
    if (r.place === "Second") add(team, 3);
    if (r.place === "Third") add(team, 1);
  });

  const sortedTeams = Object.entries(teamPoints).sort((a, b) => b[1] - a[1]);
  const champion = sortedTeams[0];

  const gradeClass = (g) => {
    if (!g) return "";
    const grade = g.toUpperCase();
    if (grade === "A+" || grade === "A") return "grade-a";
    if (grade === "B") return "grade-b";
    return "grade-c";
  };

  if (loading) return <div className="container" style={{ textAlign: "center", marginTop: "40px" }}>Loading Results...</div>;

  return (
    <div className="container results-page">
      <h2 className="results-title">Results 🏆</h2>

      {/* CHAMPION */}
      {champion && (
        <div className="champion-banner">
          🏆 Overall Standing:
          <strong> {champion[0]}</strong>
          <span className="champion-points">({champion[1]} pts)</span>
        </div>
      )}

      {/* CONTROLS */}
      <div className="results-controls">
        <input
          className="results-search"
          placeholder="Search by event..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TEAM LEADERBOARD */}
      <div className="team-summary">
        {sortedTeams.map(([team, pts]) => (
          <button
            key={team}
            className={`team-card team-btn ${activeTeam === team ? "active" : ""}`}
            onClick={() => setActiveTeam(activeTeam === team ? null : team)}
          >
            <h4>{team}</h4>
            <p>{pts} pts</p>
          </button>
        ))}
      </div>

      {/* RESULTS GRID */}
      {filteredEvents.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--muted)", marginTop: "20px" }}>No results found.</p>
      ) : (
        <div className="results-grid">
          {filteredEvents.map(([event, list]) => (
            <div key={event} className="results-card">
              <h3 className="results-event">{event}</h3>

              {["First", "Second", "Third"].map((prize) => {
                const winners = list.filter((r) => r.place === prize);
                if (winners.length === 0) return null;

                return (
                  <div key={prize} className="results-position">
                    <strong>
                      {prize === "First" && "🥇"}
                      {prize === "Second" && "🥈"}
                      {prize === "Third" && "🥉"} {prize}
                    </strong>
                    {winners.map((w, i) => (
                      <div key={i} className={`winner-box prize-${prize.toLowerCase()}`}>
                        <div className="winner-name">{w.name}</div>
                        <div className="winner-meta">
                          {w.chestNo && <span className="winner-chest">{w.chestNo}</span>}
                          <span className={`winner-team team-${w.team}`}>{w.team}</span>
                          {w.grade && <span className={`winner-grade ${gradeClass(w.grade)}`}>{w.grade}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Results;
