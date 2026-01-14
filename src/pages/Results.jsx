import { useState, useEffect } from "react";
import Papa from "papaparse";
import "./Results.css";

function Results() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTeam, setActiveTeam] = useState(null);


  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTMLt3l_xtUOyT-YkXSTWhbWXbfXyF7vAIeHP3Nu0x0japM8OuAeA6_ZmHZTmZhouQq61_EOmFFQJ8Z/pub?gid=1350478884&single=true&output=csv";

  /* ===============================
     LOAD RESULTS (AUTO REFRESH)
     =============================== */
  const loadResults = () => {
    setLoading(true);

    fetch(CSV_URL + "&t=" + Date.now())
      .then((res) => res.text())
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (data) => {
            const published = data.data.filter(
              (r) => r.Published?.trim().toUpperCase() === "YES"
            );

            setRows(published);
            setLastUpdated(new Date());
            localStorage.setItem(
              "aham_results_cache",
              JSON.stringify(published)
            );
            setLoading(false);
          },
        });
      })
      .catch(() => {
        const cached = localStorage.getItem("aham_results_cache");
        if (cached) setRows(JSON.parse(cached));
        setLoading(false);
      });
  };

  useEffect(() => {
    loadResults();
    const interval = setInterval(loadResults, 30000); // 30 sec
    return () => clearInterval(interval);
  }, []);

  /* ===============================
     GROUP BY EVENT
     =============================== */
  const grouped = {};
  rows.forEach((r) => {
    if (!r.Event) return;
    if (!grouped[r.Event]) grouped[r.Event] = [];
    grouped[r.Event].push(r);
  });

  const filteredEvents = Object.entries(grouped).filter(([event]) =>
    event.toLowerCase().includes(search.toLowerCase())
  );

  /* ===============================
     TEAM POINTS
     =============================== */
  const teamPoints = {};
  rows.forEach((r) => {
    const add = (team, pts) => {
      if (!team) return;
      teamPoints[team] = (teamPoints[team] || 0) + pts;
    };

    if (r.Prize?.toLowerCase() === "first") add(r.Team, 5);
    if (r.Prize?.toLowerCase() === "second") add(r.Team, 3);
    if (r.Prize?.toLowerCase() === "third") add(r.Team, 1);
  });

  const sortedTeams = Object.entries(teamPoints).sort(
    (a, b) => b[1] - a[1]
  );
  const champion = sortedTeams[0];

  const gradeClass = (g) => {
    if (g === "A+" || g === "A") return "grade-a";
    if (g === "B") return "grade-b";
    if (g === "C") return "grade-c";
    return "";
  };

  /* ===============================
     EMPTY STATE
     =============================== */
  if (rows.length === 0 && !loading) {
    return (
      <div className="container results-page">
        <h2 className="results-title">Results 🏆</h2>
        <p className="results-message">
          Results are not published yet.
        </p>
      </div>
    );
  }

  return (
    <div className="container results-page">
      <h2 className="results-title">Results 🏆</h2>

      {/* CHAMPION */}
      {champion && (
        <div className="champion-banner">
          🏆 Overall Standing:
          <strong> {champion[0]}</strong>
          <span className="champion-points">
            ({champion[1]} pts)
          </span>
        </div>
      )}

      {/* LIVE STATUS */}
      <div className="results-status">
        <span className="live-dot"></span>
        LIVE
        {lastUpdated && (
          <span className="updated-time">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* SEARCH + REFRESH */}
      <div className="results-controls">
        <input
          className="results-search"
          placeholder="Search by event..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button className="primary-btn" onClick={loadResults}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* TEAM LEADERBOARD */}
<div className="team-summary">
  {sortedTeams.map(([team, pts]) => (
    <button
      key={team}
      className={`team-card team-btn ${
        activeTeam === team ? "active" : ""
      }`}
      onClick={() =>
        setActiveTeam(activeTeam === team ? null : team)
      }
    >
      <h4>{team}</h4>
      <p>{pts} pts</p>
      <span className="team-action">
        {activeTeam === team ? "View All" : "View Results"}
      </span>
    </button>
  ))}
</div>


      {/* RESULTS GRID */}
      <div className="results-grid">
        {filteredEvents.map(([event, list]) => (
          <div key={event} className="results-card">
            <h3 className="results-event">{event}</h3>

            {["First", "Second", "Third"].map((prize) => {
              const winners = list.filter(
                (r) =>
                  r.Prize?.trim().toLowerCase() ===
                  prize.toLowerCase()
              );

              if (winners.length === 0) return null;

              return (
                <div key={prize} className="results-position">
                  <strong>
                    {prize === "First" && "🥇"}
                    {prize === "Second" && "🥈"}
                    {prize === "Third" && "🥉"}{" "}
                    {prize}
                  </strong>
                  {winners.map((w, i) => (
                    <div
                      key={i}
                      className={`winner-box prize-${prize.toLowerCase()}`}
                    >
                      <div className="winner-name">{w.Name}</div>

                      <div className="winner-meta">
                        <span className="winner-chest">{w["Chest No"]}</span>
                        <span className={`winner-team team-${w.Team}`}>
                    {w.Team}
                  </span>
                        <span className={`winner-grade ${gradeClass(w.Grade)}`}>
                          {w.Grade}
                        </span>
                      </div>
                    </div>
                  ))}


                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Results;
