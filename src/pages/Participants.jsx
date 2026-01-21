import { useState, useEffect } from "react";
import Papa from "papaparse";
import "./Participants.css";



function Participants() {
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState("");

  const csvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

  useEffect(() => {
    fetch(csvUrl + "&t=" + Date.now())
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.text();
      })
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setParticipants(results.data);
          },
        });
      })
      .catch((err) => {
        console.error("CSV LOAD FAILED:", err);
      });
  }, []);

  const filteredParticipants = participants.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"])?.toLowerCase().includes(q) ||
      (p["CIC NO"] || p["CIC NUMBER"])?.toLowerCase().includes(q) ||
      (p["CHEST NUMBER"] || p["CHEST NO"])?.toLowerCase().includes(q) ||
      (p["TEAM"] || p["TEAM NAME"])?.toLowerCase().includes(q) ||
      (p["ON STAGE ITEMS"] || p["ON STAGE EVENTS"])?.toLowerCase().includes(q) ||
      (p["OFF STAGE ITEMES"] || p["OFF STAGE ITEMS"] || p["OFF STAGE EVENTS"])?.toLowerCase().includes(q)
    );
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
            placeholder="Search by name, chest no, team, events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredParticipants.length === 0 ? (
        <div className="empty-state">
          <p>No matching participants found.</p>
        </div>
      ) : (
        <div className="participants-grid">
          {filteredParticipants.map((p, i) => (
            <div key={i} className="results-card participant-card">
              <div className="participant-header">

                <div className="p-info">
                  <h3 className="p-name">{p["CANDIDATE NAME"] || p["CANDIDATE  FULL NAME"]}</h3>
                  <div className="p-meta">
                    <span className="p-chest">#{p["CHEST NUMBER"] || p["CHEST NO"] || "TBA"}</span>
                    <span className={`p-team team-badge team-${(p["TEAM"] || p["TEAM NAME"])?.toUpperCase()}`}>
                      {p["TEAM"] || p["TEAM NAME"]}
                    </span>
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
                    <p>{p["ON STAGE ITEMS"] || p["ON STAGE EVENTS"] || "None"}</p>
                  </div>
                  <div className="p-item-group">
                    <label>📝 Off Stage Events</label>
                    <p>{p["OFF STAGE ITEMES"] || p["OFF STAGE ITEMS"] || p["OFF STAGE EVENTS"] || "None"}</p>
                  </div>
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
