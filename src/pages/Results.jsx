import { useState, useEffect } from "react";
import { useTeamScores } from "../hooks/useTeamScores";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getEventType, resolveClassCategory } from "../constants/events";
import AnimatedCounter from "../components/AnimatedCounter";

import { useMasterParticipants } from "../hooks/useMasterParticipants";
import Toast from '../components/Toast';
import "./Results.css";

const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
};

function Results() {
  const [rows, setRows] = useState([]); // Raw results from DB
  const [search, setSearch] = useState("");
  const [activeTeam, setActiveTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState({});

  const toggleEventExpand = (key) => {
    setExpandedEvents(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleToastClose = () => {
    setToast(null);
  };

  // Use Hook for official scores
  const { scores: sortedTeamsData, champion: hookChampion, runnerUp: hookRunnerUp, showResultsPoints, teamColors } = useTeamScores();
  const { participants: masterParticipants } = useMasterParticipants();

  const [eventPosters, setEventPosters] = useState({});
  const [eventTypes, setEventTypes] = useState({});
  const [eventGeneralSubtypes, setEventGeneralSubtypes] = useState({});

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

    // Also fetch events to get poster images and dynamic types
    const fetchEvents = async () => {
      try {
        const eventsSnap = await getDocs(collection(db, "events"));
        const posterMap = {};
        const typeMap = {};
        const subtypeMap = {};
        eventsSnap.docs.forEach(doc => {
          const ev = doc.data();
          if (ev.name) {
            if (ev.resultImage) {
              posterMap[ev.name] = ev.resultImage;
            }
            if (ev.type) {
              typeMap[ev.name.trim().toUpperCase()] = ev.type;
            }
            if (ev.type === "General" && ev.generalSubtype) {
              subtypeMap[ev.name.trim().toUpperCase()] = ev.generalSubtype;
            }
          }
        });
        setEventPosters(posterMap);
        setEventTypes(typeMap);
        setEventGeneralSubtypes(subtypeMap);
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
    let total = 0;
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

  const firstPlace = activeScoresData.length > 0 && activeScoresData[0].total > 0 ? activeScoresData[0] : null;
  const secondPlace = activeScoresData.length > 1 && activeScoresData[1].total > 0 ? activeScoresData[1] : null;
  const thirdPlace = activeScoresData.length > 2 && activeScoresData[2].total > 0 ? activeScoresData[2] : null;

  const isDev = import.meta.env.DEV;
  const shouldShowPoints = showResultsPoints || isDev;

  /* ===============================
     GROUP BY EVENT & CATEGORY
     =============================== */
  const grouped = {};
  rows.forEach((r) => {
    if (!r.eventName) return;

    let studentClass = r.studentClass || r.class || "";
    let studentCat = r.studentCategory;

    // Cross-reference candidate list if category/class is missing or generic
    if (!studentClass || !studentCat || studentCat === "Junior & Senior" || studentCat === "Junior/Senior") {
      const candidateMatch = masterParticipants.find(p =>
        (r.chestNo && String(p["CHEST NUMBER"] || p["CHEST NO"]).trim() === String(r.chestNo).trim()) ||
        (r.name && (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"])?.trim().toUpperCase() === r.name.trim().toUpperCase())
      );
      if (candidateMatch) {
        if (!studentClass) studentClass = candidateMatch["CLASS"] || "";
        if (!studentCat || studentCat === "Junior & Senior" || studentCat === "Junior/Senior") {
          studentCat = candidateMatch["CATEGORY"] || "";
        }
      }
    }

    let rowCat = resolveClassCategory(studentClass, studentCat);

    // Category filter
    if (activeCategoryTab !== "Overall") {
      if (rowCat !== activeCategoryTab) return;
    }
    // Sub-tab (stage type) filter
    if (activeSubTab !== "All") {
      const normalizedName = (r.eventName || "").trim().toUpperCase();
      const rawType = eventTypes[normalizedName] || getEventType(r.eventName) || "Off Stage";
      // General events use their generalSubtype (e.g. "Off Stage") for sub-tab filtering
      const generalSubtype = eventGeneralSubtypes?.[normalizedName];
      const resolvedType = (rawType === "General" && generalSubtype) ? generalSubtype : rawType;
      if (resolvedType !== activeSubTab) return;
    }

    const groupKey = `${r.eventName}|||${rowCat}`;
    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        key: groupKey,
        eventName: r.eventName,
        studentCategory: rowCat,
        list: []
      };
    }
    grouped[groupKey].list.push(r);
  });

  const filteredEvents = Object.values(grouped).filter((groupObj) => {
    const { eventName, studentCategory, list } = groupObj;
    const q = search.toLowerCase();

    // Check if event name or student category matches
    const matchesEvent = eventName.toLowerCase().includes(q) || (studentCategory && studentCategory.toLowerCase().includes(q));

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

      {/* 3D STANDINGS PODIUM */}
      {shouldShowPoints && firstPlace && (
        <section className="podium-section stagger-reveal-badge">
          <h3 style={{ textAlign: 'center', marginBottom: '25px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.9rem' }}>🏆 Championship Podium</h3>
          <div className="podium-container">
            {/* 2nd Place */}
            {secondPlace && (
              <div
                className={`podium-step podium-second interactive-step ${activeTeam === secondPlace.team ? 'active-step' : ''}`}
                onClick={() => setActiveTeam(activeTeam === secondPlace.team ? null : secondPlace.team)}
                title={activeTeam === secondPlace.team ? "Clear filter" : `Filter results by ${secondPlace.team}`}
                style={{ '--team-color': teamColors[secondPlace.team] || '#a78bfa' }}
              >
                <div className="podium-team-color-glow"></div>
                <div className="podium-avatar">🥈</div>
                <div className="podium-team-name">{secondPlace.team}</div>
                <div className="podium-pts"><AnimatedCounter value={secondPlace.total} /> pts</div>
                <div className="podium-block" style={{
                  height: '80px',
                  background: `linear-gradient(180deg, ${hexToRgba(teamColors[secondPlace.team] || '#a78bfa', 0.25)}, ${hexToRgba(teamColors[secondPlace.team] || '#a78bfa', 0.03)})`,
                  borderColor: hexToRgba(teamColors[secondPlace.team] || '#a78bfa', 0.3),
                  boxShadow: `0 8px 24px ${hexToRgba(teamColors[secondPlace.team] || '#a78bfa', 0.15)}, inset 0 1px 0 rgba(255,255,255,0.1)`
                }}>
                  <span className="podium-number" style={{ color: hexToRgba(teamColors[secondPlace.team] || '#a78bfa', 0.15) }}>2</span>
                </div>
              </div>
            )}

            {/* 1st Place */}
            <div
              className={`podium-step podium-first interactive-step ${activeTeam === firstPlace.team ? 'active-step' : ''}`}
              onClick={() => setActiveTeam(activeTeam === firstPlace.team ? null : firstPlace.team)}
              title={activeTeam === firstPlace.team ? "Clear filter" : `Filter results by ${firstPlace.team}`}
              style={{ '--team-color': teamColors[firstPlace.team] || '#e63946' }}
            >
              <div className="podium-team-color-glow"></div>
              <div className="podium-crown">👑</div>
              <div className="podium-avatar">🥇</div>
              <div className="podium-team-name">{firstPlace.team}</div>
              <div className="podium-pts"><AnimatedCounter value={firstPlace.total} /> pts</div>
              <div className="podium-block" style={{
                height: '120px',
                background: `linear-gradient(180deg, ${hexToRgba(teamColors[firstPlace.team] || '#e63946', 0.35)}, ${hexToRgba(teamColors[firstPlace.team] || '#e63946', 0.05)})`,
                borderColor: hexToRgba(teamColors[firstPlace.team] || '#e63946', 0.4),
                boxShadow: `0 12px 32px ${hexToRgba(teamColors[firstPlace.team] || '#e63946', 0.25)}, inset 0 1px 0 rgba(255,255,255,0.2)`
              }}>
                <span className="podium-number" style={{ color: hexToRgba(teamColors[firstPlace.team] || '#e63946', 0.2) }}>1</span>
              </div>
            </div>

            {/* 3rd Place */}
            {thirdPlace && (
              <div
                className={`podium-step podium-third interactive-step ${activeTeam === thirdPlace.team ? 'active-step' : ''}`}
                onClick={() => setActiveTeam(activeTeam === thirdPlace.team ? null : thirdPlace.team)}
                title={activeTeam === thirdPlace.team ? "Clear filter" : `Filter results by ${thirdPlace.team}`}
                style={{ '--team-color': teamColors[thirdPlace.team] || '#34d399' }}
              >
                <div className="podium-team-color-glow"></div>
                <div className="podium-avatar">🥉</div>
                <div className="podium-team-name">{thirdPlace.team}</div>
                <div className="podium-pts"><AnimatedCounter value={thirdPlace.total} /> pts</div>
                <div className="podium-block" style={{
                  height: '60px',
                  background: `linear-gradient(180deg, ${hexToRgba(teamColors[thirdPlace.team] || '#34d399', 0.2)}, ${hexToRgba(teamColors[thirdPlace.team] || '#34d399', 0.02)})`,
                  borderColor: hexToRgba(teamColors[thirdPlace.team] || '#34d399', 0.25),
                  boxShadow: `0 6px 20px ${hexToRgba(teamColors[thirdPlace.team] || '#34d399', 0.1)}, inset 0 1px 0 rgba(255,255,255,0.08)`
                }}>
                  <span className="podium-number" style={{ color: hexToRgba(teamColors[thirdPlace.team] || '#34d399', 0.12) }}>3</span>
                </div>
              </div>
            )}
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
        {shouldShowPoints && (
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
        <div className="empty-results-card">
          <div className="empty-icon">🔍</div>
          <h4>No Results Found</h4>
          <p>We couldn't find any results matching your search query or filters.</p>
          <button className="reset-filters-btn" onClick={() => { setSearch(""); setActiveTeam(null); setActiveCategoryTab("Overall"); setActiveSubTab("All"); }}>
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="results-grid stagger-reveal-grid">
          {filteredEvents.map(({ key, eventName, studentCategory, list }) => (
            <div key={key} className="results-card premium-glass-hover">
              <div className="result-card-header">
                <div>
                  <h3 className="results-event">{eventName}</h3>
                  {studentCategory && (
                    <span className={`result-category-badge category-${studentCategory.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                      🏷️ {studentCategory}
                    </span>
                  )}
                </div>

                {eventPosters[eventName] && (
                  <a
                    href={eventPosters[eventName].replace('/upload/', '/upload/fl_attachment/')}
                    className="download-poster-btn"
                    title="Download Result Poster"
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

              {/* NON-PLACE / GRADE-ONLY PERFORMERS (COLLAPSIBLE) */}
              {(() => {
                const nonPlaceStudents = list.filter(
                  (r) => !["First", "Second", "Third"].includes(r.place)
                );
                if (nonPlaceStudents.length === 0) return null;

                const isExpanded = expandedEvents[key] || search.trim() !== "";

                return (
                  <div className="results-position non-place-position" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-soft)' }}>
                    <button
                      type="button"
                      onClick={() => toggleEventExpand(key)}
                      className="toggle-non-place-btn"
                      style={{
                        width: '100%',
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-soft)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>🎖️ Grade Only Performers ({nonPlaceStudents.length})</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '700' }}>
                        {isExpanded ? '▲ Hide' : '▼ View All'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="non-place-list" style={{ marginTop: '10px' }}>
                        {nonPlaceStudents.map((w, i) => (
                          <div key={i} className={`winner-box prize-none team-${w.team.replace(/\s+/g, '-').toUpperCase()}`}>
                            <div style={{ flex: 1 }}>
                              <div className="winner-name">{formatName(w.name)}</div>
                              <div className="winner-meta">
                                {w.chestNo && <span className="winner-chest">{w.chestNo}</span>}
                                <span className={`winner-team team-${w.team.replace(/\s+/g, '-').toUpperCase()}`}>{w.team}</span>
                                {w.grade ? (
                                  <span className={`winner-grade ${gradeClass(w.grade)}`}>{w.grade}</span>
                                ) : (
                                  <span className="winner-grade grade-c">Participant</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={handleToastClose} />}
    </div>
  );
}

export default Results;
