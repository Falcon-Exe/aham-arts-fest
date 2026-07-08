import { useState } from "react";
import { useMasterParticipants } from "../hooks/useMasterParticipants";
import "./Participants.css";

function Participants() {
  const { participants, loading } = useMasterParticipants();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");

  // Get unique events from all participants
  const allEvents = new Set();
  participants.forEach(p => {
    const onStage = (p["ON STAGE EVENTS"] || "").split(',').map(s => s.trim()).filter(Boolean);
    const offStage = (p["OFF STAGE EVENTS"] || "").split(',').map(s => s.trim()).filter(Boolean);
    const general = (p["GENERAL EVENTS"] || "").split(',').map(s => s.trim()).filter(Boolean);
    [...onStage, ...offStage, ...general].forEach(e => allEvents.add(e));
  });
  const sortedEvents = Array.from(allEvents).sort();

  const filteredParticipants = participants.filter((p) => {
    const q = search.toLowerCase();
    const textMatch = (
      (p["CANDIDATE NAME"] || "").toLowerCase().includes(q) ||
      (p["CIC NO"] || "").toLowerCase().includes(q) ||
      (p["CHEST NUMBER"] || "").toString().toLowerCase().includes(q) ||
      (p["TEAM"] || "").toLowerCase().includes(q) ||
      (p["ON STAGE EVENTS"] || "").toLowerCase().includes(q) ||
      (p["OFF STAGE EVENTS"] || "").toLowerCase().includes(q) ||
      (p["GENERAL EVENTS"] || "").toLowerCase().includes(q)
    );

    // Event filter
    let eventMatch = true;
    if (eventFilter) {
      const allStudentEvents = [
        ...(p["ON STAGE EVENTS"] || "").split(',').map(s => s.trim()),
        ...(p["OFF STAGE EVENTS"] || "").split(',').map(s => s.trim()),
        ...(p["GENERAL EVENTS"] || "").split(',').map(s => s.trim())
      ].filter(Boolean);
      eventMatch = allStudentEvents.some(e => e.toUpperCase() === eventFilter.toUpperCase());
    }

    return textMatch && eventMatch;
  });

  return (
    <div className="container participants-page">
      <header className="participants-header">
        <h2 className="participants-title">Festival Performers</h2>
        <div className="live-status">
          <span className="live-dot"></span>
          Ready to Shine
        </div>
      </header>

      <div className="dashboard-controls">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="participants-search"
            placeholder="Search by name, chest no, team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="search-wrapper" style={{ marginTop: '10px' }}>
          <select
            className="participants-search"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            style={{ cursor: 'pointer', paddingLeft: '16px' }}
          >
            <option value="">All Events ({participants.length} students)</option>
            {sortedEvents.map(event => {
              const count = participants.filter(p => {
                const allStudentEvents = [
                  ...(p["ON STAGE EVENTS"] || "").split(',').map(s => s.trim()),
                  ...(p["OFF STAGE EVENTS"] || "").split(',').map(s => s.trim()),
                  ...(p["GENERAL EVENTS"] || "").split(',').map(s => s.trim())
                ].filter(Boolean);
                return allStudentEvents.some(e => e.toUpperCase() === event.toUpperCase());
              }).length;
              return (
                <option key={event} value={event}>
                  {event} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto' }}></div>
          <p>Loading participants...</p>
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="empty-state">
          <p>No matching participants found.</p>
        </div>
      ) : (
        <div className="participants-grid stagger-reveal-grid">
          {filteredParticipants.map((p, i) => (
            <div key={i} className="results-card participant-card premium-glass-hover">
              <div className="participant-header">

                <div className="p-info">
                  <h3 className="p-name">{p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"]}</h3>
                  <div className="p-meta">
                    <span className="p-chest">#{p["CHEST NUMBER"] || p["CHEST NO"] || "TBA"}</span>
                    <span className={`p-team team-badge team-${(p["TEAM"] || p["TEAM NAME"])?.replace(/\s+/g, '-').toUpperCase()}`}>
                      {p["TEAM"] || p["TEAM NAME"]}
                    </span>
                    {p._source === "firestore" && (
                      <span className="source-badge new-registration">✨ New</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-details">
                <div className="p-detail-item">
                  <label>CIC Number</label>
                  <p>{p["CIC NO"] || p["CIC NUMBER"]}</p>
                </div>

                <div className="p-items-section">
                  <div className="p-item-group">
                    <label>🎭 On Stage Events</label>
                    <p>{p["ON STAGE EVENTS"] || "None"}</p>
                  </div>
                  <div className="p-item-group">
                    <label>📝 Off Stage Events</label>
                    <p>{p["OFF STAGE EVENTS"] || "None"}</p>
                  </div>
                  {p["GENERAL EVENTS"] && (
                    <div className="p-item-group">
                      <label>🌐 General Events</label>
                      <p>{p["GENERAL EVENTS"]}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Participants;
