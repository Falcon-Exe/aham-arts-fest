import { useState, useEffect } from "react";
import { useTeamScores } from "../hooks/useTeamScores";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; // Still needed for raw rows if we want detailed list, 
// BUT the current implementation fetches raw rows separately.
// Let's keep the raw rows fetch for the details, but use the hook for the headers.
// ACTUALLY, the hook returns aggregated scores. 
// Results page needs raw rows for the detailed list. 
// So we keep `rows` state but we can use `scores` for the leaderboard part.

// To avoid double fetching, we can leave Results.jsx as is for now OR 
// We can assume the hook defines the "Official" score.

// Let's just import the hook for the Champion/Scoreboard part to ensure consistency.

import Toast from '../components/Toast';
import StandingsChart from "../components/StandingsChart";
import "./Results.css";

function Results() {
  const [rows, setRows] = useState([]); // Raw results from DB
  const [search, setSearch] = useState("");
  const [activeTeam, setActiveTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const handleToastClose = () => {
    setToast(null);
  };

  // Use Hook for official scores
  const { scores: sortedTeamsData, champion: hookChampion, runnerUp: hookRunnerUp, showResultsPoints, teamColors } = useTeamScores();

  // Map Event Name -> Result Image URL
  const [eventPosters, setEventPosters] = useState({});

  // Request notification permissions
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Load results from Firestore (Raw data for list with real-time updates)
  useEffect(() => {
    let isFirstLoad = true;

    // Real-time listener for results
    const unsubscribeResults = onSnapshot(collection(db, "results"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRows(data);
      setLoading(false);

      if (!isFirstLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const newRes = change.doc.data();
            const title = `🏆 New Result Announced!`;
            const body = `${newRes.name} (${newRes.chestNo || "No Chest No"}) from Team ${newRes.team} won ${newRes.place === 'None' ? 'Grade Only' : newRes.place} for ${newRes.eventName}!`;
            
            setToast({ message: `${title} - ${body}`, type: "success" });

            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(title, { body, icon: "/pwa-192x192.png" });
              } catch (e) {
                console.error("Browser notification trigger failed:", e);
              }
            }
          }
        });
      }
      isFirstLoad = false;
    }, (error) => {
      console.error("Error loading real-time results:", error);
      setLoading(false);
    });

    // Also fetch events to get poster images
    const fetchEvents = async () => {
      try {
        const eventsSnap = await getDocs(collection(db, "events"));
        const posterMap = {};
        eventsSnap.docs.forEach(doc => {
          const ev = doc.data();
          if (ev.name && ev.resultImage) {
            posterMap[ev.name] = ev.resultImage;
          }
        });
        setEventPosters(posterMap);
      } catch (error) {
        console.error("Error loading events:", error);
      }
    };
    
    fetchEvents();

    return () => unsubscribeResults();
  }, []);

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

  const [activeCategoryTab, setActiveCategoryTab] = useState("Overall");
  const [activeSubTab, setActiveSubTab] = useState("All"); // All | On Stage | Off Stage

  const activeScoresData = sortedTeamsData.map(s => {
    let total;
    if (activeCategoryTab === "Overall") {
      if (activeSubTab === "All") total = s.total;
      else if (activeSubTab === "On Stage") total = s.onStage || 0;
      else total = s.offStage || 0;
    } else {
      const catObj = s.categories?.[activeCategoryTab];
      if (!catObj) { total = 0; }
      else if (activeSubTab === "All") total = catObj.total || 0;
      else if (activeSubTab === "On Stage") total = catObj.onStage || 0;
      else total = catObj.offStage || 0;
    }
    return { team: s.team, total };
  }).sort((a, b) => b.total - a.total);

  const champion = activeScoresData.length > 0 && activeScoresData[0].total > 0 ? [activeScoresData[0].team, activeScoresData[0].total] : null;
  const runnerUp = activeScoresData.length > 1 && activeScoresData[1].total > 0 ? [activeScoresData[1].team, activeScoresData[1].total] : null;

  /* ===============================
     GROUP BY EVENT
     =============================== */
  const grouped = {};
  rows.forEach((r) => {
    if (!r.eventName) return;
    // Category filter
    if (activeCategoryTab !== "Overall") {
      const rowCat = r.studentCategory || "General";
      if (rowCat !== activeCategoryTab) return;
    }
    // Sub-tab (stage type) filter
    if (activeSubTab !== "All") {
      const evType = r.type || "On Stage";
      if (evType !== activeSubTab) return;
    }
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

  // We need an array [teamName, points] for the filter bar to match existing map
  const sortedTeams = activeScoresData.map(s => [s.team, s.total]);


  const gradeClass = (g) => {
    if (!g) return "";
    const grade = g.toUpperCase();
    if (grade === "A+" || grade === "A") return "grade-a";
    if (grade === "B") return "grade-b";
    return "grade-c";
  };

  const formatName = (name) => {
    if (!name) return "";
    return name.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
  };

  if (loading) return <div className="container" style={{ textAlign: "center", marginTop: "40px" }}>Loading Results...</div>;

  return (
    <div className="container results-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
      <header className="results-header">
        <h2 className="results-title">Festival Dashboard</h2>
        <div className="live-status">
          <span className="live-dot"></span>
          Live Standings
        </div>
      </header>

      {/* Category tabs */}
      <div className="tab-container" style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button className="tab-btn" style={{ background: activeCategoryTab === "Overall" ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "9px 18px", borderRadius: "30px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: "600", transition: "all 0.2s ease" }} onClick={() => setActiveCategoryTab("Overall")}>
              🏆 Overall
          </button>
          {dynamicCategories.map(cat => (
              <button key={cat} className="tab-btn" style={{ background: activeCategoryTab === cat ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "9px 18px", borderRadius: "30px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: "600", transition: "all 0.2s ease" }} onClick={() => setActiveCategoryTab(cat)}>
                  👤 {cat}
              </button>
          ))}
          <button className="tab-btn" style={{ background: activeCategoryTab === "General" ? "var(--primary)" : "var(--surface)", color: "white", border: "1px solid var(--border-soft)", padding: "9px 18px", borderRadius: "30px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: "600", transition: "all 0.2s ease" }} onClick={() => setActiveCategoryTab("General")}>
              🌐 General
          </button>
      </div>

      {/* Sub-tabs: On Stage / Off Stage */}
      <div className="tab-container" style={{ display: 'flex', gap: '8px', marginBottom: '22px', overflowX: 'auto' }}>
          {['All', 'On Stage', 'Off Stage'].map(sub => (
              <button key={sub} className="tab-btn" style={{ background: activeSubTab === sub ? "var(--secondary, #e63946)" : "rgba(255,255,255,0.05)", color: "white", border: "1px solid var(--border-soft)", padding: "6px 14px", borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", fontSize: "0.82rem", fontWeight: "600", transition: "all 0.2s ease" }} onClick={() => setActiveSubTab(sub)}>
                  {sub === 'All' ? '📋 All Events' : sub === 'On Stage' ? '🎭 On Stage' : '📝 Off Stage'}
              </button>
          ))}
      </div>

      {showResultsPoints && (
        <StandingsChart
            scores={activeScoresData.map(s => ({ name: s.team, total: s.total }))}
            activeCategory={activeCategoryTab}
            subCategory={activeSubTab}
            teamColors={teamColors}
        />
      )}

      {/* HERO SECTION: CHAMPIONSHIP PROGRESS */}
      {showResultsPoints && champion && (
        <section className={`hero-section team-${champion[0].replace(/\s+/g, '-').toUpperCase()} stagger-reveal-badge`}>
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
              <div className={`hero-runner team-${runnerUp[0].replace(/\s+/g, '-').toUpperCase()}`}>
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

        {/* TEAM QUICK-FILTER (Visible only if Points are enabled) */}
        {showResultsPoints && (
          <div className="team-filter-bar">
            {sortedTeams.map(([team, pts]) => (
              <button
                key={team}
                className={`team-pill team-${team.replace(/\s+/g, '-').toUpperCase()} ${activeTeam === team ? "active" : ""}`}
                onClick={() => setActiveTeam(activeTeam === team ? null : team)}
              >
                <span className="pill-name">{team}</span>
                <span className="pill-pts">{pts}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RESULTS GRID */}
      {filteredEvents.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--muted)", marginTop: "20px" }}>No results found.</p>
      ) : (
        <div className="results-grid stagger-reveal-grid">
          {filteredEvents.map(([event, list]) => (
            <div key={event} className="results-card premium-glass-hover">
              <div className="result-card-header">
                <h3 className="results-event">{event}</h3>

                {eventPosters[event] && (
                  <a
                    href={eventPosters[event].replace('/upload/', '/upload/fl_attachment/')}
                    className="download-poster-btn"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  </a>
                )}

              </div>

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
                      <div key={i} className={`winner-box prize-${prize.toLowerCase()} team-${w.team.replace(/\s+/g, '-').toUpperCase()}`}>
                        <div style={{ flex: 1 }}>
                          <div className="winner-name">{formatName(w.name)}</div>
                          <div className="winner-meta">
                            {w.chestNo && <span className="winner-chest">{w.chestNo}</span>}
                            <span className={`winner-team team-${w.team.replace(/\s+/g, '-').toUpperCase()}`}>{w.team}</span>
                            {w.grade && <span className={`winner-grade ${gradeClass(w.grade)}`}>{w.grade}</span>}
                          </div>
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
    </div>
  );
}

export default Results;
