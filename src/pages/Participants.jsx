import { useState, useEffect } from "react";
import Papa from "papaparse";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { CSV_URL } from "../config";
import "./Participants.css";
import { isGeneralEvent } from "../constants/events";

function Participants() {
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const csvUrl = CSV_URL;

  useEffect(() => {
    const fetchAllParticipants = async () => {
      try {
        // --- HELPERS (Robust Logic from Admin Dashboard) ---
        const normalizeEventString = (str) => {
          if (!str) return "";
          let s = str.toUpperCase();
          // Standardize separator
          s = s.split(',').map(item => item.trim()).filter(Boolean).join(', ');

          // Fix known typos
          s = s.replace(/SHORT VLOGING/g, "SHORT VLOGGING");
          s = s.replace(/SAMMARIZATION/g, "SUMMARIZATION");
          s = s.replace(/MINISTORY/g, "MINI STORY");
          s = s.replace(/PHOTOFEACHURE/g, "PHOTO FEATURE");
          s = s.replace(/Q&H/g, "Q AND H");
          s = s.replace(/SONG WRITER/g, "SONG WRITING");

          // Fix missing commas (Concat issues)
          s = s.replace(/TRENT SETTING/g, ", TRENT SETTING");
          s = s.replace(/REEL MAKING/g, ", REEL MAKING");
          s = s.replace(/MIME/g, ", MIME");
          s = s.replace(/MASHUP/g, ", MASHUP");

          // Cleanup resulting double commas
          s = s.replace(/,,/g, ",");
          s = s.replace(/^,/, "");
          return s;
        };

        const getValue = (row, ...keys) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            // 1. Exact match
            if (row[k]) return row[k];
            // 2. Case-insensitive
            const lowerK = k.toLowerCase();
            const match = rowKeys.find(rk => rk.toLowerCase() === lowerK);
            if (match && row[match]) return row[match];
            // 3. Normalized (ignore spaces)
            const normK = lowerK.replace(/\s+/g, '');
            const normMatch = rowKeys.find(rk => rk.toLowerCase().replace(/\s+/g, '') === normK);
            if (normMatch && row[normMatch]) return row[normMatch];
          }
          return "";
        };

        // --- FETCH DATA ---
        // 1. Fetch CSV
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
                complete: (results) => resolve(results.data),
              });
            });
          })
          .catch((err) => {
            console.error("CSV LOAD FAILED:", err);
            return [];
          });

        // 2. Fetch Firestore
        const firestorePromise = getDocs(query(collection(db, "registrations"), orderBy("submittedAt", "desc")))
          .then((snapshot) => {
            return snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                "CANDIDATE NAME": data.fullName,
                "CIC NO": data.cicNumber,
                "CHEST NUMBER": data.chestNumber,
                "TEAM": data.team,
                "ON STAGE EVENTS": data.onStageEvents?.join(", ") || "",
                "OFF STAGE EVENTS": data.offStageEvents?.join(", ") || "",
                "GENERAL EVENTS": data.generalEvents?.join(", ") || "",
                _source: "firestore",
                _submittedAt: data.submittedAt
              };
            });
          })
          .catch((err) => {
            console.error("FIRESTORE LOAD FAILED:", err);
            return [];
          });

        const [csvData, firestoreData] = await Promise.all([csvPromise, firestorePromise]);

        // --- NORMALIZE CSV DATA ---
        const normalizedCsv = csvData.map((row) => {
          let onStageStr = normalizeEventString(getValue(row, "ON STAGE EVENTS", "ON STAGE ITEMS", "ON STAGE"));
          let offStageStr = normalizeEventString(getValue(row, "OFF STAGE EVENTS", "OFF STAGE ITEMS", "OFF STAGE ITEMES", "OFF STAGE"));
          let generalStr = normalizeEventString(getValue(row, "GENERAL EVENTS", "GENERAL ITEMS", "OFF STAGE - GENERAL", "ON STAGE - GENERAL", "GENERAL"));

          // Helper to split, clean, and filter
          const splitEvents = (str) => str.split(',').map(s => s.trim()).filter(Boolean);

          let onStageArr = splitEvents(onStageStr);
          let offStageArr = splitEvents(offStageStr);
          let generalArr = splitEvents(generalStr);

          // Extract General Events from On Stage
          const onStageFiltered = [];
          onStageArr.forEach(evt => {
            if (isGeneralEvent(evt)) {
              if (!generalArr.includes(evt)) generalArr.push(evt);
            } else {
              onStageFiltered.push(evt);
            }
          });

          // Extract General Events from Off Stage
          const offStageFiltered = [];
          offStageArr.forEach(evt => {
            if (isGeneralEvent(evt)) {
              if (!generalArr.includes(evt)) generalArr.push(evt);
            } else {
              offStageFiltered.push(evt);
            }
          });

          return {
            "CANDIDATE NAME": getValue(row, "CANDIDATE NAME", "CANDIDATE  FULL NAME"),
            "CIC NO": getValue(row, "CIC NO", "CIC NUMBER"),
            "TEAM": getValue(row, "TEAM", "TEAM NAME"),
            "CHEST NUMBER": getValue(row, "CHEST NUMBER", "CHEST NO"),
            "ON STAGE EVENTS": onStageFiltered.join(", "),
            "OFF STAGE EVENTS": offStageFiltered.join(", "),
            "GENERAL EVENTS": generalArr.join(", "),
            _source: "csv"
          };
        });

        // --- MERGE LOGIC ---
        const mergedMap = new Map();
        const normalizeKey = (str) => String(str || "").trim().toLowerCase();

        const mergeStrings = (str1, str2) => {
          const s1 = str1 ? str1.split(",").map(s => s.trim()).filter(Boolean) : [];
          const s2 = str2 ? str2.split(",").map(s => s.trim()).filter(Boolean) : [];
          return [...new Set([...s1, ...s2])].join(", ");
        };

        const rawList = [...firestoreData, ...normalizedCsv];

        rawList.forEach(item => {
          const chestNo = item["CHEST NUMBER"];
          const name = item["CANDIDATE NAME"];
          // Use Chest No if valid (not 0 or empty), otherwise Name
          const key = (chestNo && normalizeKey(chestNo) !== "0" && normalizeKey(chestNo) !== "")
            ? normalizeKey(chestNo)
            : normalizeKey(name);

          if (!key) return; // Skip invalid rows without name or chest no

          if (mergedMap.has(key)) {
            // Merge with existing
            const existing = mergedMap.get(key);

            existing["ON STAGE EVENTS"] = mergeStrings(existing["ON STAGE EVENTS"], item["ON STAGE EVENTS"]);
            existing["OFF STAGE EVENTS"] = mergeStrings(existing["OFF STAGE EVENTS"], item["OFF STAGE EVENTS"]);
            existing["GENERAL EVENTS"] = mergeStrings(existing["GENERAL EVENTS"], item["GENERAL EVENTS"]);

            // Fill missing details
            if (!existing["CIC NO"] && item["CIC NO"]) existing["CIC NO"] = item["CIC NO"];
            if (!existing["TEAM"] && item["TEAM"]) existing["TEAM"] = item["TEAM"];
            if (!existing["CHEST NUMBER"] && item["CHEST NUMBER"]) existing["CHEST NUMBER"] = item["CHEST NUMBER"];

            if (item._source === "firestore") existing._source = "merged";
          } else {
            // New entry
            mergedMap.set(key, { ...item }); // Clone to be safe
          }
        });

        setParticipants(Array.from(mergedMap.values()));

      } catch (err) {
        console.error("Error fetching participants:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllParticipants();
  }, []);

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
          <span className="search-icon">🎭</span>
          <select
            className="participants-search"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            style={{ cursor: 'pointer' }}
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
