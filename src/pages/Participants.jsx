import { useState, useEffect } from "react";
import Papa from "papaparse";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import "./Participants.css";

function Participants() {
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const csvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7akmZPo8vINBoUN2hF6GdJ3ob-SqZFV2oDNSej9QvfY4z8H7Q9UbRIVmyu31pgiecp2h_2uiunBDJ/pub?gid=885092322&single=true&output=csv";

  useEffect(() => {
    const fetchAllParticipants = async () => {
      try {
        // Fetch CSV data
        const csvPromise = fetch(csvUrl + "&t=" + Date.now())
          .then((res) => {
            if (!res.ok) throw new Error("Network error");
            return res.text();
          })
          .then((csv) => {
            return new Promise((resolve) => {
              Papa.parse(csv, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                  // Mark CSV participants with source
                  const csvData = results.data.map(p => ({ ...p, _source: "csv" }));
                  resolve(csvData);
                },
              });
            });
          })
          .catch((err) => {
            console.error("CSV LOAD FAILED:", err);
            return [];
          });

        // Fetch Firestore registrations
        const firestorePromise = getDocs(query(collection(db, "registrations"), orderBy("submittedAt", "desc")))
          .then((snapshot) => {
            // Normalize Firestore data to match CSV structure
            return snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                "CANDIDATE NAME": data.fullName,
                "CANDIDATE  FULL NAME": data.fullName,
                "CIC NO": data.cicNumber,
                "CIC NUMBER": data.cicNumber,
                "CHEST NUMBER": data.chestNumber,
                "CHEST NO": data.chestNumber,
                "TEAM": data.team,
                "TEAM NAME": data.team,
                "ON STAGE ITEMS": data.onStageEvents?.join(", ") || "",
                "ON STAGE EVENTS": data.onStageEvents?.join(", ") || "",
                "OFF STAGE ITEMES": data.offStageEvents?.join(", ") || "",
                "OFF STAGE ITEMS": data.offStageEvents?.join(", ") || "",
                "OFF STAGE EVENTS": data.offStageEvents?.join(", ") || "",
                _source: "firestore",
                _submittedAt: data.submittedAt,
                _generalEvents: data.generalEvents?.join(", ") || ""
              };
            });
          })
          .catch((err) => {
            console.error("FIRESTORE LOAD FAILED:", err);
            return [];
          });

        // Wait for both sources
        const [csvData, firestoreData] = await Promise.all([csvPromise, firestorePromise]);

        // Merge both datasets (Firestore first, then CSV)
        const mergedData = [...firestoreData, ...csvData];
        setParticipants(mergedData);
      } catch (err) {
        console.error("Error fetching participants:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllParticipants();
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
                    <p>{p["ON STAGE ITEMS"] || p["ON STAGE EVENTS"] || "None"}</p>
                  </div>
                  <div className="p-item-group">
                    <label>📝 Off Stage Events</label>
                    <p>{p["OFF STAGE ITEMES"] || p["OFF STAGE ITEMS"] || p["OFF STAGE EVENTS"] || "None"}</p>
                  </div>
                  {p._source === "firestore" && p._generalEvents && (
                    <div className="p-item-group">
                      <label>🌐 General Events</label>
                      <p>{p._generalEvents || "None"}</p>
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
