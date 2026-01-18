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

  const filteredEvents = Object.entries(grouped).filter(([eventName, list]) => {
    const q = search.toLowerCase();

    // Check if event name matches
    const matchesEvent = eventName.toLowerCase().includes(q);

    // Check if any student name or chest number in this event matches
    const matchesStudent = list.some(r =>
      r.name?.toLowerCase().includes(q) ||
      r.chestNo?.toLowerCase().includes(q)
    );

    if (!matchesEvent && !matchesStudent) return false;

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
  const runnerUp = sortedTeams[1];

  const gradeClass = (g) => {
    if (!g) return "";
    const grade = g.toUpperCase();
    if (grade === "A+" || grade === "A") return "grade-a";
    if (grade === "B") return "grade-b";
    return "grade-c";
  };

  const handleShare = async (winner, event) => {
    const shareData = {
      title: 'AHAM Arts Fest Result 🏆',
      text: `🎉 Amazing news! ${winner.name} secured ${winner.place} Place in ${event} at AHAM Arts Fest! 🥇✨`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(shareData.text);
        alert("Result info copied to clipboard! 📋");
      }
    } catch (err) {
      console.log('Share failed:', err);
    }
  };

  const formatName = (name) => {
    if (!name) return "";
    return name.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
  };

  if (loading) return <div className="container" style={{ textAlign: "center", marginTop: "40px" }}>Loading Results...</div>;

  return (
    <div className="container results-page">
      <header className="results-header">
        <h2 className="results-title">Festival Dashboard</h2>
        <div className="live-status">
          <span className="live-dot"></span>
          Live Standings
        </div>
      </header>

      {/* HERO SECTION: CHAMPIONSHIP PROGRESS */}
      {champion && (
        <section className={`hero-section team-${champion[0]}`}>
          <div className="hero-grid">
            <div className="hero-main">
              <div className="hero-label">Festival Leader</div>
              <h1 className="hero-team-name">{champion[0]}</h1>
              <div className="hero-stats">
                <span className="hero-points">{champion[1]}</span>
                <span className="hero-unit">Total Points</span>
              </div>
              <div className="hero-badges">
                <span className="premium-badge">🎨 Leading the Fest</span>
                <span className="premium-badge">✨ Shining Bright</span>
              </div>
            </div>

            {runnerUp && (
              <div className={`hero-runner team-${runnerUp[0]}`}>
                <div className="runner-label">Festival Runner</div>
                <h2 className="runner-team-name">{runnerUp[0]}</h2>
                <div className="runner-stats">
                  <span className="runner-points">{runnerUp[1]}</span>
                  <span className="runner-unit">Total Points</span>
                </div>
              </div>
            )}
          </div>
          <div className="hero-visual">
            <div className="glow-circle"></div>
          </div>
        </section>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="dashboard-controls">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            className="results-search"
            placeholder="Find student, chest no, or event..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* TEAM QUICK-FILTER */}
        <div className="team-filter-bar">
          {sortedTeams.map(([team, pts]) => (
            <button
              key={team}
              className={`team-pill team-${team} ${activeTeam === team ? "active" : ""}`}
              onClick={() => setActiveTeam(activeTeam === team ? null : team)}
            >
              <span className="pill-name">{team}</span>
              <span className="pill-pts">{pts}</span>
            </button>
          ))}
        </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <strong>
                        {prize === "First" && "🥇"}
                        {prize === "Second" && "🥈"}
                        {prize === "Third" && "🥉"} {prize}
                      </strong>
                    </div>
                    {winners.map((w, i) => (
                      <div key={i} className={`winner-box prize-${prize.toLowerCase()} team-${w.team}`}>
                        <div style={{ flex: 1 }}>
                          <div className="winner-name">{formatName(w.name)}</div>
                          <div className="winner-meta">
                            {w.chestNo && <span className="winner-chest">{w.chestNo}</span>}
                            <span className={`winner-team team-${w.team}`}>{w.team}</span>
                            {w.grade && <span className={`winner-grade ${gradeClass(w.grade)}`}>{w.grade}</span>}
                          </div>
                        </div>
                        <button
                          className="share-btn-mini"
                          onClick={() => handleShare(w, event)}
                          title="Share Result"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                            <polyline points="16 6 12 2 8 6"></polyline>
                            <line x1="12" y1="2" x2="12" y2="15"></line>
                          </svg>
                        </button>
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
